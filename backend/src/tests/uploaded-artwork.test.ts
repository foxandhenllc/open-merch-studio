import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  authorizeArtworkUpload,
  completeArtworkUpload,
} from '../services/uploaded-artwork.service.js';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';

const imageDataUrl = async (width: number, height: number) => {
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { r: 20, g: 110, b: 90, alpha: 0.9 } },
  })
    .png()
    .toBuffer();
  return { buffer, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
};

test('fixture upload prepares customer artwork without AI generation', async () => {
  const source = await imageDataUrl(1600, 1400);
  const authorization = await authorizeArtworkUpload({
    filename: 'my-original.png',
    contentType: 'image/png',
    byteSize: source.buffer.byteLength,
    purpose: 'print',
  });
  assert.equal(authorization.transport, 'inline');

  const draft = await completeArtworkUpload({
    assetId: authorization.assetId,
    sessionId: 'upload-fixture-session',
    rightsConfirmed: true,
    placementCodes: ['front'],
    inlineDataUrl: source.dataUrl,
    filename: 'my-original.png',
    contentType: 'image/png',
    purpose: 'print',
  });

  assert.equal(draft.provider, 'upload');
  assert.equal(draft.sourceType, 'uploaded');
  assert.equal(draft.generationStatus, 'complete');
  assert.equal(draft.readiness.status, 'pass');
  assert.equal(draft.printPreparation?.status, 'prepared');
  assert.deepEqual([draft.asset?.width, draft.asset?.height], [1600, 1400]);
  assert.match(draft.imageUrl, /^data:image\/webp;base64,/);
});

test('small uploads are retained for review but blocked from checkout readiness', async () => {
  const source = await imageDataUrl(500, 500);
  const draft = await completeArtworkUpload({
    assetId: 'small-upload-fixture',
    sessionId: 'small-upload-session',
    rightsConfirmed: true,
    placementCodes: ['front'],
    inlineDataUrl: source.dataUrl,
    filename: 'tiny.png',
    contentType: 'image/png',
    purpose: 'print',
  });
  assert.equal(draft.readiness.status, 'blocked');
  assert.match(draft.readiness.checks[0]?.result ?? '', /too small/i);
});

test('uploads require an explicit reproduction-rights confirmation', async () => {
  const source = await imageDataUrl(1200, 1200);
  await assert.rejects(
    completeArtworkUpload({
      assetId: 'rights-fixture',
      sessionId: 'rights-session',
      rightsConfirmed: false,
      inlineDataUrl: source.dataUrl,
      purpose: 'print',
    }),
    /permission to reproduce/i
  );
});

test('customer-supplied artwork removes the design fee without removing margin', () => {
  const product = sampleCatalog.products[0]!;
  const variant = product.variants[0]!;
  const assetId = 'uploaded-artwork-id';
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: [product.placements[0]!.code],
        designAssetId: assetId,
      },
    ],
    undefined,
    { designFeeCentsByAssetId: { [assetId]: 0 } }
  );
  assert.equal(quote.aiDesignFeeCents, 0);
  assert.equal(quote.items[0]?.designFeeCents, 0);
  assert.ok(quote.targetMarginCents > 0);
  assert.equal(quote.costLines.find((line) => line.code === 'design-allocation')?.amountCents, 0);
});
