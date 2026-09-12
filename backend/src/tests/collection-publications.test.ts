import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import sharp from 'sharp';
import type {
  CollectionDraft,
  CollectionReview,
  PublicCollection,
  CollectionSalesReadiness,
} from '@open-merch-studio/collection-drafts';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { CURRENT_CHECKOUT_POLICY_VERSION } from '../config/policies.js';
import { collectionArtwork } from '../admin/collection-artwork.service.js';
import { readArtworkRecord, writeArtworkRecord } from '../admin/collection-artwork.repository.js';
import { readCollectionDrafts, saveCollectionDrafts } from '../admin/collection-drafts.service.js';
import { publicCollectionArtwork } from '../admin/collection-publications.service.js';
import { createQuote } from '../services/catalog.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { createCheckoutSession } from '../services/order.service.js';
import { getOrCreateSession } from '../services/runtime-store.js';
import { setOperationalSink } from '../utils/operational-logger.js';

test('reviewed previews are versioned, independently published, revocable, and never expose private artwork or open checkout', async () => {
  const previous = { ...env };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.adminAccessCode = 'fixture-publication-admin';
  env.enableLiveOpenAi = false;
  env.enableLivePrintful = false;
  env.enableLiveStripe = false;
  setOperationalSink(() => undefined);
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = (path: string, body?: unknown) =>
    fetch(`${base}/api/admin/collection-publications${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-access': env.adminAccessCode! },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const data = async <T>(response: Response) => ((await response.json()) as { data: T }).data;
  const readBinary = collectionArtwork.binary;
  try {
    assert.equal((await fetch(`${base}/api/admin/collection-publications`)).status, 401);
    assert.equal(
      (await fetch(`${base}/api/admin/collection-publications/unknown/publish`, { method: 'POST' }))
        .status,
      401
    );
    const original = await sharp({
      create: { width: 1200, height: 1400, channels: 3, background: '#294535' },
    })
      .png()
      .toBuffer();
    const authorization = await collectionArtwork.authorize({
      filename: 'private-artist-original.png',
      contentType: 'image/png',
      byteSize: original.length,
      rightsConfirmed: true,
    });
    const assetId = authorization.assetId;
    await collectionArtwork.complete(
      assetId,
      `data:image/png;base64,${original.toString('base64')}`
    );
    const initial = await readCollectionDrafts();
    const product = initial.catalog[0];
    const code = product.placements[0].code;
    let collection: CollectionDraft = {
      id: randomUUID(),
      title: 'Artist edition',
      description: 'Original pieces for the gallery weekend.',
      purpose: 'event',
      items: [
        {
          id: randomUUID(),
          title: 'Gallery tee',
          productId: product.id,
          variantId: product.variants[0].id,
          placementCodes: [code],
          artworkMode: 'fixed',
          artwork: [{ placementCode: code, assetId }],
          targetPriceCents: 3000,
        },
      ],
    };
    let saved = await saveCollectionDrafts([collection], initial.revision);
    const widths = [{ itemId: collection.items[0].id, placementCode: code, widthInches: 6 }];
    const review = async (printWidths: unknown = widths) =>
      api(`/${collection.id}/review`, { draftRevision: saved.revision, printWidths });
    const publicUrl = `${base}/api/collections/${collection.id}`;
    assert.equal((await fetch(publicUrl)).status, 404);
    for (const invalid of [
      null,
      [{ ...widths[0], widthInches: 0 }],
      [widths[0], widths[0]],
      [{ ...widths[0], assetId }],
      [{ ...widths[0], placementCode: 'other' }],
    ])
      assert.equal((await review(invalid)).status, 400);
    assert.equal(
      (
        await api(`/${collection.id}/review`, {
          draftRevision: saved.revision,
          printWidths: widths,
          publish: true,
        })
      ).status,
      400
    );
    const small = await data<CollectionReview>(await review([{ ...widths[0], widthInches: 12 }]));
    assert.equal(small.ready, false);
    assert.match(small.issues.join(), /150 pixels per inch/);
    assert.equal((await data<CollectionReview>(await review([]))).ready, false);
    const report = await data<CollectionReview>(await review());
    assert.equal(report.ready, true);
    assert.equal(report.areas[0].pixelsPerInch, 200);
    assert.equal(report.areas[0].heightInches, 7);
    const input = {
      draftRevision: saved.revision,
      publicationRevision: 0,
      digest: report.digest,
      printWidths: widths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    };
    const publish = (body: unknown = input) => api(`/${collection.id}/publish`, body);
    assert.equal((await publish({ ...input, publicPreviewConfirmed: false })).status, 400);
    assert.equal((await publish({ ...input, digest: 'old' })).status, 409);
    assert.equal(
      (
        await publish({
          ...input,
          digest: small.digest,
          printWidths: [{ ...widths[0], widthInches: 12 }],
        })
      ).status,
      400
    );
    // Source data can change independently of a draft revision. The server recomputes the review.
    const record = (await readArtworkRecord(assetId))!;
    await writeArtworkRecord({ ...record, checksum: 'changed-source' }, 'test');
    assert.equal((await publish()).status, 409);
    await writeArtworkRecord(record, 'test');
    collectionArtwork.binary = async () => {
      throw new Error('private storage transport detail');
    };
    const unavailable = await publish();
    assert.equal(unavailable.status, 503);
    assert.ok(!(await unavailable.text()).includes('private storage transport detail'));
    assert.equal((await fetch(publicUrl)).status, 404);
    collectionArtwork.binary = readBinary;
    assert.equal((await publish()).status, 200);
    assert.equal(
      (await publish()).status,
      409,
      'A second writer cannot reuse publication revision 0'
    );
    assert.equal(
      (
        await fetch(`${base}/api/admin/collection-publications/${collection.id}/sales-readiness`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1 }),
        })
      ).status,
      401
    );
    const readiness = () => api(`/${collection.id}/sales-readiness`, { version: 1 });
    const inspection = await data<CollectionSalesReadiness>(await readiness());
    assert.equal(inspection.orderingAvailable, false);
    assert.deepEqual(
      inspection.checks.map((check) => check.status),
      ['pass', 'pass', 'action_required', 'not_available', 'action_required']
    );
    const fixtureProduct = sampleCatalog.products.find((item) => item.id === product.id)!;
    const fixtureVariant = fixtureProduct.variants.find(
      (item) => item.id === product.variants[0].id
    )!;
    const available = fixtureVariant.isAvailable;
    try {
      fixtureVariant.isAvailable = false;
      const unavailableVariant = await data<CollectionSalesReadiness>(await readiness());
      assert.equal(unavailableVariant.checks[0].status, 'action_required');
      assert.match(unavailableVariant.checks[0].message, /available product and variant/);
    } finally {
      fixtureVariant.isAvailable = available;
    }
    assert.ok(!JSON.stringify(inspection).includes(assetId));
    assert.ok(!/checksum|namespace|originalPath|digest/.test(JSON.stringify(inspection)));
    assert.equal((await api(`/${collection.id}/sales-readiness`, { version: 2 })).status, 409);
    assert.equal(
      (await api(`/${collection.id}/sales-readiness`, { version: 1, priceCents: 1 })).status,
      400
    );
    await writeArtworkRecord({ ...record, checksum: 'changed-after-publication' }, 'test');
    assert.equal(
      (await data<CollectionSalesReadiness>(await readiness())).checks[0].status,
      'action_required'
    );
    await writeArtworkRecord(record, 'test');
    const response = await fetch(publicUrl);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('x-robots-tag')!, /noindex/);
    const publicText = await response.text();
    assert.ok(
      !/assetId|private-artist|originalPath|previewPath|checksum|namespace|approval|digest/.test(
        publicText
      )
    );
    assert.ok(!publicText.includes(assetId));
    const snapshot = JSON.parse(publicText).data;
    assert.equal(snapshot.orderingAvailable, false);
    const thumbnail = snapshot.products[0].artwork[0].previewUrl;
    assert.equal((await fetch(`${base}${thumbnail}`)).status, 200);
    assert.equal((await fetch(`${base}${thumbnail}/original`)).status, 404);
    assert.equal(
      (await fetch(`${base}${thumbnail.replace(collection.items[0].id, randomUUID())}`)).status,
      404
    );
    assert.equal(
      (await fetch(`${base}/api/admin/collection-artwork/${assetId}/original`)).status,
      401
    );
    assert.equal((await fetch(`${base}/api/design/assets/${assetId}.png`)).status, 404);
    const session = getOrCreateSession();
    const quote = await createQuote(
      [
        {
          productId: product.id,
          variantId: product.variants[0].id,
          quantity: 1,
          placementCodes: [code],
          designAssetId: assetId,
        },
      ],
      { sessionId: session.id }
    );
    const checkout = await createCheckoutSession({
      quoteId: quote.id,
      sessionId: session.id,
      policyAccepted: true,
      policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
    });
    assert.equal(checkout.status, 'blocked');
    assert.match(checkout.message, /could not be verified/);
    collection = {
      ...collection,
      title: 'Private revision',
      items: collection.items.map((item) => ({ ...item, targetPriceCents: null })),
    };
    saved = await saveCollectionDrafts([collection], saved.revision);
    assert.equal((await data<PublicCollection>(await fetch(publicUrl))).title, 'Artist edition');
    assert.equal((await publish({ ...input, publicationRevision: 1 })).status, 409);
    assert.equal(
      (await data<CollectionSalesReadiness>(await readiness())).checks[0].status,
      'pass',
      'Private edits must not invalidate the published review'
    );
    assert.equal(
      (await data<CollectionSalesReadiness>(await readiness())).checks[1].status,
      'pass',
      'An unpublished price edit must not change the inspected price'
    );
    const fresh = await data<CollectionReview>(await review());
    assert.equal(
      (
        await publish({
          ...input,
          draftRevision: saved.revision,
          publicationRevision: 1,
          digest: fresh.digest,
        })
      ).status,
      200
    );
    assert.equal((await fetch(`${base}${thumbnail}`)).status, 404);
    assert.equal((await data<PublicCollection>(await fetch(publicUrl))).title, 'Private revision');
    const revisedReadiness = await data<CollectionSalesReadiness>(
      await api(`/${collection.id}/sales-readiness`, { version: 2 })
    );
    assert.equal(revisedReadiness.checks[1].status, 'action_required');
    assert.equal(revisedReadiness.products[0].priceSpecified, false);
    // Published originals remain pinned after their draft is removed.
    await saveCollectionDrafts([], saved.revision);
    await assert.rejects(() => collectionArtwork.remove(assetId), /Detach this artwork/);
    assert.equal((await api(`/${collection.id}/withdraw`, { publicationRevision: 1 })).status, 409);
    // A withdrawal that lands during a thumbnail read must suppress its response.
    collectionArtwork.binary = async (...args) => {
      const file = await readBinary(...args);
      assert.equal(
        (await api(`/${collection.id}/withdraw`, { publicationRevision: 2 })).status,
        200
      );
      return file;
    };
    await assert.rejects(
      () => publicCollectionArtwork(collection.id, '2', collection.items[0].id, code),
      /not published/
    );
    collectionArtwork.binary = readBinary;
    assert.equal((await fetch(publicUrl)).status, 404);
    assert.equal((await api(`/${collection.id}/sales-readiness`, { version: 2 })).status, 404);
    await collectionArtwork.remove(assetId);
    env.nodeEnv = 'production';
    assert.equal((await fetch(`${base}/api/collections`)).status, 503);
  } finally {
    collectionArtwork.binary = readBinary;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    Object.assign(env, previous);
    setOperationalSink();
  }
});
