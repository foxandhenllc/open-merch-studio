import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuote, listProducts } from '../services/catalog.service.js';
import { env } from '../config/env.js';
import { createDesignDraft } from '../services/design.service.js';
import {
  createCheckoutSession,
  createStudioPassCheckout,
  getOrderByCheckoutSession,
} from '../services/order.service.js';
import { getOrCreateSession, saveOrder } from '../services/runtime-store.js';
import {
  checkoutPolicyAcceptanceIssue,
  CURRENT_CHECKOUT_POLICY_VERSION,
} from '../config/policies.js';

const acceptedCheckoutPolicies = {
  policyAccepted: true,
  policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
};

async function firstProductSelection() {
  const products = await listProducts();
  const product = products[0];
  const variant = product.variants[0];
  const placement = product.placements[0];
  return { product, variant, placement };
}

test('Studio Pass checkout is blocked by its server-side feature gate', async () => {
  const originalEnabled = env.studioPassEnabled;
  env.studioPassEnabled = false;
  try {
    const checkout = await createStudioPassCheckout('session-disabled-pass');
    assert.equal(checkout.status, 'blocked');
    assert.equal(checkout.checkoutUrl, null);
  } finally {
    env.studioPassEnabled = originalEnabled;
  }
});

test('checkout policy acceptance requires an explicit flag and exact current version', () => {
  assert.match(
    checkoutPolicyAcceptanceIssue({
      policyAccepted: false,
      policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
    }) ?? '',
    /accept/i
  );
  assert.match(
    checkoutPolicyAcceptanceIssue({ policyAccepted: true, policyVersion: '2026-07-16' }) ?? '',
    /changed/i
  );
  assert.equal(checkoutPolicyAcceptanceIssue(acceptedCheckoutPolicies), null);
});

test('checkout blocks quotes without generated or uploaded artwork', async () => {
  const session = getOrCreateSession();
  const { product, variant, placement } = await firstProductSelection();
  const quote = await createQuote(
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: [placement.code],
      },
    ],
    { sessionId: session.id }
  );

  const checkout = await createCheckoutSession({
    ...acceptedCheckoutPolicies,
    quoteId: quote.id,
    sessionId: session.id,
  });

  assert.equal(checkout.status, 'blocked');
  assert.match(checkout.message, /requires generated or uploaded artwork/i);
});

test('checkout blocks artwork that needs policy review', async () => {
  const session = getOrCreateSession();
  const { product, variant, placement } = await firstProductSelection();
  const draft = await createDesignDraft('A clean logo-style mark for a local garden club', {
    sessionId: session.id,
    productId: product.id,
    variantId: variant.id,
    placementCodes: [placement.code],
  });
  assert.equal(draft.policy.status, 'needs_review');
  assert.ok(draft.id);

  const quote = await createQuote(
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: [placement.code],
        designAssetId: draft.id ?? undefined,
      },
    ],
    { sessionId: session.id }
  );

  const checkout = await createCheckoutSession({
    ...acceptedCheckoutPolicies,
    quoteId: quote.id,
    sessionId: session.id,
    designAssetId: draft.id ?? undefined,
  });

  assert.equal(checkout.status, 'blocked');
  assert.match(checkout.message, /policy review/i);
});

test('checkout blocks artwork that has not passed print-readiness checks', async () => {
  const session = getOrCreateSession();
  const { product, variant, placement } = await firstProductSelection();
  const draft = await createDesignDraft('Small badge', {
    sessionId: session.id,
    productId: product.id,
    variantId: variant.id,
    placementCodes: [],
  });
  assert.equal(draft.readiness.status, 'warning');
  assert.ok(draft.id);

  const quote = await createQuote(
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: [placement.code],
        designAssetId: draft.id ?? undefined,
      },
    ],
    { sessionId: session.id }
  );

  const checkout = await createCheckoutSession({
    ...acceptedCheckoutPolicies,
    quoteId: quote.id,
    sessionId: session.id,
    designAssetId: draft.id ?? undefined,
  });

  assert.equal(checkout.status, 'blocked');
  assert.match(checkout.message, /print-readiness/i);
});

test('checkout return lookup restores the order from its Stripe session ID', async () => {
  const stripeSessionId = 'cs_test_return_lookup';
  saveOrder({
    id: 'order-return-lookup',
    orderNumber: 'OMS-TEST-RETURN',
    stripeSessionId,
    status: 'paid',
    taxCents: 0,
    totalCents: 2595,
    currency: 'USD',
    fulfillment: {
      provider: 'printful-ready',
      status: 'needs_review',
      message: 'Payment received. Fulfillment remains paused.',
    },
    timeline: [
      {
        at: new Date().toISOString(),
        status: 'paid',
        note: 'Stripe checkout completed.',
      },
    ],
    createdAt: new Date().toISOString(),
  });

  const restored = await getOrderByCheckoutSession(stripeSessionId);

  assert.equal(restored.state, 'paid');
  assert.equal(restored.order?.id, 'order-return-lookup');
  assert.equal(restored.order?.status, 'paid');
});
