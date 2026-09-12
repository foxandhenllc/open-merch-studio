import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  CollectionDraft,
  CollectionReview,
  PrintWidth,
} from '@open-merch-studio/collection-drafts';
import { readCollectionDrafts } from './collection-drafts.service.js';
import { readArtworkRecord } from './collection-artwork.repository.js';
import { listCollectionCatalog } from '../services/catalog.service.js';
import { HttpError } from '../middleware.js';

export async function reviewCollection(
  id: string,
  revision: unknown,
  input: unknown,
  tx?: Prisma.TransactionClient
) {
  if (
    !Array.isArray(input) ||
    input.length > 120 ||
    input.some(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        Object.keys(entry).sort().join() !== 'itemId,placementCode,widthInches' ||
        typeof entry.itemId !== 'string' ||
        typeof entry.placementCode !== 'string' ||
        !Number.isFinite(entry.widthInches) ||
        entry.widthInches < 0.25 ||
        entry.widthInches > 48
    )
  )
    throw new HttpError(
      'Enter an intended print width between 0.25 and 48 inches for every area.',
      400,
      'invalid_print_widths'
    );
  const widths = input as PrintWidth[];
  const snapshot = await readCollectionDrafts(tx);
  if (revision !== snapshot.revision)
    throw new HttpError(
      'Collection drafts changed. Save or reload them before reviewing again.',
      409,
      'collection_review_stale'
    );
  const collection = snapshot.collections.find((entry) => entry.id === id);
  if (!collection)
    throw new HttpError('Save this collection before reviewing it.', 404, 'collection_not_found');
  return reviewCollectionSnapshot(collection, snapshot.revision, widths, tx);
}

/** Review the published snapshot independently of any later private draft edits. */
export async function reviewCollectionSnapshot(
  collection: CollectionDraft,
  revision: number,
  widths: PrintWidth[],
  tx?: Prisma.TransactionClient
) {
  const id = collection.id;
  const keys = widths.map((entry) => `${entry.itemId}:${entry.placementCode}`);
  const selectedKeys = collection.items.flatMap((item) =>
    item.placementCodes.map((code) => `${item.id}:${code}`)
  );
  if (new Set(keys).size !== keys.length || keys.some((key) => !selectedKeys.includes(key)))
    throw new HttpError(
      'Enter one width for each selected print area.',
      400,
      'invalid_print_widths'
    );
  const catalog = structuredClone(await listCollectionCatalog(tx));
  const issues: string[] = [];
  const areas: CollectionReview['areas'] = [];
  const products: CollectionReview['products'] = [];
  const fingerprints: unknown[] = [];
  if (!collection.items.length) issues.push('Add at least one product.');
  for (const item of collection.items) {
    const product = catalog.find((entry) => entry.id === item.productId && entry.isSellable);
    const variant = product?.variants.find(
      (entry) => entry.id === item.variantId && entry.isAvailable
    );
    if (!product || !variant) {
      issues.push(`${item.title}: select an available product and variant.`);
      continue;
    }
    products.push({
      itemId: item.id,
      title: item.title,
      productTitle: product.title,
      variantName: variant.name,
    });
    fingerprints.push({
      product: {
        ...product,
        variants: [...product.variants].sort((a, b) => a.id.localeCompare(b.id)),
        placements: [...product.placements].sort((a, b) => a.code.localeCompare(b.code)),
      },
      variant,
    });
    for (const code of item.placementCodes) {
      const placement = product.placements.find((entry) => entry.code === code);
      const binding = item.artwork?.find((entry) => entry.placementCode === code);
      const asset = binding && (await readArtworkRecord(binding.assetId, tx));
      const width = widths.find(
        (entry) => entry.itemId === item.id && entry.placementCode === code
      );
      const label = `${item.title} · ${placement?.displayName ?? code}`;
      if (!placement) issues.push(`${label}: this print area is unavailable.`);
      if (placement?.technique.includes('embroidery'))
        issues.push(`${label}: embroidery requires its own digitization and review workflow.`);
      if (
        !asset ||
        asset.status !== 'complete' ||
        !asset.width ||
        !asset.height ||
        !asset.checksum
      ) {
        issues.push(`${label}: attach a prepared original.`);
        continue;
      }
      fingerprints.push({
        id: asset.id,
        checksum: asset.checksum,
        namespace: asset.namespace,
        width: asset.width,
        height: asset.height,
        rightsConfirmedAt: asset.rightsConfirmedAt,
      });
      if (!width) {
        issues.push(`${label}: enter the intended print width from the product template.`);
        continue;
      }
      const ppi = asset.width / width.widthInches;
      if (asset.readiness === 'blocked' || ppi < 150)
        issues.push(
          `${label}: use a larger original or a smaller print size; at least 150 pixels per inch is required.`
        );
      const heightInches = (width.widthInches * asset.height) / asset.width;
      if (heightInches > 48) issues.push(`${label}: the intended print height exceeds 48 inches.`);
      areas.push({
        ...width,
        assetId: asset.id,
        label,
        filename: asset.filename,
        widthPixels: asset.width,
        heightPixels: asset.height,
        heightInches: Math.round(heightInches * 100) / 100,
        pixelsPerInch: Math.floor(ppi),
        ...(ppi < 300
          ? {
              warning:
                'Below 300 pixels per inch. Check fine detail carefully; paper prints benefit from higher resolution.',
            }
          : {}),
      });
    }
  }
  // JSONB reorders object keys. Hash semantic content so restart does not invalidate approval.
  const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, entry: unknown) =>
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
        : entry
    );
  const digest = createHash('sha256')
    .update(
      canonical({
        collection,
        revision,
        widths: [...widths].sort((a, b) =>
          `${a.itemId}:${a.placementCode}`.localeCompare(`${b.itemId}:${b.placementCode}`)
        ),
        fingerprints,
      })
    )
    .digest('hex');
  const review: CollectionReview = {
    collectionId: id,
    draftRevision: revision,
    digest,
    ready: !issues.length,
    issues,
    products,
    areas,
  };
  return { collection, review, catalog };
}
