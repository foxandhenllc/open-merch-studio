import type { CollectionSalesReadiness } from '@open-merch-studio/collection-drafts';
import { HttpError } from '../middleware.js';
import { withCollectionLock } from './collection-lock.js';
import { readPublications } from './collection-publications.repository.js';
import { publicationOperation } from './collection-publications.service.js';
import { reviewCollectionSnapshot } from './collection-review.js';

/** This inspection never creates a quote, copies an original, or authorizes an order. */
export function collectionSalesReadiness(
  id: string,
  expectedVersion: unknown
): Promise<CollectionSalesReadiness> {
  return publicationOperation(() =>
    withCollectionLock(async (tx) => {
      if (!Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 1)
        throw new HttpError(
          'Refresh publication status before checking sales readiness.',
          400,
          'invalid_publication_version'
        );
      const entry = (await readPublications(tx)).publications.find((item) => item.id === id);
      if (!entry)
        throw new HttpError('This collection is not published.', 404, 'collection_not_published');
      if (entry.version !== expectedVersion)
        throw new HttpError(
          'This published collection changed. Refresh publication status and check again.',
          409,
          'publication_conflict'
        );
      const widths = entry.review.areas.map(({ itemId, placementCode, widthInches }) => ({
        itemId,
        placementCode,
        widthInches,
      }));
      const { review } = await reviewCollectionSnapshot(
        entry.collection,
        entry.draftRevision,
        widths,
        tx
      );
      const approved =
        entry.approval?.templateConfirmed === true &&
        entry.approval?.contentConfirmed === true &&
        entry.approval?.publicPreviewConfirmed === true;
      const sourcesMatch = approved && review.ready && review.digest === entry.review.digest;
      const products = entry.collection.items.map((item) => ({
        id: item.id,
        title: item.title,
        priceCents: item.targetPriceCents,
        priceSpecified:
          Number.isSafeInteger(item.targetPriceCents) && Number(item.targetPriceCents) > 0,
      }));
      const priced = products.length > 0 && products.every((product) => product.priceSpecified);
      return {
        collectionId: id,
        version: entry.version,
        checkedAt: new Date().toISOString(),
        orderingAvailable: false,
        products,
        checks: [
          {
            id: 'review',
            label: 'Published artwork and product choices',
            status: sourcesMatch ? 'pass' : 'action_required',
            message: sourcesMatch
              ? 'Catalog and artwork metadata still match the approved version.'
              : review.issues.length
                ? review.issues.join(' ')
                : 'Artwork, rights, or catalog details changed. Review and republish this collection.',
          },
          {
            id: 'price',
            label: 'Owner product prices',
            status: priced ? 'pass' : 'action_required',
            message: priced
              ? 'Every published product has an owner-specified price. Shipping and tax are separate.'
              : 'Set a positive target price for each listed product in its draft, then review and republish.',
          },
          {
            id: 'production',
            label: 'Production placement',
            status: 'not_available',
            message: entry.printLayouts?.layouts.length
              ? `Manual print layouts saved for ${entry.printLayouts.layouts.length} of ${entry.review.areas.length} areas. Preview and export them below. Automatic order placement is still being built.`
              : 'Prepare manual print layouts below. Automatic supplier-template lookup and order placement are still being built.',
          },
          {
            id: 'checkout',
            label: 'Collection checkout',
            status: 'not_available',
            message:
              'Still being built: preserve approved artwork and owner prices through quotes, payment, and reviewed fulfillment.',
          },
        ],
      };
    })
  );
}
