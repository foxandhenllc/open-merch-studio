import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import { env } from '../config/env.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { stripeRecipient } from '../services/order.service.js';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import { buildPrintfulOrderPayload } from '../services/printful.service.js';
import { buildStripeCheckoutParams, checkoutAccessBlocker } from '../services/stripe.service.js';

test('checkout access is closed by default and enforces an exact normalized allowlist', () => {
  const originalMode = env.checkoutAccessMode;
  const originalEmails = [...env.checkoutAllowedEmails];
  try {
    env.checkoutAccessMode = 'closed';
    assert.match(checkoutAccessBlocker('buyer@example.com') ?? '', /closed/i);
    env.checkoutAccessMode = 'allowlist';
    env.checkoutAllowedEmails.splice(0, env.checkoutAllowedEmails.length, 'buyer@example.com');
    assert.equal(checkoutAccessBlocker(' Buyer@Example.com '), null);
    assert.match(checkoutAccessBlocker('other@example.com') ?? '', /allowlist/i);
    env.checkoutAccessMode = 'public';
    assert.equal(checkoutAccessBlocker(), null);
  } finally {
    env.checkoutAccessMode = originalMode;
    env.checkoutAllowedEmails.splice(0, env.checkoutAllowedEmails.length, ...originalEmails);
  }
});

test('Stripe Checkout is card-only, US-only, and uses automatic tax', () => {
  const params = buildStripeCheckoutParams({
    kind: 'merch_order',
    amountCents: 2595,
    currency: 'USD',
    name: 'OMS test order',
    customerEmail: 'buyer@example.com',
    metadata: { orderId: 'order-1' },
    collectShipping: true,
  });
  assert.deepEqual(params.payment_method_types, ['card']);
  assert.deepEqual(params.shipping_address_collection?.allowed_countries, ['US']);
  assert.equal(params.automatic_tax?.enabled, true);
});

test('current Stripe collected shipping details map to the Printful recipient', () => {
  const session = {
    collected_information: {
      shipping_details: {
        name: 'Example Buyer',
        address: {
          line1: '100 Main St',
          line2: 'Apt 4B',
          city: 'Brooklyn',
          state: 'NY',
          country: 'US',
          postal_code: '11201',
        },
      },
    },
    customer_details: { email: 'buyer@example.com' },
  } as unknown as Stripe.Checkout.Session;
  assert.deepEqual(stripeRecipient(session), {
    name: 'Example Buyer',
    address1: '100 Main St',
    address2: 'Apt 4B',
    city: 'Brooklyn',
    stateCode: 'NY',
    countryCode: 'US',
    zip: '11201',
    email: 'buyer@example.com',
  });
});

test('tee, tote, mug, sticker, and poster preserve their catalog placement techniques', () => {
  const fixtures = [
    ['fixture-product-heavyweight-shirt', 'dtg'],
    ['fixture-product-tote', 'dtg'],
    ['fixture-product-ceramic-mug', 'sublimation'],
    ['fixture-product-vinyl-sticker', 'digital'],
    ['fixture-product-matte-poster', 'digital'],
  ] as const;
  for (const [productId, expectedTechnique] of fixtures) {
    const base = sampleCatalog.products.find((product) => product.id === productId);
    assert.ok(base);
    const product = {
      ...base,
      variants: base.variants.map((variant, index) => ({
        ...variant,
        printfulVariantId: 10_000 + index,
      })),
    };
    const placement =
      product.placements.find((candidate) => candidate.isDefault) ?? product.placements[0];
    const quote = buildQuoteBreakdown(
      [product],
      [
        {
          productId: product.id,
          variantId: product.variants[0].id,
          quantity: 1,
          placementCodes: [placement.code],
        },
      ]
    );
    assert.equal(quote.items[0].placementTechniques[placement.code], expectedTechnique);
    const payload = buildPrintfulOrderPayload({
      quote,
      artworkUrl: 'https://example.com/art.png',
      recipient: {
        name: 'Example Buyer',
        address1: '100 Main St',
        city: 'Brooklyn',
        stateCode: 'NY',
        countryCode: 'US',
        zip: '11201',
      },
    }) as { order_items: Array<{ placements: Array<{ technique: string }> }> };
    assert.equal(payload.order_items[0].placements[0].technique, expectedTechnique);
  }
});
