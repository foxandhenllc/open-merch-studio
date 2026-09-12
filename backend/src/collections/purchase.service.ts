import { withCollectionCheckoutLock } from './checkout-lock.js';
import { reserveCollectionPreparation } from './purchase-limits.js';
import { purchaseJson } from './purchase.fingerprint.js';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { HttpError } from '../middleware.js';
import { prepareCollectionPurchase } from '../admin/collection-purchase-preparation.js';
import { withCollectionLock } from '../admin/collection-lock.js';
import { readPublications } from '../admin/collection-publications.repository.js';
import { assertPublicationCurrent } from '../admin/collection-print-source.js';
import { getOrCreateDurableSession } from '../services/runtime-store.js';
import { estimateShippingCents } from '../services/pricing.service.js';
import type { QuoteBreakdown } from '../types/catalog.js';
import type { PurchaseManifest, PurchaseStorage } from './purchase.types.js';
import { purchaseStorage } from './purchase.storage.js';
import { readPurchase, stagePurchase, completePurchase } from './purchase.repository.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const idFor = (value: string) => {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const unavailable = () =>
  new HttpError(
    'Private collection print storage is unavailable. Your request can be retried.',
    503,
    'collection_purchase_storage_unavailable'
  );
export async function assertPurchaseCurrent(
  manifest: PurchaseManifest,
  tx?: Prisma.TransactionClient
) {
  const entry = (await readPublications(tx)).publications.find(
    (entry) => entry.id === manifest.origin.collectionId
  );
  if (
    !entry ||
    entry.version !== manifest.origin.version ||
    entry.printLayouts?.revision !== manifest.origin.layoutRevision ||
    entry.review.digest !== manifest.origin.reviewDigest ||
    entry.sales?.revision !== manifest.origin.salesRevision
  )
    throw new HttpError(
      'This collection or its print layout changed. Reopen the collection for a fresh quote.',
      409,
      'collection_purchase_stale'
    );
  await assertPublicationCurrent(entry, tx);
}
async function checkFiles(manifest: PurchaseManifest, storage: PurchaseStorage) {
  if (manifest.namespace !== storage.namespace) throw unavailable();
  await storage.assertPrivate();
  for (const file of manifest.files)
    if (hash(await storage.read(file.path)) !== file.sha256) throw unavailable();
}
export function createCollectionPurchaseService(storageFor = purchaseStorage) {
  return {
    async create(input: {
      selection: unknown;
      sessionId: string;
      requestId: string;
    }): Promise<QuoteBreakdown> {
      if (
        typeof input.sessionId !== 'string' ||
        typeof input.requestId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(input.sessionId) ||
        !/^[a-f0-9-]{36}$/.test(input.requestId)
      )
        throw new HttpError(
          'Start a store session and a fresh purchase request.',
          400,
          'invalid_collection_request'
        );
      const selection = structuredClone(input.selection);
      const requestHash = hash(purchaseJson(selection));
      const quoteId = idFor(`collection-quote:${input.sessionId}:${input.requestId}`);
      const storage = storageFor();
      if (!storage) throw unavailable();
      return withCollectionCheckoutLock(quoteId, async () => {
        try {
          await storage.assertPrivate();
          const existing = await readPurchase(quoteId);
          if (existing) {
            if (existing.sessionId !== input.sessionId || existing.requestHash !== requestHash)
              throw new HttpError(
                'Use a fresh request for a changed selection.',
                409,
                'collection_request_conflict'
              );
            if (Date.now() >= Date.parse(existing.quote.expiresAt))
              throw new HttpError(
                'This quote expired. Start a fresh purchase request.',
                409,
                'collection_quote_expired'
              );
            await withCollectionLock((tx) => assertPurchaseCurrent(existing, tx));
            await checkFiles(existing, storage);
            return structuredClone(existing.quote);
          }
          await reserveCollectionPreparation(input.sessionId);
          const prepared = await prepareCollectionPurchase(selection);
          if (!prepared.salesRevision)
            throw new HttpError(
              'Ordering is paused for this collection.',
              409,
              'collection_sales_paused'
            );
          const files = prepared.files.map((file) => {
            const assetId = idFor(
              `collection-print:${quoteId}:${file.itemId}:${file.placementCode}`
            );
            return {
              assetId,
              itemId: file.itemId,
              placementCode: file.placementCode,
              path: `owner-artwork/${assetId}/purchase.png`,
              sha256: file.sha256,
              sourceChecksum: file.sourceChecksum,
              width: file.width,
              height: file.height,
              byteSize: file.bytes.length,
            };
          });
          const items: QuoteBreakdown['items'] = prepared.lines.map((line) => {
            const placements = line.placements.map((placement) => ({
              ...placement,
              designAssetId: files.find(
                (file) => file.itemId === line.itemId && file.placementCode === placement.code
              )!.assetId,
              additionalCostCents: 0,
            }));
            return {
              productId: line.productId,
              variantId: line.variantId,
              printfulVariantId: line.printfulVariantId,
              title: line.title,
              variantName: line.variantName,
              quantity: line.quantity,
              placementCodes: placements.map((placement) => placement.code),
              placementTechniques: Object.fromEntries(
                placements.map((placement) => [placement.code, placement.technique])
              ),
              placements,
              designAssetId: placements[0].designAssetId,
              designFeeCents: 0,
              placementCostCents: 0,
              pricingSource: 'owner-published',
              unitCostCents: 0,
              unitRetailCents: line.unitPriceCents,
            };
          });
          const shipping = estimateShippingCents(
            items.reduce((sum, item) => sum + item.quantity, 0)
          );
          const total = prepared.merchandiseSubtotalCents + shipping;
          const quote: QuoteBreakdown = {
            id: quoteId,
            currency: 'USD',
            productCostCents: 0,
            placementCostCents: 0,
            shippingEstimateCents: shipping,
            taxEstimateCents: 0,
            aiDesignFeeCents: 0,
            paymentFeeCents: 0,
            targetMarginCents: 0,
            studioPassCreditCents: 0,
            subtotalBeforeCreditsCents: total,
            totalCents: total,
            estimateFlags: { shipping: true, tax: true, paymentFee: false },
            costLines: [
              {
                code: 'collection-products',
                label: 'Collection products',
                amountCents: prepared.merchandiseSubtotalCents,
                kind: 'cost',
              },
              {
                code: 'shipping-estimate',
                label: 'Estimated shipping',
                amountCents: shipping,
                kind: 'estimate',
              },
            ],
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            items,
            collection: {
              id: prepared.collectionId,
              version: prepared.publicationVersion,
              layoutRevision: prepared.layoutRevision,
            },
          };
          const manifest: PurchaseManifest = {
            schemaVersion: 1,
            quoteId,
            sessionId: input.sessionId,
            requestHash,
            namespace: storage.namespace,
            origin: {
              collectionId: prepared.collectionId,
              version: prepared.publicationVersion,
              layoutRevision: prepared.layoutRevision,
              reviewDigest: prepared.reviewDigest,
              salesRevision: prepared.salesRevision,
            },
            files,
            quote,
          };
          await getOrCreateDurableSession(input.sessionId);
          await withCollectionLock(async (tx) => {
            await assertPurchaseCurrent(manifest, tx);
            await stagePurchase(manifest, tx);
          });
          // Object creation is immutable. An uncertain/duplicate upload is accepted only after byte verification.
          for (const [index, file] of files.entries()) {
            let matches = false;
            try {
              matches = hash(await storage.read(file.path)) === file.sha256;
            } catch {
              /* A not-yet-created object is expected. */
            }
            if (!matches) {
              try {
                await storage.write(file.path, prepared.files[index].bytes, 'image/png');
              } catch {
                /* Read back to distinguish a completed retry from a failed write. */
              }
              if (hash(await storage.read(file.path)) !== file.sha256) throw unavailable();
            }
          }
          await checkFiles(manifest, storage);
          return await withCollectionLock(async (tx) => {
            await assertPurchaseCurrent(manifest, tx);
            return completePurchase(manifest, tx);
          });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw unavailable();
        }
      });
    },
    async validate(quote: QuoteBreakdown, sessionId?: string): Promise<string | null> {
      if (!quote.collection) return null;
      try {
        const manifest = quote.id && (await readPurchase(quote.id));
        const storage = storageFor();
        if (
          !manifest ||
          !storage ||
          manifest.sessionId !== sessionId ||
          purchaseJson(manifest.quote) !== purchaseJson(quote)
        )
          return 'This collection quote could not be verified. Request it again from the collection.';
        await withCollectionLock((tx) => assertPurchaseCurrent(manifest, tx));
        await checkFiles(manifest, storage);
        return null;
      } catch {
        return 'The collection or its prepared files changed. Request a fresh quote before checkout.';
      }
    },
    async operatorPrint(quote: QuoteBreakdown, assetId: string): Promise<Buffer | null> {
      try {
        const manifest = quote.id && (await readPurchase(quote.id));
        const storage = storageFor();
        if (
          !manifest ||
          !storage ||
          manifest.namespace !== storage.namespace ||
          purchaseJson(manifest.quote) !== purchaseJson(quote)
        )
          return null;
        const file = manifest.files.find((file) => file.assetId === assetId);
        if (!file) return null;
        await storage.assertPrivate();
        const bytes = await storage.read(file.path);
        return hash(bytes) === file.sha256 ? bytes : null;
      } catch {
        return null;
      }
    },
    async providerFiles(quote: QuoteBreakdown): Promise<Record<string, string> | null> {
      try {
        const manifest = quote.id && (await readPurchase(quote.id));
        const storage = storageFor();
        if (!manifest || !storage || purchaseJson(manifest.quote) !== purchaseJson(quote))
          return null;
        await checkFiles(manifest, storage);
        const urls: Record<string, string> = {};
        for (const file of manifest.files)
          urls[file.assetId] = await storage.providerUrl(file.path);
        return urls;
      } catch {
        return null;
      }
    },
  };
}
export const collectionPurchases = createCollectionPurchaseService();
