import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { MAX_QUOTE_ITEM_QUANTITY, MAX_QUOTE_LINE_ITEMS } from '../services/pricing.service.js';
import { withCollectionLock } from './collection-lock.js';
import { readPublications } from './collection-publications.repository.js';
import { publicationOperation } from './collection-publications.service.js';
import { assertPublicationCurrent, renderVerifiedPrint } from './collection-print-source.js';
import { collectionLayoutIssues } from './collection-print-layout-checks.js';
import { layoutPixels, PRINT_DENSITY } from './collection-print-render.js';

type Selection = { itemId: string; quantity: number };
type PurchaseSelection = {
  collectionId: string;
  version: number;
  layoutRevision: number;
  items: Selection[];
};

function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join() === [...keys].sort().join()
  );
}
function selection(value: unknown): PurchaseSelection {
  if (
    !exactObject(value, ['collectionId', 'version', 'layoutRevision', 'items']) ||
    typeof value.collectionId !== 'string' ||
    !value.collectionId ||
    value.collectionId.length > 100 ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !Number.isSafeInteger(value.layoutRevision) ||
    Number(value.layoutRevision) < 1 ||
    !Array.isArray(value.items) ||
    !value.items.length ||
    value.items.length > MAX_QUOTE_LINE_ITEMS ||
    value.items.some(
      (item) =>
        !exactObject(item, ['itemId', 'quantity']) ||
        typeof item.itemId !== 'string' ||
        !item.itemId ||
        item.itemId.length > 100 ||
        !Number.isSafeInteger(item.quantity) ||
        Number(item.quantity) < 1 ||
        Number(item.quantity) > MAX_QUOTE_ITEM_QUANTITY
    ) ||
    new Set(value.items.map((item) => item.itemId)).size !== value.items.length
  )
    throw new HttpError(
      'Select published products and whole-number quantities only.',
      400,
      'invalid_collection_purchase'
    );
  // Detach from the caller before waiting on a lock or storage request.
  return structuredClone(value) as PurchaseSelection;
}

/**
 * Server-only preparation seam for future collection quotes. No route exposes these private bytes.
 * This returns an in-memory candidate, NOT a durable quote, paid-order snapshot, or payment authority.
 * A future caller must persist files and metadata atomically, then revalidate before checkout.
 */
export function prepareCollectionPurchase(value: unknown) {
  return publicationOperation(async () => {
    const input = selection(value);
    if (env.defaultCurrency.toUpperCase() !== 'USD')
      throw new HttpError(
        'Collection purchase preparation currently supports USD only.',
        400,
        'collection_currency_unsupported'
      );
    return withCollectionLock(async (tx) => {
      const entry = (await readPublications(tx)).publications.find(
        (entry) => entry.id === input.collectionId
      );
      if (!entry)
        throw new HttpError('This collection is not published.', 404, 'collection_not_published');
      if (entry.version !== input.version)
        throw new HttpError(
          'The published collection changed. Refresh it before continuing.',
          409,
          'publication_conflict'
        );
      if (!entry.printLayouts || entry.printLayouts.revision !== input.layoutRevision)
        throw new HttpError(
          'Print layouts changed. Refresh them before continuing.',
          409,
          'print_layout_conflict'
        );
      const { catalog } = await assertPublicationCurrent(entry, tx);
      const issues = collectionLayoutIssues(
        entry,
        input.items.map((item) => item.itemId)
      );
      if (issues.length)
        throw new HttpError(issues.join(' '), 409, 'collection_purchase_not_ready');
      // Validate every line before reading or rendering any original.
      const lines = input.items.map(({ itemId, quantity }) => {
        const item = entry.collection.items.find((item) => item.id === itemId)!;
        if (
          !Number.isSafeInteger(item.targetPriceCents) ||
          Number(item.targetPriceCents) < 1 ||
          Number(item.targetPriceCents) > 1_000_000
        )
          throw new HttpError(
            `${item.title}: publish a valid owner price before preparing a purchase.`,
            409,
            'collection_price_missing'
          );
        const product = catalog.find((product) => product.id === item.productId)!;
        const variant = product.variants.find((variant) => variant.id === item.variantId)!;
        if (
          !Number.isSafeInteger(variant.printfulVariantId) ||
          Number(variant.printfulVariantId) < 1
        )
          throw new HttpError(
            `${item.title}: the supplier variant is unavailable.`,
            409,
            'collection_variant_missing'
          );
        const placements = item.placementCodes.map((code) => {
          const placement = product.placements.find((placement) => placement.code === code)!;
          if (!placement.technique || placement.technique.includes('embroidery'))
            throw new HttpError(
              `${item.title}: this print technique is unsupported.`,
              409,
              'collection_technique_unsupported'
            );
          return { code, technique: placement.technique };
        });
        return {
          itemId,
          title: item.title,
          productId: item.productId,
          variantId: item.variantId,
          variantName: variant.name,
          printfulVariantId: variant.printfulVariantId!,
          quantity,
          unitPriceCents: item.targetPriceCents!,
          lineTotalCents: item.targetPriceCents! * quantity,
          placements,
        };
      });
      const tasks = lines.flatMap((line) =>
        line.placements.map((placement) => {
          const layout = entry.printLayouts!.layouts.find(
            (layout) => layout.itemId === line.itemId && layout.placementCode === placement.code
          )!;
          const area = entry.review.areas.find(
            (area) => area.itemId === line.itemId && area.placementCode === placement.code
          )!;
          return { line, placement, layout, area, pixels: layoutPixels(layout, area) };
        })
      );
      if (tasks.reduce((sum, task) => sum + task.pixels.width * task.pixels.height, 0) > 80_000_000)
        throw new HttpError(
          'Prepare fewer print areas at once; this selection exceeds the render limit.',
          413,
          'collection_preparation_too_large'
        );
      const files = [];
      let totalBytes = 0;
      for (const { line, placement, layout, area, pixels } of tasks) {
        const { bytes, sourceChecksum } = await renderVerifiedPrint(layout, area, false, tx);
        totalBytes += bytes.length;
        if (totalBytes > 40 * 1024 * 1024)
          throw new HttpError(
            'Prepare fewer products at once; this selection exceeds the file limit.',
            413,
            'collection_preparation_too_large'
          );
        files.push({
          itemId: line.itemId,
          placementCode: placement.code,
          bytes,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          sourceChecksum,
          sourceAssetId: area.assetId,
          width: pixels.width,
          height: pixels.height,
          density: PRINT_DENSITY,
          contentType: 'image/png' as const,
          layout: structuredClone(layout),
        });
      }
      // Catalog sync is independent of the collection lock. Reject changes during rendering.
      await assertPublicationCurrent(entry, tx);
      return {
        collectionId: entry.id,
        publicationVersion: entry.version,
        layoutRevision: entry.printLayouts.revision,
        reviewDigest: entry.review.digest,
        currency: 'USD' as const,
        merchandiseSubtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
        lines,
        files,
        orderingAvailable: false as const,
      };
    });
  });
}
