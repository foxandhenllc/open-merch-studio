import { purchaseJson } from './purchase.fingerprint.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { saveQuote } from '../services/runtime-store.js';
import type { PurchaseManifest } from './purchase.types.js';
const pending = new Map<string, PurchaseManifest>();
const complete = new Map<string, PurchaseManifest>();
const mismatch = () =>
  new HttpError(
    'This purchase request was already used for a different selection. Start a fresh request.',
    409,
    'collection_request_conflict'
  );
export function sameRequest(found: PurchaseManifest, expected: PurchaseManifest) {
  if (
    found.requestHash !== expected.requestHash ||
    found.sessionId !== expected.sessionId ||
    found.namespace !== expected.namespace ||
    purchaseJson(found.files) !== purchaseJson(expected.files)
  )
    throw mismatch();
}
export async function readPurchase(
  quoteId: string,
  tx?: Prisma.TransactionClient
): Promise<PurchaseManifest | null> {
  if (!env.databaseUrl) return structuredClone(complete.get(quoteId) ?? null);
  const quote = await (tx ?? prisma).quote.findUnique({
    where: { id: quoteId },
    select: { items: { select: { options: true }, take: 1 } },
  });
  const options = quote?.items[0]?.options as { collectionPurchase?: PurchaseManifest } | null;
  return options?.collectionPurchase ?? null;
}
/** Stage every path durably before any object write. Failed uploads remain discoverable and retryable. */
export async function stagePurchase(manifest: PurchaseManifest, tx?: Prisma.TransactionClient) {
  if (!tx) {
    const existing = pending.get(manifest.quoteId);
    if (existing) sameRequest(existing, manifest);
    else pending.set(manifest.quoteId, structuredClone(manifest));
    return;
  }
  for (const file of manifest.files) {
    const found = await tx.designAsset.findUnique({ where: { id: file.assetId } });
    if (found) {
      if (['retiring', 'retired'].includes(found.generationStatus))
        throw new HttpError(
          'This preparation expired. Start a fresh purchase request.',
          410,
          'collection_preparation_retired'
        );
      if (found.sourceType !== 'collection' || found.purpose !== 'collection-print')
        throw mismatch();
      sameRequest(found.policyReport as unknown as PurchaseManifest, manifest);
      continue;
    }
    await tx.designAsset.create({
      data: {
        id: file.assetId,
        studioSessionId: manifest.sessionId,
        prompt: 'Approved collection print',
        provider: 'owner-collection',
        sourceType: 'collection',
        purpose: 'collection-print',
        printStoragePath: file.path,
        mimeType: 'image/png',
        byteSize: file.byteSize,
        width: file.width,
        height: file.height,
        hasAlpha: true,
        checksumSha256: file.sha256,
        generationStatus: 'pending',
        policyStatus: 'pass',
        readinessStatus: 'pending',
        policyReport: JSON.parse(JSON.stringify(manifest)) as Prisma.InputJsonValue,
      },
    });
  }
}
export async function completePurchase(manifest: PurchaseManifest, tx?: Prisma.TransactionClient) {
  if (
    tx &&
    (await tx.designAsset.count({
      where: {
        id: { in: manifest.files.map((file) => file.assetId) },
        generationStatus: { in: ['retiring', 'retired'] },
      },
    }))
  )
    throw new HttpError(
      'This preparation expired. Start a fresh purchase request.',
      410,
      'collection_preparation_retired'
    );
  const existing = await readPurchase(manifest.quoteId, tx);
  if (existing) {
    sameRequest(existing, manifest);
    return existing.quote;
  }
  if (!tx) {
    complete.set(manifest.quoteId, structuredClone(manifest));
    return saveQuote(structuredClone(manifest.quote));
  }
  const q = manifest.quote;
  await tx.quote.create({
    data: {
      id: manifest.quoteId,
      currency: q.currency,
      productCostCents: q.productCostCents,
      shippingEstimateCents: q.shippingEstimateCents,
      taxEstimateCents: q.taxEstimateCents,
      aiDesignFeeCents: 0,
      paymentFeeCents: 0,
      targetMarginCents: q.targetMarginCents,
      studioPassCreditCents: 0,
      subtotalBeforeCreditsCents: q.subtotalBeforeCreditsCents,
      costLines: q.costLines,
      estimateFlags: q.estimateFlags,
      totalCents: q.totalCents,
      expiresAt: new Date(q.expiresAt),
      items: {
        create: q.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          designAssetId: item.designAssetId,
          quantity: item.quantity,
          placementCodes: item.placementCodes,
          unitCostCents: item.unitCostCents,
          unitRetailCents: item.unitRetailCents,
          options: JSON.parse(
            JSON.stringify({
              collectionPurchase: manifest,
              placements: item.placements,
              placementTechniques: item.placementTechniques,
              pricingSource: item.pricingSource,
              placementCostCents: item.placementCostCents,
            })
          ) as Prisma.InputJsonValue,
        })),
      },
    },
  });
  await tx.designAsset.updateMany({
    where: { id: { in: manifest.files.map((file) => file.assetId) }, sourceType: 'collection' },
    data: {
      generationStatus: 'complete',
      readinessStatus: 'pass',
      policyReport: JSON.parse(JSON.stringify(manifest)) as Prisma.InputJsonValue,
    },
  });
  await tx.auditLog.create({
    data: {
      actor: 'collection-checkout',
      action: 'collection_quote_prepared',
      target: manifest.quoteId,
      metadata: { fileCount: manifest.files.length, lineCount: q.items.length },
    },
  });
  return q;
}
