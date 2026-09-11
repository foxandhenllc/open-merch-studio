import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { collectionArtwork } from '../admin/collection-artwork.service.js';
import { readCollectionDrafts, saveCollectionDrafts } from '../admin/collection-drafts.service.js';
import {
  prepareCollectionReview,
  publishCollection,
  publicCollection,
  publicationStatus,
  withdrawCollection,
} from '../admin/collection-publications.service.js';
import {
  getCollectionPrintLayouts,
  saveCollectionPrintLayouts,
  exportCollectionPrintLayout,
} from '../admin/collection-print-layouts.js';
import { readArtworkRecord, writeArtworkRecord } from '../admin/collection-artwork.repository.js';

test('print layouts preserve original bytes, place artwork without cropping, persist independently of private edits, and reject stale exports', async () => {
  const previous = { ...env };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  const binary = collectionArtwork.binary;
  try {
    const original = await sharp({
      create: { width: 1200, height: 1400, channels: 4, background: '#265432' },
    })
      .png()
      .toBuffer();
    const { assetId } = await collectionArtwork.authorize({
      filename: 'fixture.png',
      contentType: 'image/png',
      byteSize: original.length,
      rightsConfirmed: true,
    });
    await collectionArtwork.complete(
      assetId,
      `data:image/png;base64,${original.toString('base64')}`
    );
    const before = await readCollectionDrafts();
    const product = before.catalog[0];
    const code = product.placements[0].code;
    const itemId = randomUUID();
    const id = randomUUID();
    let saved = await saveCollectionDrafts(
      [
        {
          id,
          title: 'Print layout test',
          description: '',
          purpose: 'event',
          items: [
            {
              id: itemId,
              title: 'Art tee',
              productId: product.id,
              variantId: product.variants[0].id,
              placementCodes: [code],
              artworkMode: 'fixed',
              targetPriceCents: 3000,
              artwork: [{ assetId, placementCode: code }],
            },
          ],
        },
      ],
      before.revision
    );
    const widths = [{ itemId, placementCode: code, widthInches: 6 }];
    const review = await prepareCollectionReview(id, saved.revision, widths);
    const publication = await publishCollection(id, {
      draftRevision: saved.revision,
      publicationRevision: 0,
      digest: review.digest,
      printWidths: widths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    });
    const layout = {
      itemId,
      placementCode: code,
      templateWidthInches: 8,
      templateHeightInches: 10,
      leftInches: 1,
      topInches: 1,
    };
    const input = {
      version: publication.version,
      revision: 0,
      layouts: [layout],
      templateConfirmed: true,
    };
    assert.equal((await getCollectionPrintLayouts(id, 1)).revision, 0);
    for (const bad of [
      { ...layout, leftInches: 3 },
      { ...layout, templateWidthInches: 0 },
      { ...layout, topInches: -1 },
      { ...layout, templateWidthInches: 48, templateHeightInches: 48 },
      { ...layout, leftInches: null },
      { ...layout, itemId: randomUUID() },
      { ...layout, assetId },
    ])
      await assert.rejects(() => saveCollectionPrintLayouts(id, { ...input, layouts: [bad] }));
    await assert.rejects(() =>
      saveCollectionPrintLayouts(id, { ...input, layouts: [layout, layout] })
    );
    await assert.rejects(() =>
      saveCollectionPrintLayouts(id, { ...input, templateConfirmed: false })
    );
    const state = await saveCollectionPrintLayouts(id, input);
    assert.equal(state.revision, 1);
    assert.deepEqual(state.layouts, [layout]);
    assert.ok(!JSON.stringify(state).includes(assetId));
    assert.equal((await publicCollection(id)).version, 1);
    assert.ok(!JSON.stringify(await publicCollection(id)).includes('printLayouts'));
    await assert.rejects(() => saveCollectionPrintLayouts(id, input), /another session/);
    const rendered = await exportCollectionPrintLayout(id, 1, 1, itemId, code, false);
    const metadata = await sharp(rendered).metadata();
    assert.equal(metadata.width, 2400);
    assert.equal(metadata.height, 3000);
    assert.equal(metadata.density, 300);
    assert.equal(metadata.hasAlpha, true);
    const pixel = async (left: number, top: number) => [
      ...(await sharp(rendered).extract({ left, top, width: 1, height: 1 }).raw().toBuffer()),
    ];
    assert.equal((await pixel(10, 10))[3], 0);
    assert.deepEqual(await pixel(301, 301), [38, 84, 50, 255]);
    assert.equal((await pixel(2101, 301))[3], 0);
    assert.deepEqual((await binary(assetId, 'original')).buffer, original);
    const preview = await sharp(
      await exportCollectionPrintLayout(id, 1, 1, itemId, code, true)
    ).metadata();
    assert.ok(preview.width! <= 800 && preview.height! <= 800);
    saved = await saveCollectionDrafts(
      [{ ...saved.collections[0], title: 'Private changes' }],
      saved.revision
    );
    assert.ok((await exportCollectionPrintLayout(id, 1, 1, itemId, code, true)).length);
    collectionArtwork.binary = async () => ({
      buffer: Buffer.from('changed original'),
      contentType: 'image/png',
    });
    await assert.rejects(
      () => exportCollectionPrintLayout(id, 1, 1, itemId, code, false),
      /matching bytes/
    );
    collectionArtwork.binary = binary;
    const record = (await readArtworkRecord(assetId))!;
    await writeArtworkRecord({ ...record, checksum: 'changed-metadata' }, 'test');
    await assert.rejects(
      () => exportCollectionPrintLayout(id, 1, 1, itemId, code, true),
      /Review and republish/
    );
    await writeArtworkRecord(record, 'test');
    await saveCollectionPrintLayouts(id, {
      ...input,
      revision: 1,
      layouts: [{ ...layout, leftInches: 0 }],
    });
    await assert.rejects(
      () => exportCollectionPrintLayout(id, 1, 1, itemId, code, false),
      /changed/
    );
    const nextReview = await prepareCollectionReview(id, saved.revision, widths);
    const updated = await publishCollection(id, {
      draftRevision: saved.revision,
      publicationRevision: (await publicationStatus()).revision,
      digest: nextReview.digest,
      printWidths: widths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    });
    assert.equal((await getCollectionPrintLayouts(id, updated.version)).layouts.length, 0);
    await assert.rejects(
      () => exportCollectionPrintLayout(id, 1, 2, itemId, code, true),
      /changed/
    );
    await withdrawCollection(id, (await publicationStatus()).revision);
    await assert.rejects(() => getCollectionPrintLayouts(id, updated.version), /not published/);
    await saveCollectionDrafts([], saved.revision);
    await collectionArtwork.remove(assetId);
  } finally {
    collectionArtwork.binary = binary;
    Object.assign(env, previous);
  }
});
