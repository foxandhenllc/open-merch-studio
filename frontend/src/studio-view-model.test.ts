import assert from 'node:assert/strict';
import {
  deriveStudioCanvasState,
  findVariantForOption,
  groupVariantOptions,
} from './studio-view-model';
import type { CatalogProduct, DesignDraft, DesignMockup } from './types/catalog';

const product: CatalogProduct = {
  id: 'tee-1',
  title: 'Soft Tee',
  slug: 'soft-tee',
  categorySlug: 'apparel',
  categoryTitle: 'Tee',
  isSellable: true,
  variants: [
    {
      id: 'black-s',
      name: 'Black / S',
      size: 'S',
      color: 'Black',
      colorCode: '#111111',
      isAvailable: true,
      costCents: 1200,
    },
    {
      id: 'black-m',
      name: 'Black / M',
      size: 'M',
      color: 'Black',
      colorCode: '#111111',
      isAvailable: true,
      costCents: 1200,
    },
    {
      id: 'cream-m',
      name: 'Cream / M',
      size: 'M',
      color: 'Cream',
      colorCode: '#f7ead4',
      isAvailable: true,
      costCents: 1300,
    },
  ],
  placements: [
    {
      code: 'front',
      displayName: 'Front',
      technique: 'dtg',
      isDefault: true,
    },
  ],
};

const design: DesignDraft = {
  id: 'design-1',
  provider: 'mock',
  prompt: 'A neon robot DJ',
  imageUrl: 'https://example.com/design.png',
  qualityTier: 'rough',
  allowance: {
    sessionId: 'session-1',
    studioPassStatus: 'available',
    freeDraftsRemaining: 2,
    roughDraftsRemaining: 0,
    editsRemaining: 0,
    finalsRemaining: 0,
    nextAction: 'continue_free',
    message: 'Ready',
  },
  policy: {
    status: 'pass',
    reasons: [],
  },
  readiness: {
    status: 'pass',
    checks: [],
  },
  createdAt: new Date().toISOString(),
};

const mockup: DesignMockup = {
  id: 'mockup-1',
  status: 'complete',
  provider: 'fixture',
  productId: 'tee-1',
  variantId: 'black-m',
  placementCodes: ['front'],
  designAssetId: 'design-1',
  imageUrl: 'https://example.com/mockup.png',
  createdAt: new Date().toISOString(),
};

const grouped = groupVariantOptions(product, 'black-m');
assert.equal(grouped.colorOptions.length, 2);
assert.equal(grouped.sizeOptions.length, 2);
assert.equal(grouped.selectedColorKey, 'black');
assert.equal(grouped.selectedSizeKey, 'm');
assert.equal(grouped.colorOptions[0].variantCount, 2);

assert.equal(
  findVariantForOption(product, 'black-m', { colorKey: 'cream' })?.id,
  'cream-m'
);
assert.equal(
  findVariantForOption(product, 'black-m', { sizeKey: 's' })?.id,
  'black-s'
);

assert.deepEqual(
  deriveStudioCanvasState({
    busy: 'draft',
    design: null,
    mockup: null,
    quoteReady: false,
    checkoutUnavailable: null,
  }).progressSteps.map((step) => step.state),
  ['done', 'active', 'todo']
);

assert.equal(
  deriveStudioCanvasState({
    busy: null,
    design,
    mockup,
    quoteReady: true,
    checkoutUnavailable: 'Checkout opens soon.',
  }).scene,
  'checkout-gated'
);

assert.equal(
  deriveStudioCanvasState({
    busy: null,
    design: {
      ...design,
      policy: { status: 'needs_review', reasons: ['Possible protected mark.'] },
    },
    mockup,
    quoteReady: false,
    checkoutUnavailable: null,
  }).scene,
  'policy-review'
);

assert.equal(
  deriveStudioCanvasState({
    busy: null,
    design,
    mockup: { ...mockup, status: 'failed', errorMessage: 'Provider timed out.' },
    quoteReady: false,
    checkoutUnavailable: null,
  }).scene,
  'mockup-failed'
);
