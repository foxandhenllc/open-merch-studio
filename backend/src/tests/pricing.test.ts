import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteBreakdown, estimateRetailTotalCents } from '../services/pricing.service.js';
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
      studioPassCreditCents: 500,
    }
  );

  assert.equal(quote.productCostCents, variant.costCents * 2);
  assert.equal(quote.aiDesignFeeCents, 600);
  assert.equal(quote.targetMarginCents, 1000);
  assert.ok(quote.paymentFeeCents > 0);
  assert.equal(quote.studioPassCreditCents, 0);
  assert.equal(
    quote.costLines.some((line) => line.code === 'margin'),
    true
  );
  assert.ok(quote.totalCents > quote.productCostCents);
  assert.deepEqual(
    quote.costLines.map((line) => line.label),
    [
      'Product & printing',
      'Design work',
      'Open Merch Studio margin',
      'Estimated shipping',
      'Card processing estimate',
    ]
  );
  assert.equal(
    estimateRetailTotalCents(variant.costCents, product.type, {
      currency: 'USD',
      targetMarginPercent: 30,
      minMarginCents: 500,
      aiDesignFeeCents: 300,
      paymentFeePercent: 2.9,
      paymentFeeFixedCents: 30,
      studioPassCreditCents: 500,
    }),
    buildQuoteBreakdown(
      [product],
      [
        {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
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
        studioPassCreditCents: 500,
      }
    ).totalCents
  );
});

test('buildQuoteBreakdown applies Studio Pass credit once', () => {
  const product = sampleCatalog.products[0];
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
    ],
    undefined,
    { studioPassCreditCents: 500 }
  );

  assert.equal(quote.studioPassCreditCents, 500);
  assert.equal(quote.totalCents, quote.subtotalBeforeCreditsCents - 500);
  assert.equal(
    quote.costLines.some((line) => line.kind === 'credit'),
    true
  );
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
