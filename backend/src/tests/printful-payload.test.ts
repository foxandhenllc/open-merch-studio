import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';
import { buildPrintfulOrderPayload } from '../services/printful.service.js';

test('buildPrintfulOrderPayload keeps placement and retail quote details', () => {
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

  assert.equal(payload.order_items[0].placements[0].placement, 'embroidery_front');
  assert.equal(payload.order_items[0].placements[0].technique, 'embroidery');
  assert.equal(payload.retail_costs.total, (quote.totalCents / 100).toFixed(2));
});
