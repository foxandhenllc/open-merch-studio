import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { collectionArtworkStorage } from '../admin/collection-artwork-storage.js';
import type { PrivateArtworkStorage } from '../admin/collection-artwork.types.js';
import { withCollectionLock } from '../admin/collection-lock.js';
import { withCollectionCheckoutLock } from './checkout-lock.js';
import { expiredPreparation, preparationGraceMs } from './retention-policy.js';
import { purchaseJson } from './purchase.fingerprint.js';
import { readPurchase } from './purchase.repository.js';
import type { PurchaseManifest } from './purchase.types.js';

type Storage = Pick<PrivateArtworkStorage, 'namespace' | 'assertPrivate' | 'removeFolder'>;
export type PreparationRetentionReport = {
  available: boolean;
  graceDays: number;
  scanned: number;
  eligible: number;
  fileCount: number;
  bytes: number;
  cleared: number;
  failed: number;
  nextCursor?: string;
};
const unavailable = () =>
  new HttpError(
    'Private preparation cleanup is unavailable. Check database and private storage connections.',
    503
  );
const empty = (): PreparationRetentionReport => ({
  available: false,
  graceDays: 7,
  scanned: 0,
  eligible: 0,
  fileCount: 0,
  bytes: 0,
  cleared: 0,
  failed: 0,
});

async function eligible(m: PurchaseManifest, now: number, tx: Prisma.TransactionClient) {
  const ids = m.files.map((f) => f.assetId);
  const rows = await tx.designAsset.findMany({ where: { id: { in: ids } } });
  if (
    rows.length !== ids.length ||
    rows.some(
      (row) =>
        row.sourceType !== 'collection' ||
        row.purpose !== 'collection-print' ||
        !['pending', 'complete', 'retiring'].includes(row.generationStatus) ||
        row.createdAt.getTime() > now - preparationGraceMs ||
        row.studioSessionId !== m.sessionId ||
        purchaseJson(row.policyReport) !== purchaseJson(m) ||
        row.printStoragePath !== m.files.find((f) => f.assetId === row.id)!.path
    )
  )
    return false;
  // Protect all orders, including pending, refunded and cancelled orders. A retry may still need evidence.
  if (
    await tx.order.findFirst({
      where: { OR: [{ quoteId: m.quoteId }, { items: { some: { designAssetId: { in: ids } } } }] },
      select: { id: true },
    })
  )
    return false;
  if (
    await tx.quoteItem.findFirst({
      where: { designAssetId: { in: ids }, quoteId: { not: m.quoteId } },
      select: { id: true },
    })
  )
    return false;
  const quote = await readPurchase(m.quoteId, tx);
  if (quote && purchaseJson(quote) !== purchaseJson(m)) return false;
  if (!quote && (await tx.quote.count({ where: { id: m.quoteId } }))) return false;
  return true;
}

export function createPreparationRetentionService(
  storageFor: () => Storage | null = collectionArtworkStorage,
  clock = Date.now
) {
  return {
    async run(
      input: { clear?: boolean; cursor?: string } = {}
    ): Promise<PreparationRetentionReport> {
      if (!env.databaseUrl) return empty();
      if (input.cursor && !/^[a-f0-9-]{36}$/.test(input.cursor))
        throw new HttpError('Invalid preparation page.', 400);
      const storage = storageFor();
      if (!storage) throw unavailable();
      try {
        await storage.assertPrivate();
        const now = clock();
        const rows = await prisma.designAsset.findMany({
          where: {
            sourceType: 'collection',
            purpose: 'collection-print',
            generationStatus: { in: ['pending', 'complete', 'retiring'] },
            createdAt: { lte: new Date(now - preparationGraceMs) },
            ...(input.cursor ? { id: { gt: input.cursor } } : {}),
          },
          orderBy: { id: 'asc' },
          take: 101,
          select: { id: true, policyReport: true },
        });
        const report = {
          ...empty(),
          available: true,
          scanned: Math.min(rows.length, 100),
          ...(rows.length > 100 ? { nextCursor: rows[99].id } : {}),
        };
        const seen = new Set<string>();
        for (const row of rows.slice(0, 100)) {
          const m = expiredPreparation(row.policyReport, storage.namespace, now);
          if (!m || seen.has(m.quoteId)) continue;
          seen.add(m.quoteId);
          await withCollectionCheckoutLock(m.quoteId, async () => {
            const accepted = await withCollectionLock(async (tx) => {
              if (!tx || !(await eligible(m, now, tx))) return false;
              if (input.clear) {
                await tx.designAsset.updateMany({
                  where: { id: { in: m.files.map((f) => f.assetId) } },
                  data: { generationStatus: 'retiring', readinessStatus: 'blocked' },
                });
                await tx.auditLog.create({
                  data: {
                    actor: 'admin',
                    action: 'collection_preparation_cleanup_claimed',
                    target: m.quoteId,
                    metadata: { fileCount: m.files.length },
                  },
                });
              }
              return true;
            });
            if (!accepted) return;
            report.eligible++;
            report.fileCount += m.files.length;
            report.bytes += m.files.reduce((sum, file) => sum + file.byteSize, 0);
            if (!input.clear) return;
            try {
              for (const file of m.files)
                await storage.removeFolder(`owner-artwork/${file.assetId}`);
              await prisma.$transaction(async (tx) => {
                await tx.designAsset.updateMany({
                  where: {
                    id: { in: m.files.map((f) => f.assetId) },
                    generationStatus: 'retiring',
                  },
                  data: { generationStatus: 'retired' },
                });
                await tx.auditLog.create({
                  data: {
                    actor: 'admin',
                    action: 'collection_preparation_cleanup_completed',
                    target: m.quoteId,
                    metadata: { fileCount: m.files.length },
                  },
                });
              });
              report.cleared++;
            } catch {
              report.failed++;
            }
          });
        }
        return report;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw unavailable();
      }
    },
  };
}
export const preparationRetention = createPreparationRetentionService();
