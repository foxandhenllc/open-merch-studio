import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { env } from '../config/env.js';
import {
  buildPrintfulMockupPayload,
  buildPrintfulOrderPayload,
  extractMockupViews,
  mapPrintfulOrderStatus,
  normalizeCountryCode,
  normalizeStateCode,
  normalizePrintfulTechnique,
  submitPrintfulDraftOrder,
} from '../services/printful.service.js';

test('mockup payloads preserve placement while omitting invalid zero width', () => {
  assert.equal(normalizePrintfulTechnique('sublimation'), 'SUBLIMATION');
  assert.equal(normalizePrintfulTechnique('dtg'), 'DTG');
  assert.equal(normalizePrintfulTechnique('cut_sew'), 'CUT-SEW');
  const payload = buildPrintfulMockupPayload({
    printfulVariantId: 1320,
    placement: 'default',
    designImageUrl: 'https://example.com/artwork.png',
    printfile: { printfile_id: 43, width: 520, height: 202 },
  });
  assert.equal('width' in payload, false);
  assert.equal(payload.files[0].placement, 'default');
  assert.deepEqual(payload.files[0].position, {
    area_width: 520,
    area_height: 202,
    width: 202,
    height: 202,
    top: 0,
    left: 159,
  });
  const portraitPayload = buildPrintfulMockupPayload({
    printfulVariantId: 3876,
    placement: 'default',
    designImageUrl: 'https://example.com/artwork.png',
    printfile: { printfile_id: 55, width: 1800, height: 1200 },
    orientation: 'portrait',
  });
  assert.deepEqual(portraitPayload.files[0].position, {
    area_width: 1200,
    area_height: 1800,
    width: 1200,
    height: 1200,
    top: 300,
    left: 0,
  });
});

test('mockup views keep provider alternatives and prefer a front-facing mug', () => {
  const views = extractMockupViews(
    {
      status: 'completed',
      mockups: [
        {
          placement: 'default',
          display_name: 'Wraparound print',
          mockup_url: 'https://example.com/mug-handle-on-right.png',
          extra: [
            { title: 'Side', url: 'https://example.com/mug-side.png' },
            { title: 'Front', url: 'https://example.com/mug-front.png' },
          ],
        },
      ],
    },
    'default',
    true
  );
  assert.equal(views[0].label, 'Front');
  assert.equal(views[0].imageUrl, 'https://example.com/mug-front.png');
  assert.equal(views.length, 3);
});

test('buildPrintfulOrderPayload keeps placement and retail quote details', () => {
  const baseProduct = sampleCatalog.products[1];
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
        placementCodes: ['embroidery_front'],
      },
    ]
  );

  const payload = buildPrintfulOrderPayload({
    quote,
    artworkUrl: 'https://example.com/artwork.png',
    recipient: {
      name: 'Example Customer',
      address1: '1 Main St',
      address2: 'Suite 200',
      city: 'Boston',
      stateCode: 'MA',
      countryCode: 'US',
      zip: '02108',
    },
  }) as {
    recipient: { address2?: string };
    order_items: Array<{
      placements: Array<{ placement: string; technique: string }>;
    }>;
    retail_costs: { total: string };
  };

  assert.equal(payload.order_items[0].placements[0].placement, 'embroidery_front');
  assert.equal(payload.order_items[0].placements[0].technique, 'embroidery');
  assert.equal(payload.recipient.address2, 'Suite 200');
  assert.equal(payload.retail_costs.total, (quote.totalCents / 100).toFixed(2));
});

test('buildPrintfulOrderPayload rejects missing fulfillment data', () => {
  const product = sampleCatalog.products[1];
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: ['embroidery_front'],
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
  const baseProduct = sampleCatalog.products[1];
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
        placementCodes: ['embroidery_front'],
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
