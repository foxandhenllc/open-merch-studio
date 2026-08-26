import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import type { AssetUploadAuthorization, DesignDraft } from '../types/catalog.js';
import { dataUrlToBuffer } from './openai-design-provider.js';
import { prepareArtworkForPrint } from './background-removal.service.js';
import {
  assetStorageConfigured,
  createPrivatePreviewUrl,
  createPrivateUploadUrl,
  downloadPrivateAsset,
  removeStoredAssets,
  uploadPrivateAsset,
  uploadPublicPrintAsset,
} from './asset-storage.service.js';
import {
  getAllowanceState,
  getOrCreateDurableSession,
  runtimeNow,
  saveDraft,
} from './runtime-store.js';

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const extensionForMime: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const retentionUntil = () => new Date(Date.now() + env.uploadRetentionDays * 24 * 60 * 60 * 1000);

type StoredUpload = {
  id: string;
  originalStoragePath: string | null;
  previewStoragePath: string | null;
  printStoragePath: string | null;
};

const safeFilename = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .trim()
    .slice(0, 120) || 'uploaded-artwork';

function assertUploadMetadata(params: { contentType: string; byteSize: number }) {
  if (!allowedMimeTypes.has(params.contentType)) {
    throw new HttpError('Upload a PNG, JPEG, or WebP image.', 400, 'unsupported_image_type');
  }
  if (!Number.isFinite(params.byteSize) || params.byteSize <= 0) {
    throw new HttpError('The uploaded image is empty.', 400, 'empty_upload');
  }
  if (params.byteSize > env.uploadMaxBytes) {
    throw new HttpError(
      `Images must be ${Math.floor(env.uploadMaxBytes / 1024 / 1024)} MB or smaller.`,
      413,
      'upload_too_large'
    );
  }
}

export async function authorizeArtworkUpload(params: {
  sessionId?: string;
  filename: string;
  contentType: string;
  byteSize: number;
  purpose: 'print' | 'reference';
}): Promise<AssetUploadAuthorization> {
  assertUploadMetadata(params);
  const session = await getOrCreateDurableSession(params.sessionId);
  const assetId = randomUUID();

  if (!assetStorageConfigured()) {
    return {
      assetId,
      transport: 'inline',
      maxBytes: Math.min(env.uploadMaxBytes, 2 * 1024 * 1024),
      expiresInSeconds: 15 * 60,
    };
  }

  void cleanupExpiredArtworkUploads().catch(() => undefined);

  const recentUploads = await prisma.designAsset.count({
    where: {
      studioSessionId: session.id,
      sourceType: 'uploaded',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentUploads >= env.uploadMaxFilesPerSession) {
    throw new HttpError(
      'This session has reached its daily upload limit. Start fresh tomorrow or contact support.',
      429,
      'upload_limit_reached'
    );
  }

  const originalStoragePath = `${session.id}/${assetId}/original.${extensionForMime[params.contentType]}`;
  await prisma.designAsset.create({
    data: {
      id: assetId,
      studioSessionId: session.id,
      prompt: `Uploaded artwork: ${safeFilename(params.filename)}`,
      provider: 'upload',
      sourceType: 'uploaded',
      purpose: params.purpose,
      originalStoragePath,
      mimeType: params.contentType,
      originalFilename: safeFilename(params.filename),
      byteSize: Math.floor(params.byteSize),
      retentionUntil: retentionUntil(),
      generationStatus: 'uploading',
      policyStatus: 'needs_review',
      readinessStatus: 'pending',
    },
  });

  try {
    return {
      assetId,
      transport: 'supabase',
      signedUrl: await createPrivateUploadUrl(originalStoragePath),
      maxBytes: env.uploadMaxBytes,
      expiresInSeconds: 2 * 60 * 60,
    };
  } catch (error) {
    await prisma.designAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    throw error;
  }
}

const parentAssetIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

async function referencedUploadIds(sessionIds?: string[]): Promise<Set<string>> {
  const descendants = await prisma.designAsset.findMany({
    where: {
      parentAssetIds: { not: { equals: null } },
      ...(sessionIds?.length ? { studioSessionId: { in: sessionIds } } : {}),
    },
    select: { parentAssetIds: true },
  });
  return new Set(descendants.flatMap((asset) => parentAssetIds(asset.parentAssetIds)));
}

async function removeUploadRecords(assets: StoredUpload[]): Promise<number> {
  if (!assets.length) return 0;
  await removeStoredAssets({
    privatePaths: assets.flatMap((asset) =>
      [asset.originalStoragePath, asset.previewStoragePath].filter((path): path is string =>
        Boolean(path)
      )
    ),
    publicPaths: assets.flatMap((asset) =>
      [asset.printStoragePath].filter((path): path is string => Boolean(path))
    ),
  });
  const assetIds = assets.map((asset) => asset.id);
  const removed = await prisma.$transaction(async (tx) => {
    await tx.quoteItem.updateMany({
      where: { designAssetId: { in: assetIds } },
      data: { designAssetId: null },
    });
    return tx.designAsset.deleteMany({
      where: { id: { in: assetIds } },
    });
  });
  return removed.count;
}

export async function deleteArtworkUpload(params: {
  assetId: string;
  sessionId: string;
}): Promise<boolean> {
  if (!assetStorageConfigured()) return true;
  const asset = await prisma.designAsset.findFirst({
    where: {
      id: params.assetId,
      studioSessionId: params.sessionId,
      sourceType: 'uploaded',
      orderItems: { none: {} },
    },
    select: {
      id: true,
      studioSessionId: true,
      originalStoragePath: true,
      previewStoragePath: true,
      printStoragePath: true,
    },
  });
  if (!asset) return false;
  const referenced = await referencedUploadIds([asset.studioSessionId].filter(Boolean) as string[]);
  if (referenced.has(asset.id)) return false;
  return (await removeUploadRecords([asset])) === 1;
}

export async function deleteAbandonedSessionUploads(sessionId: string): Promise<number> {
  if (!assetStorageConfigured()) return 0;
  const candidates = await prisma.designAsset.findMany({
    where: {
      studioSessionId: sessionId,
      sourceType: 'uploaded',
      orderItems: { none: {} },
    },
    select: {
      id: true,
      originalStoragePath: true,
      previewStoragePath: true,
      printStoragePath: true,
    },
  });
  const referenced = await referencedUploadIds([sessionId]);
  return removeUploadRecords(candidates.filter((asset) => !referenced.has(asset.id)));
}

export async function cleanupExpiredArtworkUploads(limit = 25): Promise<number> {
  if (!assetStorageConfigured()) return 0;
  const candidates = await prisma.designAsset.findMany({
    where: {
      sourceType: 'uploaded',
      retentionUntil: { lt: new Date() },
      orderItems: { none: {} },
    },
    orderBy: { retentionUntil: 'asc' },
    take: limit,
    select: {
      id: true,
      studioSessionId: true,
      originalStoragePath: true,
      previewStoragePath: true,
      printStoragePath: true,
    },
  });
  const sessionIds = candidates
    .map((asset) => asset.studioSessionId)
    .filter((id): id is string => Boolean(id));
  const referenced = await referencedUploadIds(sessionIds);
  return removeUploadRecords(candidates.filter((asset) => !referenced.has(asset.id)));
}

function readinessForUpload(params: {
  width: number;
  height: number;
  placementCodes: string[];
  purpose: 'print' | 'reference';
  preparationMessage: string;
  preparationReady: boolean;
}): DesignDraft['readiness'] {
  if (params.purpose === 'reference') {
    return {
      status: 'needs_review',
      checks: [
        {
          label: 'Reference only',
          result: 'This image can guide a new design but cannot be sent to checkout itself.',
          severity: 'warning',
        },
      ],
    };
  }

  const shortestSide = Math.min(params.width, params.height);
  const resolution =
    shortestSide < 600
      ? {
          result: `${params.width} × ${params.height}px is too small for dependable product printing.`,
          severity: 'block' as const,
        }
      : shortestSide < 1200
        ? {
            result: `${params.width} × ${params.height}px may print softly on larger products.`,
            severity: 'warning' as const,
          }
        : {
            result: `${params.width} × ${params.height}px is suitable for the selected product preview.`,
            severity: 'pass' as const,
          };
  const checks: DesignDraft['readiness']['checks'] = [
    { label: 'Image resolution', ...resolution },
    {
      label: 'Placement fit',
      result: params.placementCodes.length
        ? `Prepared for ${params.placementCodes.join(', ')} placement.`
        : 'Select a product placement before production.',
      severity: params.placementCodes.length ? 'pass' : 'warning',
    },
    {
      label: 'Print file preparation',
      result: params.preparationMessage,
      severity: params.preparationReady ? 'pass' : 'warning',
    },
    {
      label: 'Artwork rights',
      result:
        'The customer confirmed they have permission to reproduce this artwork on merchandise.',
      severity: 'pass',
    },
  ];
  const hasBlock = checks.some((check) => check.severity === 'block');
  const hasWarning = checks.some((check) => check.severity === 'warning');
  return { status: hasBlock ? 'blocked' : hasWarning ? 'warning' : 'pass', checks };
}

export async function completeArtworkUpload(params: {
  assetId: string;
  sessionId?: string;
  rightsConfirmed: boolean;
  placementCodes?: string[];
  removeBackground?: boolean;
  inlineDataUrl?: string;
  filename?: string;
  contentType?: string;
  purpose?: 'print' | 'reference';
}): Promise<DesignDraft> {
  if (!params.rightsConfirmed) {
    throw new HttpError(
      'Confirm that you have permission to reproduce this artwork on merchandise.',
      400,
      'artwork_rights_required'
    );
  }
  const session = await getOrCreateDurableSession(params.sessionId);
  const stored = assetStorageConfigured()
    ? await prisma.designAsset.findUnique({ where: { id: params.assetId } })
    : null;
  if (stored && stored.studioSessionId !== session.id) {
    throw new HttpError(
      'This uploaded artwork belongs to another session.',
      403,
      'asset_forbidden'
    );
  }
  if (assetStorageConfigured() && !stored?.originalStoragePath) {
    throw new HttpError('The uploaded file could not be found.', 404, 'upload_not_found');
  }

  let original: Buffer;
  if (stored?.originalStoragePath) {
    original = await downloadPrivateAsset(stored.originalStoragePath);
  } else {
    const decoded = params.inlineDataUrl ? dataUrlToBuffer(params.inlineDataUrl) : null;
    if (!decoded) throw new HttpError('Local fixture upload data is required.', 400);
    assertUploadMetadata({ contentType: decoded.contentType, byteSize: decoded.buffer.byteLength });
    original = decoded.buffer;
  }

  const source = sharp(original, { failOn: 'error', limitInputPixels: 100_000_000 }).rotate();
  const normalized = await source
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  const width = normalized.info.width;
  const height = normalized.info.height;
  if (!width || !height) throw new HttpError('The image dimensions could not be read.', 400);
  const hasAlpha = Boolean(normalized.info.hasAlpha);
  const purpose = (stored?.purpose ?? params.purpose ?? 'print') as 'print' | 'reference';
  const checksumSha256 = createHash('sha256').update(original).digest('hex');
  const preview = await sharp(normalized.data)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();

  let printBuffer = normalized.data;
  let preparationStatus: NonNullable<DesignDraft['printPreparation']>['status'] = 'prepared';
  let preparationProvider: NonNullable<DesignDraft['printPreparation']>['provider'] = 'sharp';
  let preparationMessage = hasAlpha
    ? 'A transparent, color-managed PNG was prepared without generative changes.'
    : 'A color-managed PNG was prepared and the original background was preserved.';

  if (purpose === 'print' && params.removeBackground) {
    const prepared = await prepareArtworkForPrint({
      imageUrl: `data:image/png;base64,${normalized.data.toString('base64')}`,
      model: 'gpt-image-2',
    });
    const decoded = prepared.transparentUrl ? dataUrlToBuffer(prepared.transparentUrl) : null;
    if (decoded) printBuffer = Buffer.from(decoded.buffer);
    preparationStatus = prepared.status === 'removed' ? 'removed' : 'failed';
    preparationProvider = prepared.provider;
    preparationMessage = prepared.message;
  }

  const previewStoragePath = `${session.id}/${params.assetId}/preview.webp`;
  const printStoragePath = purpose === 'print' ? `uploads/${params.assetId}/print.png` : null;
  let imageUrl = `data:image/webp;base64,${preview.toString('base64')}`;
  if (assetStorageConfigured()) {
    await uploadPrivateAsset({
      path: previewStoragePath,
      buffer: preview,
      contentType: 'image/webp',
    });
    imageUrl = await createPrivatePreviewUrl(previewStoragePath);
    if (printStoragePath) {
      imageUrl = await uploadPublicPrintAsset({ path: printStoragePath, buffer: printBuffer });
    }
  }

  const readiness = readinessForUpload({
    width,
    height,
    placementCodes: params.placementCodes ?? [],
    purpose,
    preparationMessage,
    preparationReady: preparationStatus !== 'failed',
  });
  const policy: DesignDraft['policy'] = {
    status: 'pass',
    reasons: [
      'Customer confirmed reproduction rights; fulfillment remains subject to content review.',
    ],
  };
  const now = runtimeNow();
  const draft: DesignDraft = {
    id: params.assetId,
    sessionId: session.id,
    provider: 'upload',
    sourceType: 'uploaded',
    purpose,
    generationStatus: 'complete',
    prompt: stored?.prompt ?? `Uploaded artwork: ${safeFilename(params.filename ?? 'artwork')}`,
    imageUrl,
    qualityTier: 'final',
    printPreparation: {
      status: preparationStatus,
      provider: preparationProvider,
      message: preparationMessage,
    },
    asset: {
      originalFilename: stored?.originalFilename ?? safeFilename(params.filename ?? 'artwork'),
      mimeType: stored?.mimeType ?? params.contentType,
      byteSize: original.byteLength,
      width,
      height,
      hasAlpha,
    },
    allowance: getAllowanceState(session.id),
    policy,
    readiness,
    createdAt: now,
  };

  if (stored) {
    try {
      await prisma.designAsset.update({
        where: { id: stored.id },
        data: {
          imageUrl: printStoragePath ? imageUrl : null,
          transparentUrl:
            printStoragePath && (hasAlpha || preparationStatus === 'removed') ? imageUrl : null,
          previewStoragePath,
          printStoragePath,
          byteSize: original.byteLength,
          width,
          height,
          hasAlpha: preparationStatus === 'removed' ? true : hasAlpha,
          checksumSha256,
          rightsConfirmedAt: new Date(),
          generationStatus: 'complete',
          policyStatus: policy.status,
          policyReport: policy,
          readinessStatus: readiness.status,
          readinessReport: readiness,
        },
      });
    } catch (error) {
      await removeStoredAssets({
        privatePaths: [previewStoragePath],
        publicPaths: printStoragePath ? [printStoragePath] : [],
      }).catch(() => undefined);
      throw error;
    }
  }

  return saveDraft(draft);
}
