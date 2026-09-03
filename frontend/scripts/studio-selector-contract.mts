import assert from 'node:assert/strict';
import {
  createLocalDesignDraft,
  createLocalMockup,
  localProducts,
} from '../src/services/local-fixtures.ts';
import {
  reusePlacementAssignment,
  selectProductConfiguration,
  selectVariantConfiguration,
  togglePlacementConfiguration,
} from '../src/studio-configuration.transitions.ts';
import {
  acceptArtworkDraft,
  appendDesignHistory,
  appendReferenceAssets,
  assertUsableGeneratedDraft,
  referenceAssetIds,
  replaceDraftAssignments,
  selectReferenceFiles,
  undoArtworkRevision,
} from '../src/studio-artwork.transitions.ts';
import { classifyMockupResult, prepareMockupRequest } from '../src/studio-mockup.ts';
import { prepareQuoteRequest, quoteAnnouncement } from '../src/studio-quote.ts';
import {
  checkoutNotReadyError,
  checkoutUnavailable,
  classifyCheckoutResult,
  orderDetailsPendingError,
  prepareCheckoutRequest,
} from '../src/studio-checkout.ts';
import {
  artworkAssignmentsForDraft,
  buildPlacementSelections,
  deriveArtworkState,
  deriveCheckoutReadiness,
  mapStudioError,
  mockupKey,
} from '../src/studio-view-model.selectors.ts';
import type {
  CheckoutSession,
  CustomerOrderConfirmation,
  QuoteBreakdown,
} from '../src/types/catalog.ts';
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

assert.deepEqual(selectReferenceFiles([1, 2, 3], 4), [1]);
assert.deepEqual(
  appendReferenceAssets([front, back], [front, back, front, back]),
  [front, back, front, back, front],
  'reference assets must remain capped at five even when async uploads finish together'
);
assert.deepEqual(referenceAssetIds([front, { ...back, id: null }]), [front.id]);

const history = appendDesignHistory([], front);
assert.deepEqual(appendDesignHistory(history, front), history, 'history must not duplicate a draft');

const targetedArtwork = acceptArtworkDraft({
  draft: back,
  activePlacementCode: 'back',
  selectedPlacements: ['front', 'back'],
  placementArtwork: { front, back: front },
});
assert.equal(targetedArtwork.front?.id, front.id);
assert.equal(targetedArtwork.back?.id, back.id);

const revisedFront = { ...front, id: 'revised-front' };
const replacedArtwork = replaceDraftAssignments(
  { front, back },
  front.id,
  revisedFront
);
assert.equal(replacedArtwork.front?.id, revisedFront.id);
assert.equal(
  replacedArtwork.back?.id,
  back.id,
  'revising the front must preserve independent back artwork'
);

const undoneArtwork = undoArtworkRevision({
  history: [front],
  currentDesign: revisedFront,
  placementArtwork: { front: revisedFront, back },
});
assert.equal(undoneArtwork?.design.id, front.id);
assert.equal(undoneArtwork?.placementArtwork.front?.id, front.id);
assert.equal(undoneArtwork?.placementArtwork.back?.id, back.id);
assert.deepEqual(undoneArtwork?.history, []);

assert.throws(
  () =>
    assertUsableGeneratedDraft({
      ...front,
      policy: { status: 'blocked', reasons: ['Policy rejected this request.'] },
    }),
  (error: unknown) =>
    error instanceof ApiError && error.status === 400 && error.code === 'policy_blocked'
);
assert.throws(
  () =>
    assertUsableGeneratedDraft({
      ...front,
      generationStatus: 'failed',
      policy: { status: 'needs_review', reasons: ['Provider did not finish.'] },
    }),
  (error: unknown) =>
    error instanceof ApiError &&
    error.status === 503 &&
    error.code === 'design_generation_failed'
);

const preparedMockup = prepareMockupRequest(
  {
    product: tee,
    variant: tee.variants[0]!,
    placements: ['front', 'back'],
    draft: front,
    artworkByCode: { front, back },
    mugLayout: 'center',
  },
  'fixture-session'
);
assert.ok(preparedMockup);
assert.equal(preparedMockup.body.sessionId, 'fixture-session');
assert.deepEqual(
  preparedMockup.body.placements.map((placement) => placement.designAssetId),
  [front.id, back.id],
  'mockup requests must preserve distinct front/back artwork IDs'
);
assert.match(preparedMockup.cacheKey, new RegExp(`front:${front.id}`));
assert.match(preparedMockup.cacheKey, new RegExp(`back:${back.id}`));
assert.equal(
  prepareMockupRequest({
    product: tee,
    variant: tee.variants[0]!,
    placements: ['front'],
    draft: { ...front, readiness: { status: 'blocked', checks: [] } },
    artworkByCode: { front },
    mugLayout: 'center',
  }),
  null,
  'blocked artwork must never be submitted for a provider mockup'
);

const fixtureMockup = createLocalMockup(preparedMockup.body);
assert.deepEqual(classifyMockupResult(fixtureMockup, 'fallback'), {
  failed: false,
  analyticsSource: 'fallback',
  announcement: 'Product mockup ready. Your price estimate is updating automatically.',
});
const failedMockup = classifyMockupResult(
  { ...fixtureMockup, status: 'failed', provider: 'printful', errorMessage: 'Provider timed out.' },
  'live'
);
assert.equal(failedMockup.failed, true);
assert.equal(failedMockup.analyticsSource, 'printful');
assert.equal(failedMockup.error?.message, 'Provider timed out.');

const preparedQuote = prepareQuoteRequest({
  sessionId: 'fixture-session',
  studioPassId: 'fixture-pass',
  product: tee,
  variant: tee.variants[0]!,
  selectedPlacements: ['front', 'back'],
  design: front,
  placementArtwork: { front, back },
  mugLayout: 'center',
});
assert.ok(preparedQuote);
assert.equal(preparedQuote.items[0]?.quantity, 1);
assert.deepEqual(
  preparedQuote.items[0]?.placements.map((placement) => placement.designAssetId),
  [front.id, back.id],
  'quote requests must price the same distinct artwork assignments used by mockups'
);
assert.equal(
  quoteAnnouncement({ currency: 'USD', totalCents: 2855 } as QuoteBreakdown, true),
  'Price estimate ready: $28.55.'
);
assert.equal(
  quoteAnnouncement({ currency: 'USD', totalCents: 2855 } as QuoteBreakdown, false),
  'Price updated: $28.55.'
);

const checkoutQuote = { id: 'quote-1', currency: 'USD', totalCents: 2855 } as QuoteBreakdown;
const checkoutRequest = prepareCheckoutRequest({
  quote: checkoutQuote,
  sessionId: 'fixture-session',
  studioPassId: 'fixture-pass',
  email: 'buyer@example.com',
  design: front,
  policyAccepted: true,
  policyVersion: '2026-09-03',
});
assert.equal(checkoutRequest.quoteId, checkoutQuote.id);
assert.equal(checkoutRequest.designAssetId, front.id);
assert.equal(checkoutRequest.email, 'buyer@example.com');
assert.equal(checkoutRequest.policyAccepted, true);

const checkoutBase: CheckoutSession = {
  id: 'checkout-1',
  mode: 'stripe',
  status: 'open',
  checkoutUrl: 'https://checkout.stripe.example/session',
  message: 'Checkout created.',
};
assert.deepEqual(classifyCheckoutResult(checkoutBase), {
  kind: 'redirect',
  checkoutUrl: checkoutBase.checkoutUrl,
});

const inlineOrder = { orderNumber: 'OMS-1001' } as CustomerOrderConfirmation;
assert.deepEqual(
  classifyCheckoutResult({
    ...checkoutBase,
    status: 'paid',
    checkoutUrl: null,
    order: inlineOrder,
  } as CheckoutSession),
  { kind: 'inline-order', order: inlineOrder }
);
assert.deepEqual(
  classifyCheckoutResult({ ...checkoutBase, status: 'paid', checkoutUrl: null, orderId: 'order-1' }),
  { kind: 'lookup-order', orderId: 'order-1' }
);
assert.equal(checkoutUnavailable('quote-1').quoteId, 'quote-1');
assert.equal(checkoutNotReadyError('Enter an email.').retryable, false);
assert.match(orderDetailsPendingError(new Error('Still processing.')).message, /Still processing/);

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
