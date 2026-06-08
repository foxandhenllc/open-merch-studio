import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { env } from '../config/env.js';
import {
  buildPrintfulOrderPayload,
  mapPrintfulOrderStatus,
  normalizeCountryCode,
  normalizeStateCode,
  submitPrintfulDraftOrder,
} from '../services/printful.service.js';

test('buildPrintfulOrderPayload keeps placement and retail quote details', () => {
  const baseProduct = sampleCatalog.products[0];
  const product = {
    ...baseProduct,
    variants: baseProduct.variants.map((variant) => ({
      ...variant,
      printfulVariantId: 123456,
    })),
  };
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: ['front'],
      },
    ]
  );

  const payload = buildPrintfulOrderPayload({
    quote,
    artworkUrl: 'https://example.com/artwork.png',
    recipient: {
      name: 'Example Customer',
      address1: '1 Main St',
      city: 'Boston',
      stateCode: 'MA',
      countryCode: 'US',
      zip: '02108',
    },
  }) as {
    order_items: Array<{
      placements: Array<{ placement: string; technique: string }>;
    }>;
    retail_costs: { total: string };
  };

  assert.equal(payload.order_items[0].placements[0].placement, 'front');
  assert.equal(payload.order_items[0].placements[0].technique, 'dtg');
  assert.equal(payload.retail_costs.total, (quote.totalCents / 100).toFixed(2));
});

test('buildPrintfulOrderPayload uses catalog placement technique for non-apparel products', () => {
  const product = sampleCatalog.products.find((candidate) => candidate.slug === 'ceramic-mug');
  assert.ok(product);
  const variant = product.variants[0];
  const placement = product.placements[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: [placement.code],
      },
    ]
  );

  const payload = buildPrintfulOrderPayload({
    quote,
    artworkUrl: 'https://example.com/artwork.png',
    recipient: {
      name: 'Example Customer',
      address1: '1 Main St',
      city: 'Boston',
      stateCode: 'MA',
      countryCode: 'US',
      zip: '02108',
    },
  }) as {
    order_items: Array<{
      placements: Array<{ placement: string; technique: string }>;
    }>;
  };

  assert.equal(payload.order_items[0].placements[0].placement, 'default');
  assert.equal(payload.order_items[0].placements[0].technique, 'sublimation');
});

test('buildPrintfulOrderPayload rejects missing fulfillment data', () => {
  const baseProduct = sampleCatalog.products[0];
  const product = {
    ...baseProduct,
    variants: baseProduct.variants.map((variant) => ({
      ...variant,
      printfulVariantId: undefined,
    })),
  };
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: ['front'],
      },
    ]
  );

  assert.throws(
    () =>
      buildPrintfulOrderPayload({
        quote,
        artworkUrl: 'https://example.com/artwork.png',
        recipient: {
          name: 'Example Customer',
          address1: '1 Main St',
          city: 'Boston',
          stateCode: 'MA',
          countryCode: 'US',
          zip: '02108',
        },
      }),
    /catalog variant ID/
  );
  assert.throws(
    () =>
      buildPrintfulOrderPayload({
        quote: { ...quote, items: [{ ...quote.items[0], printfulVariantId: 123456 }] },
        artworkUrl: 'data:image/png;base64,abc123',
        recipient: {
          name: 'Example Customer',
          address1: '1 Main St',
          city: 'Boston',
          stateCode: 'MA',
          countryCode: 'US',
          zip: '02108',
        },
      }),
    /public HTTP/
  );
});

test('submitPrintfulDraftOrder refuses auto-confirm during paid beta', async () => {
  const original = {
    printfulApiKey: env.printfulApiKey,
    enableLivePrintful: env.enableLivePrintful,
    allowLiveFulfillment: env.allowLiveFulfillment,
    printfulAutoConfirmOrders: env.printfulAutoConfirmOrders,
  };
  const baseProduct = sampleCatalog.products[0];
  const product = {
    ...baseProduct,
    variants: baseProduct.variants.map((variant) => ({
      ...variant,
      printfulVariantId: 123456,
    })),
  };
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: ['front'],
      },
    ]
  );

  env.printfulApiKey = 'test-printful-key';
  env.enableLivePrintful = true;
  env.allowLiveFulfillment = true;
  env.printfulAutoConfirmOrders = true;
  try {
    await assert.rejects(
      () =>
        submitPrintfulDraftOrder({
          quote,
          orderNumber: 'OMS-TEST-AUTOCONFIRM',
          artworkUrl: 'https://example.com/artwork.png',
          recipient: {
            name: 'Example Customer',
            address1: '1 Main St',
            city: 'Boston',
            stateCode: 'MA',
            countryCode: 'US',
            zip: '02108',
          },
        }),
      /auto-confirm is disabled/
    );
  } finally {
    env.printfulApiKey = original.printfulApiKey;
    env.enableLivePrintful = original.enableLivePrintful;
    env.allowLiveFulfillment = original.allowLiveFulfillment;
    env.printfulAutoConfirmOrders = original.printfulAutoConfirmOrders;
  }
});

test('Printful helpers normalize shipping codes and provider statuses', () => {
  assert.equal(normalizeCountryCode('United States'), 'US');
  assert.equal(normalizeCountryCode('Canada'), 'CA');
  assert.equal(normalizeStateCode('New York'), 'NY');
  assert.deepEqual(mapPrintfulOrderStatus('shipped'), {
    orderStatus: 'shipped',
    fulfillmentStatus: 'submitted',
  });
  assert.deepEqual(mapPrintfulOrderStatus('unexpected'), {
    orderStatus: 'needs_review',
    fulfillmentStatus: 'needs_review',
  });
});
