import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { collectionArtwork } from '../admin/collection-artwork.service.js';
import { readCollectionDrafts, saveCollectionDrafts } from '../admin/collection-drafts.service.js';
import { prepareCollectionArtwork } from '../admin/collection-artwork-preparation.js';
import { setOperationalSink } from '../utils/operational-logger.js';

test('owner artwork stays private, preserves originals, binds distinct print areas, and cannot be removed while referenced', async () => {
  const previous = { database: env.databaseUrl, mode: env.nodeEnv, admin: env.adminAccessCode };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.adminAccessCode = 'fixture-private-artwork';
  const events: unknown[] = [];
  setOperationalSink((event) => events.push(event));
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { 'Content-Type': 'application/json', 'x-admin-access': env.adminAccessCode };
  const api = (path: string, method = 'GET', body?: unknown) =>
    fetch(`${base}/api/admin/collection-artwork${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const original = await sharp({
      create: {
        width: 1300,
        height: 1200,
        channels: 4,
        background: { r: 40, g: 90, b: 65, alpha: 0.7 },
      },
    })
      .png()
      .toBuffer();
    const info = {
      filename: 'artist-original.png',
      contentType: 'image/png',
      byteSize: original.length,
      rightsConfirmed: true,
    };
    assert.equal((await fetch(`${base}/api/admin/collection-artwork`)).status, 401);
    assert.equal(
      (await api('/authorize', 'POST', { ...info, rightsConfirmed: false })).status,
      400
    );
    assert.equal(
      (await api('/authorize', 'POST', { ...info, byteSize: 30 * 1024 * 1024 })).status,
      413
    );
    assert.equal(
      (await api('/authorize', 'POST', { ...info, originalPath: 'another-owner/file' })).status,
      400
    );
    const authorization = await api('/authorize', 'POST', info);
    assert.equal(authorization.status, 201);
    const {
      data: { assetId },
    } = (await authorization.json()) as { data: { assetId: string } };
    assert.equal((await api(`/${assetId}/preview`)).status, 404);
    const wrongBytes = await api(`/${assetId}/complete`, 'POST', {
      inlineDataUrl: 'data:image/png;base64,YQ==',
    });
    assert.equal(wrongBytes.status, 400);
    const completed = await api(`/${assetId}/complete`, 'POST', {
      inlineDataUrl: `data:image/png;base64,${original.toString('base64')}`,
    });
    assert.equal(completed.status, 200);
    const completeText = await completed.text();
    assert.ok(
      !/originalPath|previewPath|printPath|namespace|checksum|data:image|https:/.test(completeText)
    );
    const asset = JSON.parse(completeText).data;
    assert.equal(asset.width, 1300);
    assert.equal(asset.hasTransparency, true);
    assert.equal(asset.readiness, 'needs_review');
    assert.equal(
      (await api(`/${assetId}/complete`, 'POST', {})).status,
      200,
      'Completion retry must be idempotent'
    );
    const preview = await api(`/${assetId}/preview`);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('cache-control') ?? '', /private, no-store/);
    assert.equal(preview.headers.get('content-type'), 'image/webp');
    const previewMeta = await sharp(Buffer.from(await preview.arrayBuffer())).metadata();
    assert.ok((previewMeta.width ?? 0) <= 800);
    const restored = await api(`/${assetId}/original`);
    assert.deepEqual(Buffer.from(await restored.arrayBuffer()), original);
    assert.equal(
      (await fetch(`${base}/api/admin/collection-artwork/${assetId}/preview`)).status,
      401
    );
    assert.equal((await fetch(`${base}/api/design/assets/${assetId}.png`)).status, 404);
    assert.equal((await fetch(`${base}/api/design/drafts/${assetId}`)).status, 404);
    const before = await readCollectionDrafts();
    const product = before.catalog.find((entry) => entry.placements.length > 1)!;
    const record = {
      id: randomUUID(),
      title: 'Artist collection',
      description: '',
      purpose: 'event',
      items: [
        {
          id: randomUUID(),
          title: 'Artist tee',
          productId: product.id,
          variantId: product.variants[0].id,
          placementCodes: product.placements.map((area) => area.code),
          artworkMode: 'fixed',
          targetPriceCents: 3000,
          artwork: [{ placementCode: product.placements[0].code, assetId }],
        },
      ],
    };
    const saved = await saveCollectionDrafts([record], before.revision);
    assert.deepEqual(saved.collections[0].items[0].artwork, record.items[0].artwork);
    assert.equal((await api(`/${assetId}`, 'DELETE')).status, 409);
    for (const artwork of [
      [{ placementCode: 'not-selected', assetId }],
      [{ placementCode: product.placements[0].code, assetId: randomUUID() }],
      [...record.items[0].artwork, ...record.items[0].artwork],
      [{ ...record.items[0].artwork[0], imageUrl: 'https://private.example/file' }],
    ])
      await assert.rejects(() =>
        saveCollectionDrafts(
          [{ ...record, items: [{ ...record.items[0], artwork }] }],
          saved.revision
        )
      );
    await saveCollectionDrafts([], saved.revision);
    assert.equal((await api(`/${assetId}`, 'DELETE')).status, 200);
    assert.equal((await api(`/${assetId}/preview`)).status, 404);
    assert.equal(
      (await collectionArtwork.list()).assets.some((entry) => entry.id === assetId),
      false
    );
    assert.ok(!JSON.stringify(events).includes('artist-original.png'));
    env.nodeEnv = 'production';
    await assert.rejects(() => collectionArtwork.authorize(info), /storage/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    env.databaseUrl = previous.database;
    env.nodeEnv = previous.mode;
    env.adminAccessCode = previous.admin;
    setOperationalSink();
  }
});

test('artwork preparation rejects spoofed formats and marks small images blocked without inventing print readiness', async () => {
  const tiny = await sharp({
    create: { width: 100, height: 100, channels: 3, background: '#335544' },
  })
    .png()
    .toBuffer();
  const prepared = await prepareCollectionArtwork(tiny, 'image/png');
  assert.equal(prepared.readiness, 'blocked');
  assert.equal(prepared.hasTransparency, false);
  await assert.rejects(() => prepareCollectionArtwork(tiny, 'image/jpeg'), /valid, single-frame/);
  await assert.rejects(
    () => prepareCollectionArtwork(Buffer.from('<svg><script/></svg>'), 'image/png'),
    /valid, single-frame/
  );
});
