import { getDesignAssetImage } from '../services/design.service.js';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
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
import { saveCollectionPrintLayouts } from '../admin/collection-print-layouts.js';
import { setCollectionSales } from '../collections/sales.service.js';
import {
  completeArtworkUpload,
  deleteArtworkUpload,
} from '../services/uploaded-artwork.service.js';
import { generateCollectionArtwork } from '../collections/personalization-generation.js';
import {
  readPersonalizedArtwork,
  renderPersonalizedPrint,
} from '../collections/personalized-artwork.js';
import { prepareCollectionPurchase } from '../admin/collection-purchase-preparation.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { collectionPurchases } from '../collections/purchase.service.js';
import { checkoutDesignIssue } from '../services/checkout-validation.service.js';
import { collectionPurchasePreview } from '../collections/purchase-preview.js';

test('collection modes bind session-owned source artwork to owner layouts and prices; generation retries do not generate twice', async () => {
  const previous = { ...env };
  Object.assign(env, {
    databaseUrl: undefined,
    nodeEnv: 'test',
    enableLiveStripe: false,
    enableLiveOpenAi: false,
    checkoutEnabled: true,
    defaultCurrency: 'USD',
    studioPassEnabled: false,
  });
  const variant = sampleCatalog.products.find((product) =>
    product.placements.some((area) => area.code === 'front')
  )!.variants[0];
  const oldSupplier = variant.printfulVariantId;
  variant.printfulVariantId = 12345;
  try {
    const ownerBytes = await sharp({
      create: { width: 1200, height: 1200, channels: 4, background: '#315542' },
    })
      .png()
      .toBuffer();
    const auth = await collectionArtwork.authorize({
      filename: 'Owner example.png',
      contentType: 'image/png',
      byteSize: ownerBytes.length,
      rightsConfirmed: true,
    });
    await collectionArtwork.complete(
      auth.assetId,
      `data:image/png;base64,${ownerBytes.toString('base64')}`
    );
    const state = await readCollectionDrafts();
    const product = state.catalog.find((product) =>
      product.placements.some((area) => area.code === 'front')
    )!;
    const modes = ['fixed', 'upload', 'generate', 'reference'] as const;
    const items = modes.map((artworkMode) => ({
      id: randomUUID(),
      title: `Product ${artworkMode}`,
      productId: product.id,
      variantId: product.variants[0].id,
      placementCodes: ['front'],
      artworkMode,
      targetPriceCents: 3500,
      artwork: [{ placementCode: 'front', assetId: auth.assetId }],
    }));
    const id = randomUUID();
    const saved = await saveCollectionDrafts(
      [{ id, title: 'Community personalization', description: '', purpose: 'community', items }],
      state.revision
    );
    const printWidths = items.map((item) => ({
      itemId: item.id,
      placementCode: 'front',
      widthInches: 4,
    }));
    const review = await prepareCollectionReview(id, saved.revision, printWidths);
    assert.equal(review.ready, true, review.issues.join(' '));
    const published = await publishCollection(id, {
      draftRevision: saved.revision,
      publicationRevision: (await publicationStatus()).revision,
      digest: review.digest,
      printWidths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    });
    const version = published.version;
    await saveCollectionPrintLayouts(id, {
      version,
      revision: 0,
      layouts: items.map((item) => ({
        itemId: item.id,
        placementCode: 'front',
        templateWidthInches: 8,
        templateHeightInches: 10,
        leftInches: 2,
        topInches: 2,
      })),
      templateConfirmed: true,
    });
    await setCollectionSales(id, { version, layoutRevision: 1, enabled: true, reviewed: true });
    assert.deepEqual(
      (await publicCollection(id)).products.map((item) => item.artworkMode),
      modes
    );
    const sessionId = randomUUID();
    const original = await sharp({
      create: { width: 1200, height: 600, channels: 4, background: '#e4a329' },
    })
      .png()
      .toBuffer();
    const upload = await completeArtworkUpload({
      assetId: randomUUID(),
      sessionId,
      rightsConfirmed: true,
      purpose: 'collection',
      inlineDataUrl: `data:image/png;base64,${original.toString('base64')}`,
      filename: 'Artist original.png',
      contentType: 'image/png',
    });
    assert.equal(
      await getDesignAssetImage(upload.id!),
      null,
      'Uploaded previews are not exposed by the public generated-image route'
    );
    assert.match(
      checkoutDesignIssue({
        id: upload.id!,
        purpose: 'collection',
        generationStatus: 'complete',
        policyStatus: 'pass',
        readinessStatus: 'pass',
      })!,
      /through its collection/
    );
    assert.deepEqual(
      (await readPersonalizedArtwork(upload.id!, sessionId, 'upload')).bytes,
      original
    );
    await assert.rejects(() => readPersonalizedArtwork(upload.id!, randomUUID(), 'upload'));
    await assert.rejects(() => readPersonalizedArtwork(upload.id!, sessionId, 'generate'));
    const input = {
      collectionId: id,
      version,
      layoutRevision: 1,
      items: [{ itemId: items[1].id, quantity: 2, designAssetId: upload.id! }],
    };
    const prepared = await prepareCollectionPurchase(input, sessionId);
    assert.equal(prepared.merchandiseSubtotalCents, 7000);
    assert.equal(
      prepared.files[0].sourceChecksum,
      createHash('sha256').update(original).digest('hex')
    );
    const image = sharp(prepared.files[0].bytes);
    assert.equal((await image.metadata()).density, 300);
    const pixel = async (left: number, top: number) => [
      ...(await sharp(prepared.files[0].bytes)
        .extract({ left, top, width: 1, height: 1 })
        .raw()
        .toBuffer()),
    ];
    assert.equal(
      (await pixel(600, 700)).at(-1),
      0,
      'The landscape original leaves centered padding inside the square owner box'
    );
    assert.equal((await pixel(600, 1000)).at(-1), 255);
    for (const selection of [
      { ...input, items: [{ itemId: items[0].id, quantity: 1, designAssetId: upload.id! }] },
      { ...input, items: [{ itemId: items[1].id, quantity: 1 }] },
      { ...input, items: [{ itemId: items[2].id, quantity: 1, designAssetId: upload.id! }] },
    ])
      await assert.rejects(() => prepareCollectionPurchase(selection, sessionId));
    await assert.rejects(() => prepareCollectionPurchase(input, randomUUID()));
    const request = {
      collectionId: id,
      version,
      itemId: items[2].id,
      sessionId,
      requestId: randomUUID(),
      prompt: 'A friendly fox with wildflowers',
    };
    const generated = await generateCollectionArtwork(request);
    assert.equal(generated.sourceType, 'generated');
    assert.equal((await generateCollectionArtwork(request)).id, generated.id);
    await assert.rejects(
      () => generateCollectionArtwork({ ...request, prompt: 'Changed prompt' }),
      /new request/
    );
    await assert.rejects(
      () => generateCollectionArtwork({ ...request, requestId: randomUUID(), itemId: items[0].id }),
      /not offered/
    );
    await assert.rejects(
      () =>
        generateCollectionArtwork({
          ...request,
          requestId: randomUUID(),
          itemId: items[3].id,
          referenceAssetId: upload.id!,
        }),
      /Upload your reference/
    );
    const reference = await completeArtworkUpload({
      assetId: randomUUID(),
      sessionId,
      rightsConfirmed: true,
      purpose: 'reference',
      inlineDataUrl: `data:image/png;base64,${original.toString('base64')}`,
    });
    const fromReference = await generateCollectionArtwork({
      ...request,
      requestId: randomUUID(),
      itemId: items[3].id,
      referenceAssetId: reference.id!,
    });
    assert.equal(fromReference.sourceType, 'reference_generated');
    await prepareCollectionPurchase(
      { ...input, items: [{ itemId: items[3].id, quantity: 1, designAssetId: fromReference.id! }] },
      sessionId
    );
    const quote = await collectionPurchases.create({
      selection: input,
      sessionId,
      requestId: randomUUID(),
    });
    const assetId = quote.items[0].designAssetId!;
    const preview = await collectionPurchasePreview(quote.id!, { sessionId, assetId });
    assert.ok((await sharp(preview).metadata()).width! <= 800);
    await assert.rejects(() =>
      collectionPurchasePreview(quote.id!, { sessionId: randomUUID(), assetId })
    );
    await assert.rejects(() =>
      collectionPurchasePreview(quote.id!, { sessionId, assetId: randomUUID() })
    );
    await deleteArtworkUpload({ assetId: upload.id!, sessionId });
    await assert.rejects(() => readPersonalizedArtwork(upload.id!, sessionId, 'upload'));
    assert.deepEqual(
      await collectionPurchasePreview(quote.id!, { sessionId, assetId }),
      preview,
      'Saved quote files survive temporary upload deletion'
    );
    assert.deepEqual((await collectionArtwork.binary(auth.assetId, 'original')).buffer, ownerBytes);
    const tiny = await sharp({
      create: { width: 30, height: 30, channels: 4, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      () => renderPersonalizedPrint(tiny, prepared.files[0].layout, review.areas[0]),
      /too small/
    );
    await withdrawCollection(id, (await publicationStatus()).revision);
    await assert.rejects(() => generateCollectionArtwork(request), /changed or ordering is paused/);
  } finally {
    Object.assign(env, previous);
    variant.printfulVariantId = oldSupplier;
  }
});
