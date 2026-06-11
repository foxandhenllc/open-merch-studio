import test from 'node:test';
import assert from 'node:assert/strict';
import { listCategories, listProducts } from '../services/catalog.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';

test('fixture launch catalog stays scoped to the five paid-beta product categories', () => {
  assert.deepEqual(
    sampleCatalog.categories.map((category) => category.slug),
    ['apparel', 'drinkware', 'wall-art', 'bags', 'stickers']
  );
  assert.deepEqual(
    sampleCatalog.products.map((product) => product.slug),
    [
      'heavyweight-cotton-shirt',
      'ceramic-mug',
      'matte-poster',
      'canvas-tote-bag',
      'kiss-cut-sticker',
    ]
  );
});

test('public catalog service exposes only paid-beta launch products', async () => {
  const categories = await listCategories();
  const products = await listProducts();

  assert.deepEqual(categories.map((category) => category.slug).sort(), [
    'apparel',
    'bags',
    'drinkware',
    'stickers',
    'wall-art',
  ]);
  assert.deepEqual(products.map((product) => product.slug).sort(), [
    'canvas-tote-bag',
    'ceramic-mug',
    'heavyweight-cotton-shirt',
    'kiss-cut-sticker',
    'matte-poster',
  ]);
});
