import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { createQuote, listProducts } from '../services/catalog.service.js';
import { createDesignDraft } from '../services/design.service.js';
import {
  createCheckoutSession,
  handleStripeCheckoutCompleted,
  listManualReviewOrders,
} from '../services/order.service.js';
import { env } from '../config/env.js';
import { getOrCreateSession } from '../services/runtime-store.js';

test('Stripe-completed merch orders wait for manual fulfillment review', async () => {
  const original = {
    enableLiveStripe: env.enableLiveStripe,
    stripeSecretKey: env.stripeSecretKey,
    checkoutEnabled: env.checkoutEnabled,
    enableLivePrintful: env.enableLivePrintful,
    allowLiveFulfillment: env.allowLiveFulfillment,
    fulfillmentEnabled: env.fulfillmentEnabled,
  };
  env.enableLiveStripe = false;
  env.stripeSecretKey = undefined;
  env.checkoutEnabled = true;
  env.enableLivePrintful = false;
  env.allowLiveFulfillment = false;
  env.fulfillmentEnabled = false;

  try {
    const session = getOrCreateSession();
    const [product] = await listProducts();
    const variant = product.variants[0];
    const placement = product.placements[0];
    const draft = await createDesignDraft('A geometric coffee shop mascot badge', {
      sessionId: session.id,
      productId: product.id,
      variantId: variant.id,
      placementCodes: [placement.code],
    });
    assert.equal(draft.policy.status, 'pass');
    assert.equal(draft.readiness.status, 'pass');

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
      quoteId: quote.id,
      sessionId: session.id,
      designAssetId: draft.id ?? undefined,
      email: 'customer@example.com',
    });
    assert.equal(checkout.status, 'paid');
    assert.ok(checkout.orderId);

    const completed = await handleStripeCheckoutCompleted(
      {
        id: 'cs_test_manual_review',
        metadata: { kind: 'merch_order', orderId: checkout.orderId },
        customer_details: { email: 'customer@example.com' },
        shipping_details: {
          name: 'Example Customer',
          address: {
            line1: '1 Main St',
            city: 'Boston',
            state: 'MA',
            country: 'US',
            postal_code: '02108',
          },
        },
      } as unknown as Stripe.Checkout.Session,
      'evt_manual_review'
    );

    assert.equal(completed?.status, 'needs_review');
    assert.equal(completed?.fulfillment.status, 'needs_review');
    assert.match(completed?.fulfillment.message ?? '', /operator approval|operator review/i);
    assert.equal(completed?.operatorReview?.required, true);
    assert.equal(completed?.operatorReview?.payloadReady, false);
    assert.equal(completed?.operatorReview?.recipientReady, true);
    assert.equal(completed?.recipient?.address1, '1 Main St');

    const reviewQueue = await listManualReviewOrders();
    const queued = reviewQueue.find((item) => item.orderId === checkout.orderId);
    assert.ok(queued);
    assert.equal(queued.orderNumber, completed?.orderNumber);
    assert.equal(queued.paymentStatus, 'paid');
    assert.equal(queued.fulfillmentStatus, 'needs_review');
    assert.equal(queued.customerEmail, 'customer@example.com');
    assert.equal(queued.quoteId, quote.id);
    assert.equal(queued.designAssetId, draft.id);
    assert.equal(queued.recipientReady, true);
    assert.equal(queued.artworkReady, true);
    assert.equal(queued.payloadReady, false);
    assert.match(queued.artworkUrl ?? '', /^http/);
    assert.equal(queued.items.length, 1);
    assert.equal(queued.items[0].productId, product.id);
    assert.equal(queued.items[0].variantId, variant.id);
    assert.deepEqual(queued.items[0].placementCodes, [placement.code]);
    assert.ok(queued.checks.some((check) => check.code === 'mockup'));
  } finally {
    env.enableLiveStripe = original.enableLiveStripe;
    env.stripeSecretKey = original.stripeSecretKey;
    env.checkoutEnabled = original.checkoutEnabled;
    env.enableLivePrintful = original.enableLivePrintful;
    env.allowLiveFulfillment = original.allowLiveFulfillment;
    env.fulfillmentEnabled = original.fulfillmentEnabled;
  }
});
