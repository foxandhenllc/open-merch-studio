import assert from 'node:assert/strict';
import { createLocalDesignDraft, localProducts } from '../src/services/local-fixtures.ts';
import {
  reusePlacementAssignment,
  selectProductConfiguration,
  selectVariantConfiguration,
  togglePlacementConfiguration,
} from '../src/studio-configuration.transitions.ts';
import {
  artworkAssignmentsForDraft,
  buildPlacementSelections,
  deriveArtworkState,
  deriveCheckoutReadiness,
  mapStudioError,
  mockupKey,
} from '../src/studio-view-model.selectors.ts';
import type { QuoteBreakdown } from '../src/types/catalog.ts';
import { ApiError } from '../src/services/api-error.ts';

const front = createLocalDesignDraft('Front selector artwork', undefined, ['front']);
const back = createLocalDesignDraft('Back selector artwork', undefined, ['back']);
assert.ok(front.id && back.id);

const reused = buildPlacementSelections(
  ['front', 'back'],
  front,
  { front, back: front },
  'center'
);
assert.deepEqual(
  reused.map((placement) => placement.designAssetId),
  [front.id, front.id],
  'same-as-front must send the front asset ID to both placements'
);

const customized = artworkAssignmentsForDraft({
  draft: back,
  activePlacementCode: 'back',
  selectedPlacements: ['front', 'back'],
  placementArtwork: { front, back: front },
});
assert.equal(customized.front?.id, front.id);
assert.equal(customized.back?.id, back.id);

const warningDraft = {
  ...front,
  readiness: {
    status: 'warning' as const,
    checks: [{ label: 'Placement fit', result: 'Review scale.', severity: 'warning' as const }],
  },
};
assert.deepEqual(
  deriveArtworkState({
    selectedPlacements: ['front'],
    placementArtwork: { front: warningDraft },
    design: warningDraft,
  }),
  { artworkReady: false, artworkQuoteEligible: true },
  'warning artwork may be quoted but must not open checkout'
);

const quote = {} as QuoteBreakdown;
assert.equal(
  deriveCheckoutReadiness({
    artworkReady: true,
    quote,
    quoteStale: false,
    quoteExpired: false,
    email: 'not-an-email',
    paymentAvailable: true,
  }).blocker,
  'Enter a valid email for your receipt.'
);
assert.equal(
  deriveCheckoutReadiness({
    artworkReady: true,
    quote,
    quoteStale: true,
    quoteExpired: false,
    email: 'buyer@example.com',
    paymentAvailable: true,
  }).blocker,
  'Updating the estimate for your current selection.'
);

const firstKey = mockupKey({
  productId: 'tee',
  variantId: 'black-m',
  placements: ['back', 'front'],
  draftId: front.id,
  placementDesigns: { back: back.id, front: front.id },
});
const secondKey = mockupKey({
  productId: 'tee',
  variantId: 'black-m',
  placements: ['front', 'back'],
  draftId: front.id,
  placementDesigns: { front: front.id, back: back.id },
});
assert.equal(firstKey, secondKey, 'mockup cache identity must ignore selection object ordering');

const tee = localProducts.find((product) => product.categorySlug === 'apparel');
const poster = localProducts.find((product) => product.categorySlug === 'wall-art');
assert.ok(tee && poster);

const rememberedProduct = selectProductConfiguration({
  product: tee,
  remembered: {
    variantId: tee.variants[1]!.id,
    placements: ['front', 'back'],
    orientation: undefined,
  },
  design: front,
});
assert.equal(rememberedProduct.variant?.id, tee.variants[1]!.id);
assert.deepEqual(rememberedProduct.placements, ['front', 'back']);
assert.equal(rememberedProduct.placementArtwork.front?.id, front.id);
assert.equal(rememberedProduct.placementArtwork.back?.id, front.id);

const unavailableRememberedVariant = selectProductConfiguration({
  product: {
    ...tee,
    variants: tee.variants.map((variant, index) => ({
      ...variant,
      isAvailable: index === 0,
    })),
  },
  remembered: {
    variantId: tee.variants[1]!.id,
    placements: ['front'],
  },
  design: null,
});
assert.equal(
  unavailableRememberedVariant.variant?.id,
  tee.variants[0]!.id,
  'an unavailable remembered variant must fall back to the first available variant'
);

const portraitPoster = selectVariantConfiguration({
  product: poster,
  variantId: poster.variants[0]!.id,
  selectedOrientation: 'portrait',
});
assert.equal(
  portraitPoster.orientation,
  'portrait',
  'wall-art orientation should remain portrait when the new variant is not square'
);

const protectedLastPlacement = togglePlacementConfiguration({
  code: 'front',
  selectedPlacements: ['front'],
  placementArtwork: { front },
  design: front,
});
assert.equal(protectedLastPlacement.changed, false);
assert.deepEqual(protectedLastPlacement.placements, ['front']);

const addedPlacement = togglePlacementConfiguration({
  code: 'back',
  selectedPlacements: ['front'],
  placementArtwork: { front },
  design: front,
});
assert.deepEqual(addedPlacement.placements, ['front', 'back']);
assert.equal(addedPlacement.placementArtwork.back?.id, front.id);

const removedPlacement = togglePlacementConfiguration({
  code: 'back',
  selectedPlacements: ['front', 'back'],
  placementArtwork: { front, back },
  design: front,
});
assert.deepEqual(removedPlacement.placements, ['front']);
assert.equal(removedPlacement.placementArtwork.back, undefined);

const reusedAssignment = reusePlacementAssignment({
  sourceCode: 'front',
  targetCode: 'back',
  placementArtwork: { front, back },
  design: front,
});
assert.equal(reusedAssignment?.back?.id, front.id);

assert.deepEqual(
  mapStudioError(new ApiError('Request budget reached.', 429, 'rate_limit'), 'generation'),
  {
    cause: 'rate_limited',
    title: 'Generation is temporarily at capacity',
    message: 'Your place and prompt are saved.',
    recovery: 'Wait a moment, then retry this same request.',
    retryable: true,
  }
);

console.log('Studio selector contract passed.');
