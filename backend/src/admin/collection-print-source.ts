import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { CollectionPrintLayout, CollectionReview } from '@open-merch-studio/collection-drafts';
import { HttpError } from '../middleware.js';
import type { Publication } from './collection-publications.repository.js';
import { reviewCollectionSnapshot } from './collection-review.js';
import { collectionArtwork } from './collection-artwork.service.js';
import { readArtworkRecord } from './collection-artwork.repository.js';
import { renderCollectionPrint } from './collection-print-render.js';

/** Call under the collection lock; repeat after asynchronous binary work. */
export async function assertPublicationCurrent(entry: Publication, tx?: Prisma.TransactionClient) {
  const widths = entry.review.areas.map(({ itemId, placementCode, widthInches }) => ({
    itemId,
    placementCode,
    widthInches,
  }));
  const result = await reviewCollectionSnapshot(entry.collection, entry.draftRevision, widths, tx);
  if (
    entry.approval?.templateConfirmed !== true ||
    entry.approval?.contentConfirmed !== true ||
    entry.approval?.publicPreviewConfirmed !== true ||
    !result.review.ready ||
    result.review.digest !== entry.review.digest
  )
    throw new HttpError(
      'The approved artwork or catalog changed. Review and republish before preparing print files.',
      409,
      'collection_review_stale'
    );
  return result;
}

export async function renderVerifiedPrint(
  layout: CollectionPrintLayout,
  area: CollectionReview['areas'][number],
  preview: boolean,
  tx?: Prisma.TransactionClient
) {
  const asset = await readArtworkRecord(area.assetId, tx);
  const original = (await collectionArtwork.binary(area.assetId, 'original')).buffer;
  if (!asset?.checksum || createHash('sha256').update(original).digest('hex') !== asset.checksum)
    throw new HttpError(
      'The original file could not be verified. Restore its matching bytes before exporting.',
      409,
      'print_original_mismatch'
    );
  return {
    bytes: await renderCollectionPrint(original, layout, area, preview),
    sourceChecksum: asset.checksum,
  };
}
