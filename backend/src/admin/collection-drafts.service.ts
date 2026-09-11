import type { Prisma } from '@prisma/client';
import {
  collectionItemIssue,
  validateCollections,
  type CollectionCatalogProduct,
  type CollectionDraft,
  type CollectionSnapshot,
} from '@open-merch-studio/collection-drafts';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { listCollectionCatalog } from '../services/catalog.service.js';

import { collectionDraftsKey, withCollectionLock } from './collection-lock.js';
import { readArtworkRecord } from './collection-artwork.repository.js';
import { publishedArtworkIsReferenced } from './collection-publications.repository.js';
export { collectionDraftsKey } from './collection-lock.js';
type DraftRecord = { collections: CollectionDraft[]; revision: number; updatedAt: string | null };
const initial = (): DraftRecord => ({ collections: [], revision: 0, updatedAt: null });
let fixture: DraftRecord | undefined;
const unavailable = () =>
  new HttpError(
    'Collection drafts could not be loaded or saved. Your local edits are still here; check the database and retry.',
    503,
    'collection_drafts_unavailable'
  );
function parse(value: unknown): DraftRecord {
  const record = value as DraftRecord | null;
  if (
    !record ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    typeof record.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.updatedAt))
  )
    throw unavailable();
  return {
    collections: validateCollections(record.collections),
    revision: record.revision,
    updatedAt: record.updatedAt,
  };
}
async function catalog(client?: Prisma.TransactionClient): Promise<CollectionCatalogProduct[]> {
  const products = await listCollectionCatalog(client);
  return products
    .filter((product) => product.isSellable)
    .map((product) => ({
      id: product.id,
      title: product.title,
      variants: product.variants
        .filter((variant) => variant.isAvailable)
        .map(({ id, name }) => ({ id, name })),
      placements: product.placements.map(({ code, displayName, isDefault }) => ({
        code,
        displayName,
        isDefault,
      })),
    }));
}
const snapshot = (
  record: DraftRecord,
  products: CollectionCatalogProduct[]
): CollectionSnapshot => ({
  ...structuredClone(record),
  storage: env.databaseUrl ? 'database' : 'fixture',
  catalog: products,
});
export async function collectionArtworkIsReferenced(
  id: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const row = env.databaseUrl
    ? await (tx ?? prisma).adminSetting.findUnique({ where: { key: collectionDraftsKey } })
    : null;
  const record = env.databaseUrl ? (row ? parse(row.value) : initial()) : (fixture ?? initial());
  return (
    (await publishedArtworkIsReferenced(id, tx)) ||
    record.collections.some((collection) =>
      collection.items.some((item) => item.artwork?.some((binding) => binding.assetId === id))
    )
  );
}
export async function readCollectionDrafts(
  tx?: Prisma.TransactionClient
): Promise<CollectionSnapshot> {
  try {
    if (!env.databaseUrl && env.nodeEnv === 'production') throw unavailable();
    const row = env.databaseUrl
      ? await (tx ?? prisma).adminSetting.findUnique({ where: { key: collectionDraftsKey } })
      : null;
    const record = env.databaseUrl ? (row ? parse(row.value) : initial()) : (fixture ?? initial());
    return snapshot(record, await catalog(tx));
  } catch {
    throw unavailable();
  }
}
export async function saveCollectionDrafts(
  input: unknown,
  expectedRevision: unknown
): Promise<CollectionSnapshot> {
  let collections: CollectionDraft[];
  try {
    collections = validateCollections(input);
  } catch (error) {
    throw new HttpError(
      error instanceof Error ? error.message : 'Invalid collection.',
      400,
      'invalid_collection_draft'
    );
  }
  if (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0)
    throw new HttpError(
      'Reload collection drafts before saving.',
      400,
      'invalid_collection_revision'
    );
  const change = async (before: DraftRecord, client?: Prisma.TransactionClient) => {
    if (before.revision !== expectedRevision)
      throw new HttpError(
        'Collection drafts changed in another session. Reload saved drafts before trying again.',
        409,
        'collection_conflict'
      );
    const products = await catalog(client);
    for (const collection of collections)
      for (const item of collection.items) {
        const issue = collectionItemIssue(item, products);
        if (issue) throw new HttpError(issue, 400, 'collection_catalog_changed');
      }
    for (const collection of collections)
      for (const item of collection.items)
        for (const binding of item.artwork ?? []) {
          const asset = await readArtworkRecord(binding.assetId, client);
          if (!asset || asset.status !== 'complete')
            throw new HttpError(
              'Attach completed artwork from this store’s private library.',
              400,
              'collection_artwork_unavailable'
            );
        }
    const next = {
      collections,
      revision: before.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    return { next, result: snapshot(next, products) };
  };
  try {
    return await withCollectionLock(async (tx) => {
      if (!tx) {
        const { next, result } = await change(fixture ?? initial());
        fixture = structuredClone(next);
        return result;
      }
      const row = await tx.adminSetting.findUnique({ where: { key: collectionDraftsKey } });
      const { next, result } = await change(row ? parse(row.value) : initial(), tx);
      const value = JSON.parse(JSON.stringify(next)) as Prisma.InputJsonValue;
      await tx.adminSetting.upsert({
        where: { key: collectionDraftsKey },
        create: { key: collectionDraftsKey, value, updatedBy: 'store-admin' },
        update: { value, updatedBy: 'store-admin' },
      });
      await tx.auditLog.create({
        data: {
          actor: 'store-admin',
          action: 'collection_drafts_saved',
          target: collectionDraftsKey,
          metadata: {
            revision: next.revision,
            collectionCount: collections.length,
            productCount: collections.reduce(
              (count, collection) => count + collection.items.length,
              0
            ),
          },
        },
      });
      return result;
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw unavailable();
  }
}
