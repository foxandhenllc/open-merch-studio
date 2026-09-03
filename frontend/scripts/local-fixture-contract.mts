import assert from 'node:assert/strict';
import { createLocalDesignDraft, createLocalMockup } from '../src/services/local-fixtures.ts';

const front = createLocalDesignDraft('Front fixture artwork', undefined, ['front']);
const back = createLocalDesignDraft('Back fixture artwork', undefined, ['back']);

assert.ok(front.id && back.id, 'fixture drafts need reusable asset IDs');

const distinct = createLocalMockup({
  productId: 'fixture-product-heavyweight-shirt',
  variantId: 'fixture-variant-shirt-black-m',
  placementCodes: ['front', 'back'],
  placements: [
    { code: 'front', designAssetId: front.id },
    { code: 'back', designAssetId: back.id },
  ],
  designAssetId: front.id,
  imageUrl: front.imageUrl,
});

assert.equal(distinct.views?.length, 2);
assert.notEqual(
  distinct.views?.[0]?.imageUrl,
  distinct.views?.[1]?.imageUrl,
  'distinct placement artwork must produce distinct fixture views'
);

const reused = createLocalMockup({
  productId: 'fixture-product-heavyweight-shirt',
  variantId: 'fixture-variant-shirt-black-m',
  placementCodes: ['front', 'back'],
  placements: [
    { code: 'front', designAssetId: front.id },
    { code: 'back', designAssetId: front.id },
  ],
  designAssetId: front.id,
  imageUrl: front.imageUrl,
});

assert.equal(
  reused.views?.[0]?.imageUrl,
  reused.views?.[1]?.imageUrl,
  'reused placement artwork must converge on the same fixture view'
);

console.log('Local multi-placement preview contract passed.');
