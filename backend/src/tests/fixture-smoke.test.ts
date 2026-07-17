import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuote, listProducts } from '../services/catalog.service.js';
import {
  createDesignDraft,
  createDesignIdea,
  createDesignMockup,
} from '../services/design.service.js';
import {
  createCheckoutSession,
  getOrderSummary,
  submitFixtureFulfillment,
} from '../services/order.service.js';
import { getOrCreateSession } from '../services/runtime-store.js';
import { CURRENT_CHECKOUT_POLICY_VERSION } from '../config/policies.js';

test('fixture paid-beta path reaches checkout and fulfillment without credentials', async () => {
  const session = getOrCreateSession();
  const products = await listProducts();
  const product = products[0];
  const variant = product.variants[0];
  const placement = product.placements[0];

  const idea = await createDesignIdea({
    sessionId: session.id,
    productId: product.id,
    placementCodes: [placement.code],
    prompt: 'A friendly geometric studio mark for a launch tote',
  });
  assert.match(idea.refinedPrompt, /production-safe/);

  const draft = await createDesignDraft(idea.refinedPrompt, {
    sessionId: session.id,
    productId: product.id,
    variantId: variant.id,
    placementCodes: [placement.code],
  });
  assert.equal(draft.policy.status, 'pass');
  assert.ok(draft.id);

  const mockup = await createDesignMockup({
    sessionId: session.id,
    productId: product.id,
    variantId: variant.id,
    placementCodes: [placement.code],
    designAssetId: draft.id ?? undefined,
  });
  assert.equal(mockup.status, 'complete');

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
  assert.equal(quote.studioPassCreditCents, 0);

  const missingAcceptance = await createCheckoutSession({
    policyAccepted: false,
    policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
    quoteId: quote.id,
    sessionId: session.id,
    designAssetId: draft.id ?? undefined,
    email: 'fixture@example.com',
  });
  assert.equal(missingAcceptance.status, 'blocked');
  assert.match(missingAcceptance.message, /accept/i);

  const staleAcceptance = await createCheckoutSession({
    policyAccepted: true,
    policyVersion: '2026-07-16',
    quoteId: quote.id,
    sessionId: session.id,
    designAssetId: draft.id ?? undefined,
    email: 'fixture@example.com',
  });
  assert.equal(staleAcceptance.status, 'blocked');
  assert.match(staleAcceptance.message, /changed/i);

  const checkout = await createCheckoutSession({
    policyAccepted: true,
    policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
    quoteId: quote.id,
    sessionId: session.id,
    designAssetId: draft.id ?? undefined,
    email: 'fixture@example.com',
  });
  assert.equal(checkout.status, 'paid');
  assert.ok(checkout.orderId);

  const checkoutOrder = await getOrderSummary(checkout.orderId ?? '');
  assert.equal(checkoutOrder?.policyVersion, CURRENT_CHECKOUT_POLICY_VERSION);
  assert.ok(checkoutOrder?.policyAcceptedAt);

  const order = await submitFixtureFulfillment(checkout.orderId ?? '');
  assert.equal(order.status, 'submitted');
  assert.equal(order.fulfillment.status, 'submitted');
});
