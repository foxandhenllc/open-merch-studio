import assert from 'node:assert/strict';
import { createLocalDesignDraft } from '../src/services/local-fixtures.ts';
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
