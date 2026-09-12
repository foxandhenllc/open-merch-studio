import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { withCollectionLock } from '../admin/collection-lock.js';
import {
  createDesignDraft,
  createDesignFromReferences,
  getDesignDraftById,
} from '../services/design.service.js';
import { getDraft, getOrCreateDurableSession } from '../services/runtime-store.js';
import { HttpError } from '../middleware.js';
import { reserveCollectionPreparation } from './purchase-limits.js';
import { personalizationContext } from './personalization-context.js';
import { purchaseJson } from './purchase.fingerprint.js';

type Input = {
  collectionId: string;
  version: number;
  itemId: string;
  sessionId: string;
  requestId: string;
  prompt: string;
  referenceAssetId?: string;
};
type Job = {
  schemaVersion: 1;
  requestHash: string;
  status: 'pending' | 'complete' | 'failed';
  assetId?: string;
};
const jobs = new Map<string, Job>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const unavailable = () =>
  new HttpError(
    'Artwork preparation could not be confirmed. Check this request again before starting another generation.',
    503,
    'collection_generation_unconfirmed'
  );
async function job(key: string, tx?: Prisma.TransactionClient) {
  if (!env.databaseUrl) return jobs.get(key) ?? null;
  const row = await (tx ?? prisma).adminSetting.findUnique({ where: { key } });
  const value = row?.value as Job | null;
  if (
    value &&
    (value.schemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(value.requestHash) ||
      !['pending', 'complete', 'failed'].includes(value.status) ||
      (value.status === 'complete' && typeof value.assetId !== 'string'))
  )
    throw unavailable();
  return value;
}
async function save(key: string, value: Job, tx?: Prisma.TransactionClient) {
  if (!tx) {
    jobs.set(key, structuredClone(value));
    return;
  }
  const data = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  await tx.adminSetting.upsert({
    where: { key },
    create: { key, value: data, updatedBy: 'collection-artwork' },
    update: { value: data, updatedBy: 'collection-artwork' },
  });
  await tx.auditLog.create({
    data: {
      actor: 'collection-customer',
      action: `collection_generation_${value.status}`,
      target: key,
      metadata: { status: value.status },
    },
  });
}
export async function generateCollectionArtwork(value: unknown) {
  const input = value as Input;
  const allowed = [
    'collectionId',
    'version',
    'itemId',
    'sessionId',
    'requestId',
    'prompt',
    'referenceAssetId',
  ];
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    !['collectionId', 'itemId', 'sessionId', 'requestId'].every(
      (key) =>
        typeof input[key as keyof Input] === 'string' &&
        /^[A-Za-z0-9_-]{1,100}$/.test(String(input[key as keyof Input]))
    ) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    typeof input.prompt !== 'string' ||
    !input.prompt.trim() ||
    input.prompt.length > 2000 ||
    (input.referenceAssetId !== undefined &&
      (typeof input.referenceAssetId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(input.referenceAssetId)))
  )
    throw new HttpError('Enter a prompt and use the artwork option offered by this product.', 400);
  const request = structuredClone(input);
  const context = await personalizationContext(request, ['generate', 'reference']);
  if ((context.item.artworkMode === 'reference') !== Boolean(request.referenceAssetId))
    throw new HttpError(
      'Choose the reference option offered by this product.',
      400,
      'collection_artwork_mode'
    );
  if (request.referenceAssetId) {
    const reference = env.databaseUrl
      ? await prisma.designAsset.findUnique({
          where: { id: request.referenceAssetId },
          select: {
            studioSessionId: true,
            sourceType: true,
            purpose: true,
            generationStatus: true,
            rightsConfirmedAt: true,
          },
        })
      : null;
    const local = !env.databaseUrl ? getDraft(request.referenceAssetId) : null;
    const valid = reference
      ? reference.studioSessionId === request.sessionId &&
        reference.sourceType === 'uploaded' &&
        reference.purpose === 'reference' &&
        reference.generationStatus === 'complete' &&
        reference.rightsConfirmedAt
      : local &&
        local.sessionId === request.sessionId &&
        local.sourceType === 'uploaded' &&
        local.purpose === 'reference' &&
        local.generationStatus === 'complete';
    if (!valid)
      throw new HttpError(
        'Upload your reference in this session before generating.',
        400,
        'collection_reference_unavailable'
      );
  }
  const key = `collection-generation-v1:${hash(`${request.sessionId}:${request.requestId}`)}`;
  const requestHash = hash(purchaseJson(request));
  if (!(await job(key))) await reserveCollectionPreparation(request.sessionId);
  const fresh = await withCollectionLock(async (tx) => {
    const existing = await job(key, tx);
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new HttpError(
          'Use a new request for a changed prompt or product.',
          409,
          'collection_generation_conflict'
        );
      return false;
    }
    await save(key, { schemaVersion: 1, requestHash, status: 'pending' }, tx);
    return true;
  });
  if (!fresh) {
    const previous = (await job(key))!;
    if (previous.status === 'pending') throw unavailable();
    if (previous.status === 'failed')
      throw new HttpError(
        'This generation did not produce usable artwork. A new generation is a separate request and may use additional AI budget.',
        409,
        'collection_generation_failed'
      );
    const draft = await getDesignDraftById(previous.assetId!, request.sessionId);
    if (!draft || draft.sessionId !== request.sessionId) throw unavailable();
    return draft;
  }
  // A pending record survives process loss. Retrying its ID never starts a second paid request.
  try {
    await getOrCreateDurableSession(request.sessionId);
    const parameters = {
      prompt: request.prompt,
      sessionId: request.sessionId,
      productId: context.item.productId,
      variantId: context.item.variantId,
      placementCodes: context.item.placementCodes,
    };
    const draft = request.referenceAssetId
      ? await createDesignFromReferences({
          ...parameters,
          referenceAssetIds: [request.referenceAssetId],
        })
      : await createDesignDraft(request.prompt, { ...parameters, qualityTier: 'rough' });
    if (!draft.id || draft.generationStatus !== 'complete' || draft.policy.status !== 'pass') {
      await withCollectionLock((tx) =>
        save(key, { schemaVersion: 1, requestHash, status: 'failed' }, tx)
      );
      throw new HttpError(
        'The artwork could not be prepared. Check your allowance and try a different request.',
        409,
        'collection_generation_failed'
      );
    }
    await withCollectionLock((tx) =>
      save(key, { schemaVersion: 1, requestHash, status: 'complete', assetId: draft.id! }, tx)
    );
    const current = await personalizationContext(request, ['generate', 'reference']);
    if (
      current.reviewDigest !== context.reviewDigest ||
      current.layoutRevision !== context.layoutRevision ||
      current.salesRevision !== context.salesRevision
    )
      throw new HttpError(
        'The collection changed while artwork was being prepared. Refresh before ordering.',
        409,
        'collection_purchase_stale'
      );
    return draft;
  } catch (error) {
    // Unknown provider/persistence failures remain pending to prevent an automatic second charge.
    if (error instanceof HttpError) throw error;
    throw unavailable();
  }
}
