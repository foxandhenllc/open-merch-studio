import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteBreakdown } from '../services/pricing.service.js';
import { sampleCatalog } from '../services/catalog-fixtures.js';

test('buildQuoteBreakdown creates transparent cost-plus totals', () => {
  const product = sampleCatalog.products[0];
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 2,
        placementCodes: ['front'],
      },
    ],
    {
      currency: 'USD',
      targetMarginPercent: 30,
      minMarginCents: 500,
      aiDesignFeeCents: 300,
      paymentFeePercent: 2.9,
      paymentFeeFixedCents: 30,
    }
  );

  assert.equal(quote.productCostCents, variant.costCents * 2);
  assert.equal(quote.aiDesignFeeCents, 600);
  assert.equal(quote.targetMarginCents, 1000);
  assert.ok(quote.paymentFeeCents > 0);
  assert.ok(quote.totalCents > quote.productCostCents);
});

test('buildQuoteBreakdown rejects unknown variants', () => {
  const product = sampleCatalog.products[0];
  assert.throws(() =>
    buildQuoteBreakdown(
      [product],
      [
        {
          productId: product.id,
          variantId: 'missing',
          quantity: 1,
          placementCodes: ['front'],
        },
      ]
    )
  );
});
