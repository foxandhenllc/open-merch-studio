import { setCollectionSales } from '../collections/sales.service.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
} from '../admin/collection-publications.service.js';
import { saveCollectionPrintLayouts } from '../admin/collection-print-layouts.js';
import {
  createCollectionPurchaseService,
  collectionPurchases,
} from '../collections/purchase.service.js';
import { readPurchase } from '../collections/purchase.repository.js';
import { createCheckoutSession } from '../services/order.service.js';
import { CURRENT_CHECKOUT_POLICY_VERSION } from '../config/policies.js';
import { getQuoteById } from '../services/order-repository.service.js';

test('collection quotes keep private print copies and owner prices through retries, checkout validation and withdrawal', async () => {
  const previous = { ...env };
  Object.assign(env, {
    databaseUrl: undefined,
    nodeEnv: 'test',
    defaultCurrency: 'USD',
    enableLiveOpenAi: false,
    enableLiveStripe: false,
    enableLivePrintful: false,
    checkoutEnabled: true,
  });
  const variant = sampleCatalog.products[0].variants[0];
  const oldSupplierId = variant.printfulVariantId;
  variant.printfulVariantId = 12345;
  try {
    const original = await sharp({
      create: { width: 600, height: 600, channels: 4, background: '#386942' },
    })
      .png()
      .toBuffer();
    const { assetId } = await collectionArtwork.authorize({
      filename: 'private-fixture.png',
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
    const itemId = randomUUID();
    const id = randomUUID();
    const code = product.placements[0].code;
    const saved = await saveCollectionDrafts(
      [
        {
          id,
          title: 'Gallery',
          description: '',
          purpose: 'event',
          items: [
            {
              id: itemId,
              title: 'Owner edition',
              productId: product.id,
              variantId: variant.id,
              placementCodes: [code],
              artworkMode: 'fixed',
              targetPriceCents: 4200,
              artwork: [{ assetId, placementCode: code }],
            },
          ],
        },
      ],
      before.revision
    );
    const widths = [{ itemId, placementCode: code, widthInches: 2 }];
    const review = await prepareCollectionReview(id, saved.revision, widths);
    const pub = await publishCollection(id, {
      draftRevision: saved.revision,
      publicationRevision: (await publicationStatus()).revision,
      digest: review.digest,
      printWidths: widths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    });
    const layout = {
      itemId,
      placementCode: code,
      templateWidthInches: 3,
      templateHeightInches: 4,
      leftInches: 0.5,
      topInches: 1,
    };
    await saveCollectionPrintLayouts(id, {
      version: pub.version,
      revision: 0,
      layouts: [layout],
      templateConfirmed: true,
    });
    await setCollectionSales(id, {
      version: pub.version,
      layoutRevision: 1,
      enabled: true,
      reviewed: true,
    });
    const input = {
      selection: {
        collectionId: id,
        version: pub.version,
        layoutRevision: 1,
        items: [{ itemId, quantity: 2 }],
      },
      sessionId: randomUUID(),
      requestId: randomUUID(),
    };
    const q = await collectionPurchases.create(input);
    assert.equal(q.items[0].title, 'Owner edition');
    assert.equal(q.items[0].unitRetailCents, 4200);
    assert.equal(q.totalCents, 8400 + 670);
    assert.equal(q.items[0].pricingSource, 'owner-published');
    assert.ok(!JSON.stringify(q).includes('purchase.png'));
    assert.ok(!JSON.stringify(q).includes('sourceChecksum'));
    assert.ok(!JSON.stringify(q).includes(assetId));
    assert.deepEqual(await getQuoteById(q.id), q);
    assert.deepEqual(await collectionPurchases.create(input), q);
    assert.deepEqual(
      await collectionPurchases.create({
        ...input,
        selection: {
          items: input.selection.items,
          layoutRevision: 1,
          version: pub.version,
          collectionId: id,
        },
      }),
      q,
      'JSON key order is not a different request'
    );
    await assert.rejects(
      () =>
        collectionPurchases.create({
          ...input,
          selection: { ...input.selection, items: [{ itemId, quantity: 1 }] },
        }),
      { errorCode: 'collection_request_conflict' }
    );
    assert.equal(await collectionPurchases.validate(q, input.sessionId), null);
    assert.ok(await collectionPurchases.validate(q, randomUUID()));
    assert.ok(await collectionPurchases.validate({ ...q, totalCents: 1 }, input.sessionId));
    const checkout = await createCheckoutSession({
      quoteId: q.id!,
      sessionId: input.sessionId,
      policyAccepted: true,
      policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
    });
    assert.equal(checkout.mode, 'fixture');
    assert.equal(checkout.status, 'paid');
    const repeated = await Promise.all(
      Array.from({ length: 3 }, () =>
        createCheckoutSession({
          quoteId: q.id!,
          sessionId: input.sessionId,
          policyAccepted: true,
          policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
        })
      )
    );
    assert.ok(
      repeated.every((result) => result.orderId === checkout.orderId),
      'Checkout retries reuse one order'
    );

    const objects = new Map<string, Buffer>();
    let throwAfterWrite = true;
    const storage = {
      namespace: 'test-private',
      assertPrivate: async () => undefined,
      read: async (path: string) => {
        const bytes = objects.get(path);
        if (!bytes) throw new Error('missing');
        return Buffer.from(bytes);
      },
      write: async (path: string, bytes: Buffer) => {
        if (objects.has(path)) throw new Error('exists');
        objects.set(path, Buffer.from(bytes));
        if (throwAfterWrite) throw new Error('response lost');
      },
      providerUrl: async (path: string) =>
        `https://storage.example.test/private/${path}?fixture-signed=true`,
    };
    const service = createCollectionPurchaseService(() => storage);
    const retryInput = { ...input, requestId: randomUUID() };
    const recovered = await service.create(retryInput);
    assert.equal(objects.size, 1, 'A write whose response was lost is recovered by checksum');
    throwAfterWrite = false;
    assert.deepEqual(await service.create(retryInput), recovered);
    const manifest = (await readPurchase(recovered.id!))!;
    const filePath = manifest.files[0].path;
    const bytes = objects.get(filePath)!;
    objects.set(filePath, Buffer.from('wrong bytes'));
    assert.ok(await service.validate(recovered, input.sessionId));
    assert.equal(await service.providerFiles(recovered), null);
    assert.equal(await service.operatorPrint(recovered, manifest.files[0].assetId), null);
    objects.set(filePath, bytes);
    assert.ok(await service.providerFiles(recovered));
    assert.deepEqual(await service.operatorPrint(recovered, manifest.files[0].assetId), bytes);
    assert.equal(await service.operatorPrint(recovered, assetId), null);
    const changedStorage = createCollectionPurchaseService(() => ({
      ...storage,
      namespace: 'different-bucket',
    }));
    assert.ok(await changedStorage.validate(recovered, input.sessionId));

    // A failed first write leaves no completed quote; the same request can recover later.
    let fail = true;
    const retryService = createCollectionPurchaseService(() => ({
      ...storage,
      write: async (path, bytes) => {
        if (fail) throw new Error('offline');
        await storage.write(path, bytes);
      },
    }));
    const failedInput = { ...input, requestId: randomUUID() };
    await assert.rejects(() => retryService.create(failedInput), {
      errorCode: 'collection_purchase_storage_unavailable',
    });
    fail = false;
    assert.equal((await retryService.create(failedInput)).items[0].unitRetailCents, 4200);

    // Publication/layout changes before finalization reject the candidate.
    let changeLayout = true;
    const staleService = createCollectionPurchaseService(() => ({
      ...storage,
      write: async (path, bytes) => {
        await storage.write(path, bytes);
        if (changeLayout) {
          changeLayout = false;
          await saveCollectionPrintLayouts(id, {
            version: pub.version,
            revision: 1,
            layouts: [{ ...layout, leftInches: 0 }],
            templateConfirmed: true,
          });
        }
      },
    }));
    await assert.rejects(() => staleService.create({ ...input, requestId: randomUUID() }), {
      errorCode: 'collection_purchase_stale',
    });
    assert.ok(await collectionPurchases.validate(q, input.sessionId));
    await withdrawCollection(id, (await publicationStatus()).revision);
    await saveCollectionDrafts([], saved.revision);
    await collectionArtwork.remove(assetId);
    assert.ok(
      await service.validate(recovered, input.sessionId),
      'Withdrawn collection cannot begin another checkout'
    );
    assert.ok(
      await service.providerFiles(recovered),
      'Previously purchased copies survive source removal'
    );
    assert.deepEqual(await getQuoteById(q.id), q);
    assert.deepEqual(await service.operatorPrint(recovered, manifest.files[0].assetId), bytes);
  } finally {
    variant.printfulVariantId = oldSupplierId;
    Object.assign(env, previous);
  }
});
