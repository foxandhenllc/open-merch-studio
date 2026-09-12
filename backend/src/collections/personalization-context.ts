import type { ArtworkMode } from '@open-merch-studio/collection-drafts';
import { withCollectionLock } from '../admin/collection-lock.js';
import { readPublications } from '../admin/collection-publications.repository.js';
import { assertPublicationCurrent } from '../admin/collection-print-source.js';
import { collectionSalesEnabled, collectionCommerceMode } from './sales.service.js';
import { HttpError } from '../middleware.js';
export async function personalizationContext(
  input: { collectionId: string; version: number; itemId: string },
  allowed: ArtworkMode[]
) {
  if (collectionCommerceMode() === 'paused')
    throw new HttpError('Ordering is currently paused.', 403, 'checkout_paused');
  return withCollectionLock(async (tx) => {
    const entry = (await readPublications(tx)).publications.find(
      (entry) => entry.id === input.collectionId
    );
    const item = entry?.collection.items.find((item) => item.id === input.itemId);
    if (!entry || !item || entry.version !== input.version || !collectionSalesEnabled(entry))
      throw new HttpError(
        'This collection changed or ordering is paused. Refresh it before preparing artwork.',
        409,
        'collection_purchase_stale'
      );
    if (!allowed.includes(item.artworkMode))
      throw new HttpError(
        'This artwork action is not offered by this product.',
        400,
        'collection_artwork_mode'
      );
    await assertPublicationCurrent(entry, tx);
    return {
      item: structuredClone(item),
      layoutRevision: entry.printLayouts!.revision,
      reviewDigest: entry.review.digest,
      salesRevision: entry.sales!.revision,
    };
  });
}
