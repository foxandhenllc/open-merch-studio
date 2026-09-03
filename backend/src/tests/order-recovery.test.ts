import assert from 'node:assert/strict';
import test from 'node:test';
import type { AxiosInstance } from 'axios';
import type { AdminOrderListItem, OrderSummary } from '../types/catalog.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import {
  filterAdminOrderItems,
  normalizeOperatorReviewStatus,
  persistedOrderStatus,
  printfulAttemptClaimDecision,
  printfulRetryBlocker,
  restoreRuntimeOrderStatus,
  runtimeFulfillmentStatus,
  stripeChargeRefundState,
  stripeEventClaimDecision,
  stripeEventStatusIsTerminal,
} from '../services/order-state.service.js';
import {
  classifyPrintfulFailure,
  submitPrintfulDraftOrderWithClient,
} from '../services/printful.service.js';

const runtimeStatuses: OrderSummary['status'][] = [
  'draft',
  'quoted',
  'checkout_pending',
  'paid',
  'fulfillment_validating',
  'needs_review',
  'failed',
  'submitted',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

test('durable order statuses survive a cold restore', () => {
  for (const status of runtimeStatuses) {
    assert.equal(restoreRuntimeOrderStatus(persistedOrderStatus(status)), status);
  }
  assert.equal(restoreRuntimeOrderStatus('PAID', 'failed'), 'failed');
  assert.equal(restoreRuntimeOrderStatus('PAID', 'needs_review'), 'needs_review');
  assert.equal(restoreRuntimeOrderStatus('UNKNOWN'), 'draft');
});

test('persisted fulfillment and review values fail closed to safe runtime defaults', () => {
  assert.equal(runtimeFulfillmentStatus('submitted'), 'submitted');
  assert.equal(runtimeFulfillmentStatus('unknown'), 'not_submitted');
  assert.equal(runtimeFulfillmentStatus(null), 'not_submitted');
  assert.equal(normalizeOperatorReviewStatus('acknowledged'), 'acknowledged');
  assert.equal(normalizeOperatorReviewStatus('resolved'), 'resolved');
  assert.equal(normalizeOperatorReviewStatus('unknown'), 'unreviewed');
});

test('Stripe event claims distinguish duplicates, active work, and stale recovery', () => {
  const now = Date.now();
  assert.equal(stripeEventClaimDecision('processed', new Date(now), now), 'duplicate');
  assert.equal(stripeEventClaimDecision('processing', new Date(now - 30_000), now), 'busy');
  assert.equal(stripeEventClaimDecision('retrying', new Date(now - 180_000), now), 'reclaim');
  assert.equal(stripeEventStatusIsTerminal('processing'), false);
  assert.equal(stripeEventStatusIsTerminal('retrying'), false);
  assert.equal(stripeEventStatusIsTerminal('processed'), true);
});

const adminItem = (
  id: string,
  status: OrderSummary['status'],
  overrides: Partial<AdminOrderListItem> = {}
): AdminOrderListItem => ({
  id,
  orderNumber: `OMS-${id}`,
  status,
  fulfillmentStatus:
    status === 'failed' ? 'failed' : status === 'needs_review' ? 'needs_review' : 'not_submitted',
  totalCents: 2000,
  taxCents: 0,
  currency: 'USD',
  createdAt: '2026-07-14T00:00:00.000Z',
  operatorReviewStatus: 'unreviewed',
  ...overrides,
});

test('admin attention filters isolate failed, review, and paid-without-draft orders', () => {
  const items = [
    adminItem('failed', 'failed', { paidAt: '2026-07-14T00:00:00.000Z' }),
    adminItem('review', 'needs_review', { paidAt: '2026-07-14T00:00:00.000Z' }),
    adminItem('missing', 'paid', { paidAt: '2026-07-14T00:00:00.000Z' }),
    adminItem('attached', 'needs_review', {
      paidAt: '2026-07-14T00:00:00.000Z',
      printfulOrderId: 'pf-1',
    }),
    adminItem('refunded', 'refunded', { paidAt: '2026-07-14T00:00:00.000Z' }),
  ];
  assert.deepEqual(
    filterAdminOrderItems(items, { attention: 'failed' }).map((item) => item.id),
    ['failed']
  );
  assert.deepEqual(
    filterAdminOrderItems(items, { attention: 'needs_review' }).map((item) => item.id),
    ['review', 'attached']
  );
  assert.deepEqual(
    filterAdminOrderItems(items, { attention: 'missing_printful' }).map((item) => item.id),
    ['failed', 'review', 'missing']
  );
});

test('Printful retry eligibility requires durable payment and rejects terminal orders', () => {
  assert.equal(
    printfulRetryBlocker({ status: 'FAILED', paidAt: null, stripeSessionId: 'cs_live_1' })
      ?.errorCode,
    'paid_order_required'
  );
  assert.equal(
    printfulRetryBlocker({
      status: 'FAILED',
      paidAt: new Date(),
      stripeSessionId: 'cs_live_1',
      refundedCents: 100,
    })?.errorCode,
    'payment_refunded'
  );
  assert.equal(
    printfulRetryBlocker({
      status: 'REFUNDED',
      paidAt: new Date(),
      stripeSessionId: 'cs_live_1',
    })?.errorCode,
    'order_not_fulfillable'
  );
  assert.equal(
    printfulRetryBlocker({
      status: 'SHIPPED',
      paidAt: new Date(),
      stripeSessionId: 'cs_live_1',
    })?.errorCode,
    'order_not_fulfillable'
  );
  assert.equal(
    printfulRetryBlocker({
      status: 'FAILED',
      paidAt: new Date(),
      stripeSessionId: 'cs_live_1',
    }),
    null
  );
});

test('Printful attempt leases block active work and supersede stale work', () => {
  const now = Date.now();
  assert.equal(printfulAttemptClaimDecision(new Date(now - 30_000), now), 'busy');
  assert.equal(printfulAttemptClaimDecision(new Date(now - 180_000), now), 'supersede');
});

test('Stripe refund state distinguishes partial and full refunds', () => {
  assert.deepEqual(stripeChargeRefundState({ amount: 2500, amount_refunded: 0, refunded: false }), {
    state: 'unrefunded',
    refundedCents: 0,
  });
  assert.deepEqual(
    stripeChargeRefundState({ amount: 2500, amount_refunded: 500, refunded: false }),
    { state: 'partial', refundedCents: 500 }
  );
  assert.deepEqual(
    stripeChargeRefundState({ amount: 2500, amount_refunded: 2500, refunded: true }),
    { state: 'full', refundedCents: 2500 }
  );
});

function retryQuote() {
  const baseProduct = sampleCatalog.products[0];
  const product = {
    ...baseProduct,
    variants: baseProduct.variants.map((variant) => ({
      ...variant,
      printfulVariantId: 123456,
    })),
  };
  return buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: product.variants[0].id,
        quantity: 1,
        placementCodes: [product.placements[0].code],
      },
    ]
  );
}

const submitParams = () => ({
  quote: retryQuote(),
  orderNumber: 'OMS-RETRY-IDEMPOTENT',
  artworkUrl: 'https://example.com/artwork.png',
  recipient: {
    name: 'Example Buyer',
    address1: '100 Main St',
    city: 'Brooklyn',
    stateCode: 'NY',
    countryCode: 'US',
    zip: '11201',
  },
});

test('Printful retry returns an existing external-ID draft without posting another order', async () => {
  let posts = 0;
  const client = {
    get: async () => ({ data: { data: { id: 'pf-existing', status: 'draft' } } }),
    post: async () => {
      posts += 1;
      throw new Error('post should not run');
    },
  } as unknown as AxiosInstance;
  const result = await submitPrintfulDraftOrderWithClient(client, submitParams());
  assert.equal(result.providerOrderId, 'pf-existing');
  assert.equal(result.confirmed, false);
  assert.equal(posts, 0);
});

test('ambiguous Printful failure recovers by external ID instead of creating a duplicate', async () => {
  let lookups = 0;
  let posts = 0;
  const client = {
    get: async () => {
      lookups += 1;
      if (lookups === 1) {
        throw { isAxiosError: true, response: { status: 404 } };
      }
      return { data: { data: { id: 'pf-recovered', status: 'draft' } } };
    },
    post: async () => {
      posts += 1;
      throw new Error('network result unknown');
    },
  } as unknown as AxiosInstance;
  const result = await submitPrintfulDraftOrderWithClient(client, submitParams());
  assert.equal(result.providerOrderId, 'pf-recovered');
  assert.equal(posts, 1);
  assert.equal(lookups, 2);
});

test('Printful lookup failures fail closed before any create attempt', async () => {
  let posts = 0;
  const client = {
    get: async () => {
      throw { isAxiosError: true, response: { status: 401 } };
    },
    post: async () => {
      posts += 1;
      return { data: { data: { id: 'unexpected', status: 'draft' } } };
    },
  } as unknown as AxiosInstance;
  await assert.rejects(() => submitPrintfulDraftOrderWithClient(client, submitParams()));
  assert.equal(posts, 0);
});

test('Printful failure classification is useful without retaining provider payload data', () => {
  const providerError = {
    isAxiosError: true,
    response: {
      status: 422,
      data: { recipient: 'private address', apiKey: 'secret-value' },
    },
  };
  const failure = classifyPrintfulFailure(providerError);
  assert.equal(failure.code, 'printful_validation');
  assert.equal(failure.statusCode, 422);
  assert.doesNotMatch(JSON.stringify(failure), /private address|secret-value/);
});
