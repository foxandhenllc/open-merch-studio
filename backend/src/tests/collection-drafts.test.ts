import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { validateCollections, type CollectionDraft } from '@open-merch-studio/collection-drafts';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { readCollectionDrafts, saveCollectionDrafts } from '../admin/collection-drafts.service.js';
import { getPublishedStorefront } from '../services/storefront.service.js';
import { setOperationalSink } from '../utils/operational-logger.js';

test('installation collection drafts are private, revisioned and catalog-validated without publishing or opening commerce', async () => {
  const previous = { database: env.databaseUrl, mode: env.nodeEnv, admin: env.adminAccessCode };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.adminAccessCode = 'fixture-collections-code';
  setOperationalSink(() => undefined);
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const url = `${origin}/api/admin/collections`;
  const headers = { 'Content-Type': 'application/json', 'x-admin-access': env.adminAccessCode };
  try {
    const publicBefore = await getPublishedStorefront('fox-and-hen', 'one-clear-system');
    const checkoutBefore = env.checkoutAccessMode;
    for (const method of ['GET', 'PUT']) {
      const response = await fetch(url, { method });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control') ?? '', /private, no-store/);
    }
    const before = await readCollectionDrafts();
    const [product, other] = before.catalog;
    const draft: CollectionDraft = {
      id: randomUUID(),
      title: ' Gallery weekend ',
      description: 'Original artwork, unaltered.',
      purpose: 'event',
      items: [
        {
          id: randomUUID(),
          title: 'Gallery tee',
          productId: product.id,
          variantId: product.variants[0].id,
          placementCodes: [product.placements[0].code],
          artworkMode: 'fixed',
          targetPriceCents: 3000,
        },
      ],
    };
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ revision: before.revision, collections: [draft] }),
    });
    assert.equal(response.status, 200);
    const saved = await readCollectionDrafts();
    assert.equal(saved.collections[0].title, 'Gallery weekend');
    assert.equal(saved.storage, 'fixture');
    assert.equal(saved.revision, before.revision + 1);
    // Simultaneous editors with the same revision must not silently overwrite one another.
    const competing = await Promise.allSettled([
      saveCollectionDrafts([{ ...draft, purpose: 'community' }], saved.revision),
      saveCollectionDrafts([{ ...draft, purpose: 'drop' }], saved.revision),
    ]);
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    const fresh = await readCollectionDrafts();
    assert.equal(fresh.collections[0].items[0].artworkMode, 'fixed');
    const invalidInputs = [
      [{ ...draft, organizationId: 'someone-else' }],
      [{ ...draft, status: 'published' }],
      [{ ...draft, title: 'x'.repeat(81) }],
      [draft, draft],
      [{ ...draft, items: [draft.items[0], draft.items[0]] }],
      [{ ...draft, items: [{ ...draft.items[0], targetPriceCents: 29.95 }] }],
      [{ ...draft, items: [{ ...draft.items[0], artworkMode: 'auto-publish' }] }],
      [{ ...draft, items: [{ ...draft.items[0], placementCodes: [] }] }],
      [{ ...draft, items: [{ ...draft.items[0], placementCodes: ['invented'] }] }],
      [{ ...draft, items: [{ ...draft.items[0], variantId: other.variants[0].id }] }],
      [{ ...draft, items: [{ ...draft.items[0], productId: 'invented' }] }],
      [{ ...draft, items: [{ ...draft.items[0], designAssetId: 'private-asset' }] }],
    ];
    for (const collections of invalidInputs) {
      const denied = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ revision: fresh.revision, collections }),
      });
      assert.equal(denied.status, 400);
    }
    const extra = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        revision: fresh.revision,
        collections: [],
        organizationSlug: 'other-merchant',
      }),
    });
    assert.equal(extra.status, 400);
    assert.equal((await readCollectionDrafts()).revision, fresh.revision);
    assert.deepEqual(await getPublishedStorefront('fox-and-hen', 'one-clear-system'), publicBefore);
    assert.equal(env.checkoutAccessMode, checkoutBefore);
    assert.deepEqual(await (await fetch(`${origin}/api/collections`)).json(), {
      success: true,
      data: [],
    });
    assert.equal((await fetch(`${url}/publish`, { method: 'POST', headers })).status, 404);
    env.nodeEnv = 'production';
    await assert.rejects(readCollectionDrafts, /could not be loaded or saved/);
    await assert.rejects(
      () => saveCollectionDrafts([], fresh.revision),
      /could not be loaded or saved/
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    env.databaseUrl = previous.database;
    env.nodeEnv = previous.mode;
    env.adminAccessCode = previous.admin;
    setOperationalSink();
  }
});

test('collection contract bounds rows, modes and scalar types', () => {
  assert.deepEqual(validateCollections([]), []);
  for (const input of [null, {}, Array(21).fill({})])
    assert.throws(() => validateCollections(input));
  const draft = {
    id: randomUUID(),
    title: 'A collection',
    description: '',
    purpose: 'everyday',
    items: [],
  };
  for (const altered of [
    { ...draft, id: '../other' },
    { ...draft, description: false },
    { ...draft, purpose: '__proto__' },
    { ...draft, items: Array(16).fill({}) },
  ])
    assert.throws(() => validateCollections([altered]));
});
