import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import { assertStorefrontSlug, getPublishedStorefront } from '../services/storefront.service.js';

test('storefront slugs are normalized and reject path-like input', () => {
  assert.equal(assertStorefrontSlug(' Fox-And-Hen '), 'fox-and-hen');
  assert.throws(() => assertStorefrontSlug('../private'), /lowercase letters/);
  assert.throws(() => assertStorefrontSlug('two--hyphens'), /lowercase letters/);
});

test('fixture mode exposes only the owned Fox & Hen example storefront', async () => {
  if (env.databaseUrl) return;
  const storefront = await getPublishedStorefront('fox-and-hen', 'one-clear-system');
  assert.equal(storefront?.organization.brand.shortDescription, 'Web + Workflow Studio');
  assert.equal(storefront?.products.length, 5);
  assert.equal(await getPublishedStorefront('rcr', 'unpublished'), null);
});
