import type {
  CollectionPublicationState,
  PublicCollection,
} from '@open-merch-studio/collection-drafts';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { withCollectionLock } from './collection-lock.js';
import { reviewCollection } from './collection-review.js';
import { collectionArtwork } from './collection-artwork.service.js';
import {
  readPublications,
  writePublications,
  type Publication,
} from './collection-publications.repository.js';

const missing = () =>
  new HttpError('This collection is not published.', 404, 'collection_not_published');
export async function publicationOperation<T>(operation: () => Promise<T>) {
  try {
    if (!env.databaseUrl && env.nodeEnv === 'production') throw new Error('Database required.');
    return await operation();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      'Collection publication is unavailable. Your saved work is unchanged; refresh and retry.',
      503,
      'collection_publication_unavailable'
    );
  }
}
const summary = ({ id, title, version, draftRevision, publishedAt, url }: Publication) => ({
  id,
  title,
  version,
  draftRevision,
  publishedAt,
  url,
});
export const publicationStatus = (): Promise<CollectionPublicationState> =>
  publicationOperation(async () => {
    const state = await readPublications();
    return { revision: state.revision, publications: state.publications.map(summary) };
  });
export const prepareCollectionReview = (id: string, revision: unknown, widths: unknown) =>
  publicationOperation(() =>
    withCollectionLock(async (tx) => (await reviewCollection(id, revision, widths, tx)).review)
  );
export const publishCollection = (
  id: string,
  input: {
    draftRevision: unknown;
    publicationRevision: unknown;
    digest: unknown;
    printWidths: unknown;
    templateConfirmed: unknown;
    contentConfirmed: unknown;
    publicPreviewConfirmed: unknown;
  }
) =>
  publicationOperation(() =>
    withCollectionLock(async (tx) => {
      if (
        input.templateConfirmed !== true ||
        input.contentConfirmed !== true ||
        input.publicPreviewConfirmed !== true
      )
        throw new HttpError(
          'Confirm the product template, artwork rights and content, and public preview before publishing.',
          400,
          'collection_approval_required'
        );
      const state = await readPublications(tx);
      if (state.revision !== input.publicationRevision)
        throw new HttpError(
          'Published collections changed in another session. Refresh publication status and review again.',
          409,
          'publication_conflict'
        );
      const { collection, review } = await reviewCollection(
        id,
        input.draftRevision,
        input.printWidths,
        tx
      );
      if (review.digest !== input.digest)
        throw new HttpError(
          'The artwork or catalog changed after review. Review this collection again.',
          409,
          'collection_review_stale'
        );
      if (!review.ready)
        throw new HttpError(review.issues.join(' '), 400, 'collection_review_blocked');
      if (!state.publications.some((entry) => entry.id === id) && state.publications.length >= 20)
        throw new HttpError(
          'Keep at most 20 published collections. Withdraw one before adding another.',
          409,
          'publication_limit'
        );
      // Verify the intended public thumbnails exist while the shared lock prevents artwork removal.
      for (const assetId of new Set(review.areas.map((area) => area.assetId)))
        await collectionArtwork.binary(assetId);
      const version = state.revision + 1;
      const publication: Publication = {
        id,
        title: collection.title,
        version,
        draftRevision: review.draftRevision,
        publishedAt: new Date().toISOString(),
        url: `/collections/${id}`,
        collection,
        review,
        approval: {
          actor: 'store-admin',
          templateConfirmed: true,
          contentConfirmed: true,
          publicPreviewConfirmed: true,
        },
      };
      await writePublications(
        {
          revision: version,
          publications: [...state.publications.filter((entry) => entry.id !== id), publication],
        },
        'collection_preview_published',
        tx
      );
      return summary(publication);
    })
  );
export const withdrawCollection = (id: string, expectedRevision: unknown) =>
  publicationOperation(() =>
    withCollectionLock(async (tx) => {
      const state = await readPublications(tx);
      if (state.revision !== expectedRevision)
        throw new HttpError(
          'Published collections changed. Refresh publication status before withdrawing.',
          409,
          'publication_conflict'
        );
      if (!state.publications.some((entry) => entry.id === id)) throw missing();
      await writePublications(
        {
          revision: state.revision + 1,
          publications: state.publications.filter((entry) => entry.id !== id),
        },
        'collection_preview_withdrawn',
        tx
      );
      return { withdrawn: true };
    })
  );
const publicRecord = (entry: Publication): PublicCollection => ({
  ...summary(entry),
  description: entry.collection.description,
  orderingAvailable: false,
  products: entry.collection.items.map((item) => ({
    id: item.id,
    title: item.title,
    productTitle: entry.review.products.find((product) => product.itemId === item.id)!.productTitle,
    variantName: entry.review.products.find((product) => product.itemId === item.id)!.variantName,
    plannedPriceCents: item.targetPriceCents,
    artwork: entry.review.areas
      .filter((area) => area.itemId === item.id)
      .map((area) => ({
        label: area.label,
        widthInches: area.widthInches,
        heightInches: area.heightInches,
        previewUrl: `/api/collections/${entry.id}/versions/${entry.version}/items/${item.id}/artwork/${encodeURIComponent(area.placementCode)}`,
      })),
  })),
});
export const publicCollections = () =>
  publicationOperation(async () => (await readPublications()).publications.map(publicRecord));
export const publicCollection = (id: string) =>
  publicationOperation(async () => {
    const entry = (await readPublications()).publications.find((item) => item.id === id);
    if (!entry) throw missing();
    return publicRecord(entry);
  });
export const publicCollectionArtwork = (
  id: string,
  version: string,
  itemId: string,
  code: string
) =>
  publicationOperation(async () => {
    const entry = (await readPublications()).publications.find(
      (item) => item.id === id && String(item.version) === version
    );
    const area = entry?.review.areas.find(
      (item) => item.itemId === itemId && item.placementCode === code
    );
    if (!area) throw missing();
    const file = await collectionArtwork.binary(area.assetId);
    // Do not return a thumbnail if publication changed while storage was being read.
    const current = (await readPublications()).publications.find(
      (item) => item.id === id && String(item.version) === version
    );
    if (!current) throw missing();
    return file;
  });
