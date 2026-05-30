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
  createStudioPassCheckout,
  submitFixtureFulfillment,
} from '../services/order.service.js';
import { getOrCreateSession } from '../services/runtime-store.js';

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

  const passCheckout = await createStudioPassCheckout(session.id);
  assert.equal(passCheckout.status, 'paid');

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
    { sessionId: session.id, studioPassId: passCheckout.studioPassId }
  );
  assert.equal(quote.studioPassCreditCents, 500);

  const checkout = await createCheckoutSession({
    quoteId: quote.id,
    sessionId: session.id,
    studioPassId: passCheckout.studioPassId,
    designAssetId: draft.id ?? undefined,
    email: 'fixture@example.com',
  });
  assert.equal(checkout.status, 'paid');
  assert.ok(checkout.orderId);

  const order = await submitFixtureFulfillment(checkout.orderId ?? '');
  assert.equal(order.status, 'submitted');
  assert.equal(order.fulfillment.status, 'submitted');
});
