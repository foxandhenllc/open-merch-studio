import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

export async function verifyCollectionPersonalization({ context, origin, viewport, output }) {
  // Dynamic imports preserve admin-smoke's explicit no-provider environment initialization.
  const { env } = await import('../../backend/dist/config/env.js');
  const { collectionArtwork } =
    await import('../../backend/dist/admin/collection-artwork.service.js');
  const { readCollectionDrafts, saveCollectionDrafts } =
    await import('../../backend/dist/admin/collection-drafts.service.js');
  const { prepareCollectionReview, publishCollection, publicationStatus, withdrawCollection } =
    await import('../../backend/dist/admin/collection-publications.service.js');
  const { saveCollectionPrintLayouts } =
    await import('../../backend/dist/admin/collection-print-layouts.js');
  const { setCollectionSales } = await import('../../backend/dist/collections/sales.service.js');
  const { getRuntimeSettings, updateRuntimeSettings } =
    await import('../../backend/dist/services/runtime-store.js');
  const before = env.checkoutEnabled;
  const runtimeBefore = getRuntimeSettings().checkoutEnabled;
  env.checkoutEnabled = true;
  updateRuntimeSettings({ checkoutEnabled: true });
  const guest = await context.newPage();
  let collectionId;
  try {
    const image = await sharp({
      create: { width: 1200, height: 1200, channels: 4, background: '#c89345' },
    })
      .png()
      .toBuffer();
    const auth = await collectionArtwork.authorize({
      filename: 'Community example.png',
      contentType: 'image/png',
      byteSize: image.length,
      rightsConfirmed: true,
    });
    await collectionArtwork.complete(
      auth.assetId,
      `data:image/png;base64,${image.toString('base64')}`
    );
    const state = await readCollectionDrafts();
    const product = state.catalog.find((item) =>
      item.placements.some((area) => area.code === 'front')
    );
    const items = ['upload', 'generate', 'reference'].map((artworkMode) => ({
      id: randomUUID(),
      title: `${artworkMode} edition`,
      productId: product.id,
      variantId: product.variants[0].id,
      placementCodes: ['front'],
      artworkMode,
      targetPriceCents: 3500,
      artwork: [{ placementCode: 'front', assetId: auth.assetId }],
    }));
    collectionId = randomUUID();
    const draft = {
      id: collectionId,
      title: 'Make it personal',
      description: 'A bounded community collection.',
      purpose: 'community',
      items,
    };
    const saved = await saveCollectionDrafts([...state.collections, draft], state.revision);
    const printWidths = items.map((item) => ({
      itemId: item.id,
      placementCode: 'front',
      widthInches: 4,
    }));
    const report = await prepareCollectionReview(collectionId, saved.revision, printWidths);
    assert.equal(report.ready, true, report.issues.join(' '));
    const publication = await publishCollection(collectionId, {
      draftRevision: saved.revision,
      publicationRevision: (await publicationStatus()).revision,
      digest: report.digest,
      printWidths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    });
    await saveCollectionPrintLayouts(collectionId, {
      version: publication.version,
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
    await setCollectionSales(collectionId, {
      version: publication.version,
      layoutRevision: 1,
      enabled: true,
      reviewed: true,
    });
    await guest.goto(`${origin}/collections/${collectionId}`, { waitUntil: 'networkidle' });
    for (const item of items)
      await guest.getByRole('spinbutton', { name: `Quantity · ${item.title}` }).fill('1');
    const upload = guest.getByRole('region', { name: 'Personalize upload edition', exact: true });
    await upload
      .getByLabel('Original artwork', { exact: true })
      .setInputFiles({ name: 'Artist-original.png', mimeType: 'image/png', buffer: image });
    await upload.getByRole('checkbox').check();
    await upload.getByRole('button', { name: 'Use my original' }).click();
    await upload.getByText(/Artwork selected for this product/).waitFor();
    const generation = guest.getByRole('region', {
      name: 'Personalize generate edition',
      exact: true,
    });
    await generation
      .getByLabel('Describe your design')
      .fill('A welcoming fox carrying wildflowers');
    const requests = [];
    let originalId;
    await guest.route(`**/api/collections/${collectionId}/artwork`, async (route) => {
      requests.push(route.request().postDataJSON());
      const response = await route.fetch();
      const body = await response.json();
      if (!originalId) {
        assert.equal(response.status(), 201, JSON.stringify(body));
        originalId = body.data.id;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Connection interrupted after generation',
          }),
        });
      } else {
        assert.equal(body.data.id, originalId);
        await route.fulfill({ response });
      }
    });
    await generation.getByRole('button', { name: 'Generate my design', exact: true }).click();
    await generation.getByRole('alert').filter({ hasText: 'Connection interrupted' }).waitFor();
    await guest.reload({ waitUntil: 'networkidle' });
    await generation
      .getByRole('button', { name: 'Check previous generation', exact: true })
      .click();
    await generation.getByText(/Artwork selected for this product/).waitFor();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    await guest.unroute(`**/api/collections/${collectionId}/artwork`);
    const reference = guest.getByRole('region', {
      name: 'Personalize reference edition',
      exact: true,
    });
    await reference
      .getByLabel('Reference image', { exact: true })
      .setInputFiles({ name: 'Reference.png', mimeType: 'image/png', buffer: image });
    await reference.getByRole('checkbox').check();
    await reference.getByRole('button', { name: 'Prepare reference', exact: true }).click();
    await reference.getByRole('img').waitFor();
    await reference
      .getByLabel('Describe your design')
      .fill('A cheerful community garden inspired by these colors');
    await reference.getByRole('button', { name: 'Generate my design', exact: true }).click();
    await reference.getByText(/Artwork selected for this product/).waitFor();
    let failedPreview = false;
    await guest.route('**/api/collections/quotes/*/preview', async (route) => {
      if (!failedPreview) {
        failedPreview = true;
        await route.fulfill({ status: 503, body: 'Preview interrupted' });
      } else await route.continue();
    });
    const quoteResponse = guest.waitForResponse(
      (response) => response.url().endsWith('/quotes') && response.request().method() === 'POST'
    );
    await guest.getByRole('button', { name: 'Review order', exact: true }).click();
    const response = await quoteResponse;
    const quote = (await response.json()).data;
    assert.equal(response.status(), 201, JSON.stringify(quote));
    assert.ok(
      response
        .request()
        .postDataJSON()
        .items.every((item) => item.designAssetId)
    );
    assert.ok(quote.items.every((item) => item.unitRetailCents === 3500));
    const previews = guest.getByRole('region', { name: 'Saved print previews' });
    await previews.getByRole('alert').waitFor();
    assert.ok(
      await guest.getByRole('button', { name: 'Complete simulated checkout' }).isDisabled()
    );
    await previews.getByRole('button', { name: 'Retry print previews', exact: true }).click();
    await previews.getByRole('img').first().waitFor();
    assert.equal(await previews.getByRole('img').count(), 3);
    await guest.getByLabel('Email for your receipt').fill('customer@example.test');
    await guest.getByRole('checkbox', { name: /I reviewed my saved print previews/ }).check();
    if (output)
      await guest.screenshot({
        path: path.join(output, `personalization-${viewport.width}.png`),
        fullPage: true,
      });
    const dimensions = await guest.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    assert.ok(dimensions[1] <= dimensions[0] + 1);
    await guest.getByRole('button', { name: 'Complete simulated checkout' }).click();
    await guest.waitForURL('**/order/**');
    await guest
      .getByRole('heading', { name: /Your order|Order/ })
      .first()
      .waitFor();
  } finally {
    if (collectionId) await withdrawCollection(collectionId, (await publicationStatus()).revision);
    env.checkoutEnabled = before;
    updateRuntimeSettings({ checkoutEnabled: runtimeBefore });
    await guest.close();
  }
}
