import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {
  ArtworkMode,
  CollectionPrintLayout,
  CollectionReview,
} from '@open-merch-studio/collection-drafts';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { getDraft } from '../services/runtime-store.js';
import {
  downloadPrivateAsset,
  assertUploadBucketPrivate,
} from '../services/asset-storage.service.js';
import { dataUrlToBuffer } from '../services/openai-design-provider.js';
import { fixtureOriginal } from '../services/fixture-upload-originals.js';
import {
  layoutPixels,
  renderCollectionPrint,
  PRINT_DENSITY,
} from '../admin/collection-print-render.js';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const unavailable = () =>
  new HttpError(
    'This artwork is unavailable for this collection. Prepare it again in your current session.',
    409,
    'personalized_artwork_unavailable'
  );
const sourceFor = {
  upload: 'uploaded',
  generate: 'generated',
  reference: 'reference_generated',
} as const;

export async function readPersonalizedArtwork(
  assetId: string,
  sessionId: string,
  mode: ArtworkMode,
  storage = { assertPrivate: assertUploadBucketPrivate, read: downloadPrivateAsset }
) {
  if (mode === 'fixed' || typeof sessionId !== 'string' || !sessionId || !assetId)
    throw unavailable();
  const expected = sourceFor[mode];
  if (!expected) throw unavailable();
  let bytes: Buffer | null = null;
  if (env.databaseUrl) {
    const asset = await prisma.designAsset.findUnique({ where: { id: assetId } });
    if (
      !asset ||
      asset.studioSessionId !== sessionId ||
      asset.sourceType !== expected ||
      !(mode === 'upload'
        ? ['print', 'collection'].includes(asset.purpose ?? '')
        : asset.purpose === 'print') ||
      asset.generationStatus !== 'complete' ||
      asset.policyStatus !== 'pass'
    )
      throw unavailable();
    if (mode === 'upload') {
      if (!asset.originalStoragePath || !asset.checksumSha256 || !asset.rightsConfirmedAt)
        throw unavailable();
      await storage.assertPrivate();
      bytes = await storage.read(asset.originalStoragePath);
      if (hash(bytes) !== asset.checksumSha256) throw unavailable();
    } else bytes = dataUrlToBuffer(asset.transparentUrl ?? asset.imageUrl ?? '')?.buffer ?? null;
  } else {
    if (env.nodeEnv === 'production') throw unavailable();
    const asset = getDraft(assetId);
    if (
      !asset ||
      asset.sessionId !== sessionId ||
      asset.sourceType !== expected ||
      !(mode === 'upload'
        ? ['print', 'collection'].includes(asset.purpose ?? '')
        : asset.purpose === 'print') ||
      asset.generationStatus !== 'complete' ||
      asset.policy.status !== 'pass'
    )
      throw unavailable();
    bytes =
      mode === 'upload'
        ? fixtureOriginal(assetId, sessionId)
        : (dataUrlToBuffer(asset.imageUrl)?.buffer ?? null);
  }
  if (!bytes || bytes.length > 25 * 1024 * 1024) throw unavailable();
  return { bytes, checksum: hash(bytes) };
}

/** Fit customer art inside the owner's approved example-art box, preserving aspect ratio. */
export async function renderPersonalizedPrint(
  original: Buffer,
  layout: CollectionPrintLayout,
  area: CollectionReview['areas'][number]
) {
  const pixels = layoutPixels(layout, area);
  const decoded = await sharp(original, { limitInputPixels: 40_000_000 })
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true });
  const ratio = Math.min(
    pixels.artworkWidth / decoded.info.width,
    pixels.artworkHeight / decoded.info.height
  );
  const ppi = PRINT_DENSITY / ratio;
  if (ppi < 150)
    throw new HttpError(
      'This image is too small for the store’s print area. Upload a larger original or generate a higher-resolution image.',
      400,
      'personalized_artwork_too_small'
    );
  const artworkWidth = Math.max(1, Math.floor(decoded.info.width * ratio));
  const artworkHeight = Math.max(1, Math.floor(decoded.info.height * ratio));
  const adjusted = {
    ...layout,
    leftInches:
      (pixels.left + Math.floor((pixels.artworkWidth - artworkWidth) / 2)) / PRINT_DENSITY,
    topInches:
      (pixels.top + Math.floor((pixels.artworkHeight - artworkHeight) / 2)) / PRINT_DENSITY,
  };
  const fitted = {
    ...area,
    widthInches: artworkWidth / PRINT_DENSITY,
    widthPixels: artworkWidth,
    heightPixels: artworkHeight,
  };
  return renderCollectionPrint(decoded.data, adjusted, fitted, false);
}

export const personalizedArtwork = { read: readPersonalizedArtwork };
