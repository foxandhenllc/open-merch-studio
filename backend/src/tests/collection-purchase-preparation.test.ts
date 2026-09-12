import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { collectionArtwork } from '../admin/collection-artwork.service.js';
import { readCollectionDrafts, saveCollectionDrafts } from '../admin/collection-drafts.service.js';
import {
  prepareCollectionReview,
  publishCollection,
  publicationStatus,
  withdrawCollection,
  publicCollection,
} from '../admin/collection-publications.service.js';
import { saveCollectionPrintLayouts } from '../admin/collection-print-layouts.js';
import {
  readPublications,
  writePublications,
} from '../admin/collection-publications.repository.js';
import { collectionSalesReadiness } from '../admin/collection-sales-readiness.js';
import { prepareCollectionPurchase } from '../admin/collection-purchase-preparation.js';

test('collection purchase preparation binds owner prices and distinct print files, rejecting tampering and drift without enabling commerce', async () => {
  const previous = { ...env };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.defaultCurrency = 'USD';
  const binary = collectionArtwork.binary;
  const fixtureVariant = sampleCatalog.products.find(
    (product) =>
      product.placements.some((area) => area.code === 'front') &&
      product.placements.some((area) => area.code === 'back')
  )!.variants[0];
  const previousSupplierId = fixtureVariant.printfulVariantId;
  fixtureVariant.printfulVariantId = 12345; // Synthetic mapping; no provider is contacted.
  try {
    const assets = [];
    for (const color of ['#256743', '#563289']) {
      const bytes = await sharp({
        create: { width: 600, height: 600, channels: 4, background: color },
      })
        .png()
        .toBuffer();
      const { assetId } = await collectionArtwork.authorize({
        filename: 'private-original.png',
        contentType: 'image/png',
        byteSize: bytes.length,
        rightsConfirmed: true,
      });
      await collectionArtwork.complete(
        assetId,
        `data:image/png;base64,${bytes.toString('base64')}`
      );
      assets.push({ assetId, bytes });
    }
    const before = await readCollectionDrafts();
    const product = before.catalog.find(
      (product) =>
        product.placements.some((area) => area.code === 'front') &&
        product.placements.some((area) => area.code === 'back')
    )!;
    const id = randomUUID();
    const itemId = randomUUID();
    let saved = await saveCollectionDrafts(
      [
        {
          id,
          title: 'Owner-priced collection',
          purpose: 'drop',
          description: '',
          items: [
            {
              id: itemId,
              title: 'Two-sided edition',
              productId: product.id,
              variantId: product.variants[0].id,
              placementCodes: ['front', 'back'],
              artworkMode: 'fixed',
              targetPriceCents: 4321,
              artwork: assets.map((asset, index) => ({
                assetId: asset.assetId,
                placementCode: index ? 'back' : 'front',
              })),
            },
          ],
        },
      ],
      before.revision
    );
    const widths = ['front', 'back'].map((placementCode) => ({
      itemId,
      placementCode,
      widthInches: 2,
    }));
    const publish = async () => {
      const review = await prepareCollectionReview(id, saved.revision, widths);
      return publishCollection(id, {
        draftRevision: saved.revision,
        publicationRevision: (await publicationStatus()).revision,
        digest: review.digest,
        printWidths: widths,
        templateConfirmed: true,
        contentConfirmed: true,
        publicPreviewConfirmed: true,
      });
    };
    const publication = await publish();
    const layouts = widths.map(({ itemId, placementCode }) => ({
      itemId,
      placementCode,
      templateWidthInches: 3,
      templateHeightInches: 4,
      leftInches: 0.5,
      topInches: 1,
    }));
    const request = {
      collectionId: id,
      version: publication.version,
      layoutRevision: 1,
      items: [{ itemId, quantity: 3 }],
    };
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'print_layout_conflict',
    });
    await saveCollectionPrintLayouts(id, {
      version: publication.version,
      revision: 0,
      layouts: layouts.slice(0, 1),
      templateConfirmed: true,
    });
    await assert.rejects(() => prepareCollectionPurchase(request), /back: save and confirm/);
    assert.match(
      (await collectionSalesReadiness(id, publication.version)).checks.find(
        (check) => check.id === 'layouts'
      )!.message,
      /back: save and confirm/
    );
    await saveCollectionPrintLayouts(id, {
      version: publication.version,
      revision: 1,
      layouts,
      templateConfirmed: true,
    });
    request.layoutRevision = 2;
    assert.equal(
      (await collectionSalesReadiness(id, publication.version)).checks.find(
        (check) => check.id === 'layouts'
      )!.status,
      'pass'
    );
    const stateBefore = await readPublications();
    const prepared = await prepareCollectionPurchase(request);
    assert.equal(prepared.orderingAvailable, false);
    assert.equal(prepared.currency, 'USD');
    assert.equal(prepared.merchandiseSubtotalCents, 12963);
    assert.equal(prepared.lines[0].unitPriceCents, 4321);
    assert.equal(
      prepared.lines[0].printfulVariantId,
      sampleCatalog.products.find((item) => item.id === product.id)!.variants[0].printfulVariantId
    );
    assert.deepEqual(
      prepared.lines[0].placements.map((area) => area.code),
      ['front', 'back']
    );
    assert.equal(prepared.files.length, 2, 'Quantity must not duplicate rendering');
    assert.notEqual(prepared.files[0].sha256, prepared.files[1].sha256);
    for (const [index, file] of prepared.files.entries()) {
      assert.equal(file.sha256, createHash('sha256').update(file.bytes).digest('hex'));
      assert.equal(
        file.sourceChecksum,
        createHash('sha256').update(assets[index].bytes).digest('hex')
      );
      const metadata = await sharp(file.bytes).metadata();
      assert.deepEqual([metadata.width, metadata.height, metadata.density], [900, 1200, 300]);
      assert.deepEqual(
        (await binary(assets[index].assetId, 'original')).buffer,
        assets[index].bytes
      );
    }
    assert.deepEqual(
      await readPublications(),
      stateBefore,
      'Preparation must not persist or mutate publication'
    );
    assert.equal((await publicCollection(id)).orderingAvailable, false);
    assert.ok(
      !JSON.stringify(await publicCollection(id)).includes(prepared.files[0].sourceChecksum)
    );

    // Invalid input cannot trigger expensive reads, and unknown prices/assets cannot be supplied.
    let reads = 0;
    collectionArtwork.binary = async (...args) => {
      reads += 1;
      return binary(...args);
    };
    for (const invalid of [
      { ...request, priceCents: 1 },
      { ...request, files: [] },
      { ...request, version: '1' },
      { ...request, items: [] },
      { ...request, items: [...request.items, ...request.items] },
      { ...request, items: [{ itemId: randomUUID(), quantity: 1 }] },
      ...[0, -1, 1.2, 26, '2', null].map((quantity) => ({
        ...request,
        items: [{ itemId, quantity }],
      })),
      { ...request, items: [{ itemId, quantity: 1, unitPriceCents: 1 }] },
      { ...request, items: [{ itemId, quantity: 1, assetId: assets[1].assetId }] },
    ])
      await assert.rejects(() => prepareCollectionPurchase(invalid));
    assert.equal(reads, 0);
    env.defaultCurrency = 'EUR';
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'collection_currency_unsupported',
    });
    env.defaultCurrency = 'USD';
    await assert.rejects(() => prepareCollectionPurchase({ ...request, version: 99 }), {
      errorCode: 'publication_conflict',
    });
    await assert.rejects(() => prepareCollectionPurchase({ ...request, layoutRevision: 1 }), {
      errorCode: 'print_layout_conflict',
    });

    // Private draft pricing cannot silently change what a customer selected from publication.
    saved = await saveCollectionDrafts(
      [
        {
          ...saved.collections[0],
          items: saved.collections[0].items.map((item) => ({ ...item, targetPriceCents: 9999 })),
        },
      ],
      saved.revision
    );
    assert.equal((await prepareCollectionPurchase(request)).lines[0].unitPriceCents, 4321);
    prepared.lines[0].unitPriceCents = 1;
    prepared.files[0].bytes.fill(0);
    assert.equal((await prepareCollectionPurchase(request)).lines[0].unitPriceCents, 4321);

    collectionArtwork.binary = async () => ({
      buffer: Buffer.from('tampered'),
      contentType: 'image/png',
    });
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'print_original_mismatch',
    });
    // Catalog drift while a file is being read suppresses the entire result, including already-rendered areas.
    const variant = sampleCatalog.products.find((item) => item.id === product.id)!.variants[0];
    const available = variant.isAvailable;
    try {
      collectionArtwork.binary = async (...args) => {
        const file = await binary(...args);
        variant.isAvailable = false;
        return file;
      };
      await assert.rejects(() => prepareCollectionPurchase(request), {
        errorCode: 'collection_review_stale',
      });
    } finally {
      variant.isAvailable = available;
      collectionArtwork.binary = binary;
    }
    // Corrupt stored dimensions must be caught by readiness and rejected before reading sources.
    const corrupted = structuredClone(stateBefore);
    corrupted.publications[0].printLayouts!.layouts[0].leftInches = 30;
    await writePublications(corrupted, 'test');
    assert.equal(
      (await collectionSalesReadiness(id, publication.version)).checks.find(
        (check) => check.id === 'layouts'
      )!.status,
      'action_required'
    );
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'collection_purchase_not_ready',
    });
    await writePublications(stateBefore, 'test');

    // A changed layout invalidates the old request even when publication version stays the same.
    await saveCollectionPrintLayouts(id, {
      version: publication.version,
      revision: 2,
      layouts: layouts.map((layout) => ({ ...layout, leftInches: 0 })),
      templateConfirmed: true,
    });
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'print_layout_conflict',
    });
    const replacement = await publish();
    assert.ok(replacement.version > publication.version);
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'publication_conflict',
    });
    // Validate all prices and the total render budget before reading the first original.
    const secondId = randomUUID();
    saved = await saveCollectionDrafts(
      [
        {
          ...saved.collections[0],
          items: [
            saved.collections[0].items[0],
            {
              ...saved.collections[0].items[0],
              id: secondId,
              title: 'Second edition',
              targetPriceCents: null,
            },
          ],
        },
      ],
      saved.revision
    );
    widths.push(
      ...['front', 'back'].map((placementCode) => ({
        itemId: secondId,
        placementCode,
        widthInches: 2,
      }))
    );
    let twoProducts = await publish();
    const bothLayouts = [...layouts, ...layouts.map((layout) => ({ ...layout, itemId: secondId }))];
    await saveCollectionPrintLayouts(id, {
      version: twoProducts.version,
      revision: 0,
      layouts: bothLayouts,
      templateConfirmed: true,
    });
    reads = 0;
    collectionArtwork.binary = async (...args) => {
      reads += 1;
      return binary(...args);
    };
    const twoRequests = {
      ...request,
      version: twoProducts.version,
      layoutRevision: 1,
      items: [
        { itemId, quantity: 1 },
        { itemId: secondId, quantity: 1 },
      ],
    };
    await assert.rejects(() => prepareCollectionPurchase(twoRequests), {
      errorCode: 'collection_price_missing',
    });
    assert.equal(reads, 0);
    assert.equal(
      (await prepareCollectionPurchase({ ...twoRequests, items: [{ itemId, quantity: 25 }] }))
        .merchandiseSubtotalCents,
      249975
    );
    saved = await saveCollectionDrafts(
      [
        {
          ...saved.collections[0],
          items: saved.collections[0].items.map((item) => ({ ...item, targetPriceCents: 5000 })),
        },
      ],
      saved.revision
    );
    twoProducts = await publish();
    await saveCollectionPrintLayouts(id, {
      version: twoProducts.version,
      revision: 0,
      layouts: bothLayouts.map((layout) => ({
        ...layout,
        templateWidthInches: 20,
        templateHeightInches: 20,
      })),
      templateConfirmed: true,
    });
    reads = 0;
    await assert.rejects(
      () => prepareCollectionPurchase({ ...twoRequests, version: twoProducts.version }),
      { errorCode: 'collection_preparation_too_large' }
    );
    assert.equal(reads, 0);
    await withdrawCollection(id, (await publicationStatus()).revision);
    await assert.rejects(() => prepareCollectionPurchase(request), {
      errorCode: 'collection_not_published',
    });
    await saveCollectionDrafts([], saved.revision);
    for (const asset of assets) await collectionArtwork.remove(asset.assetId);
  } finally {
    collectionArtwork.binary = binary;
    fixtureVariant.printfulVariantId = previousSupplierId;
    Object.assign(env, previous);
  }
});
