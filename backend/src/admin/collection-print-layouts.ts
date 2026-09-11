import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  CollectionPrintLayout,
  CollectionPrintLayouts,
} from '@open-merch-studio/collection-drafts';
import { HttpError } from '../middleware.js';
import { withCollectionLock } from './collection-lock.js';
import {
  readPublications,
  writePublications,
  type Publication,
} from './collection-publications.repository.js';
import { publicationOperation } from './collection-publications.service.js';
import { reviewCollectionSnapshot } from './collection-review.js';
import { collectionArtwork } from './collection-artwork.service.js';
import { readArtworkRecord } from './collection-artwork.repository.js';
import { layoutPixels, renderCollectionPrint } from './collection-print-render.js';

async function selected(id: string, version: unknown, tx?: Prisma.TransactionClient) {
  const state = await readPublications(tx);
  const entry = state.publications.find((item) => item.id === id);
  if (!entry)
    throw new HttpError('This collection is not published.', 404, 'collection_not_published');
  if (!Number.isSafeInteger(version) || entry.version !== version)
    throw new HttpError(
      'The published collection changed. Refresh publication status and reopen its layouts.',
      409,
      'publication_conflict'
    );
  return { state, entry };
}
async function current(entry: Publication, tx?: Prisma.TransactionClient) {
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
  if (!review.ready || review.digest !== entry.review.digest)
    throw new HttpError(
      'The approved artwork or catalog changed. Review and republish before preparing print layouts.',
      409,
      'collection_review_stale'
    );
}
const snapshot = (entry: Publication): CollectionPrintLayouts => ({
  version: entry.version,
  revision: entry.printLayouts?.revision ?? 0,
  layouts: entry.printLayouts?.layouts ?? [],
  areas: entry.review.areas.map(
    ({ itemId, placementCode, label, widthInches, heightInches, pixelsPerInch }) => ({
      itemId,
      placementCode,
      label,
      widthInches,
      heightInches,
      pixelsPerInch,
    })
  ),
});
export const getCollectionPrintLayouts = (id: string, version: unknown) =>
  publicationOperation(() =>
    withCollectionLock(async (tx) => snapshot((await selected(id, version, tx)).entry))
  );

export const saveCollectionPrintLayouts = (
  id: string,
  input: { version: unknown; revision: unknown; layouts: unknown; templateConfirmed: unknown }
) =>
  publicationOperation(() =>
    withCollectionLock(async (tx) => {
      const { state, entry } = await selected(id, input.version, tx);
      if (input.revision !== (entry.printLayouts?.revision ?? 0))
        throw new HttpError(
          'Print layouts changed in another session. Reopen the saved layouts before trying again.',
          409,
          'print_layout_conflict'
        );
      if (input.templateConfirmed !== true)
        throw new HttpError(
          'Confirm that these dimensions and offsets match the selected product templates.',
          400,
          'print_template_confirmation_required'
        );
      if (
        !Array.isArray(input.layouts) ||
        input.layouts.length > entry.review.areas.length ||
        input.layouts.some(
          (layout) =>
            !layout ||
            typeof layout !== 'object' ||
            Object.keys(layout).sort().join() !==
              'itemId,leftInches,placementCode,templateHeightInches,templateWidthInches,topInches'
        )
      )
        throw new HttpError('Invalid print layouts.', 400, 'invalid_print_layout');
      const layouts = input.layouts as CollectionPrintLayout[];
      const keys = layouts.map((layout) => `${layout.itemId}:${layout.placementCode}`);
      if (new Set(keys).size !== keys.length)
        throw new HttpError('Save one layout per print area.', 400, 'invalid_print_layout');
      for (const layout of layouts) {
        const area = entry.review.areas.find(
          (area) => area.itemId === layout.itemId && area.placementCode === layout.placementCode
        );
        if (!area)
          throw new HttpError('Select a published print area.', 400, 'invalid_print_layout');
        layoutPixels(layout, area);
      }
      await current(entry, tx);
      entry.printLayouts = {
        revision: (entry.printLayouts?.revision ?? 0) + 1,
        layouts,
        templateConfirmedAt: new Date().toISOString(),
      };
      await writePublications(
        { ...state, revision: state.revision + 1 },
        'collection_print_layouts_saved',
        tx
      );
      return snapshot(entry);
    })
  );

export const exportCollectionPrintLayout = (
  id: string,
  version: unknown,
  revision: unknown,
  itemId: string,
  code: string,
  preview: boolean
) =>
  publicationOperation(() =>
    withCollectionLock(async (tx) => {
      const { entry } = await selected(id, version, tx);
      if (!entry.printLayouts || revision !== entry.printLayouts.revision)
        throw new HttpError(
          'Print layouts changed. Reopen them before previewing or downloading.',
          409,
          'print_layout_conflict'
        );
      await current(entry, tx);
      const layout = entry.printLayouts.layouts.find(
        (layout) => layout.itemId === itemId && layout.placementCode === code
      );
      const area = entry.review.areas.find(
        (area) => area.itemId === itemId && area.placementCode === code
      );
      if (!layout || !area)
        throw new HttpError('Save a layout for this area first.', 404, 'print_layout_missing');
      const asset = await readArtworkRecord(area.assetId, tx);
      const original = (await collectionArtwork.binary(area.assetId, 'original')).buffer;
      if (
        !asset?.checksum ||
        createHash('sha256').update(original).digest('hex') !== asset.checksum
      )
        throw new HttpError(
          'The original file could not be verified. Restore its matching bytes before exporting.',
          409,
          'print_original_mismatch'
        );
      const rendered = await renderCollectionPrint(original, layout, area, preview);
      await current(entry, tx);
      return rendered;
    })
  );
