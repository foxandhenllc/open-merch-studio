import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuoteBreakdown,
  estimateRetailTotalCents,
  MAX_QUOTE_ITEM_QUANTITY,
  validateQuoteItemQuantity,
} from '../services/pricing.service.js';
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
      'Product & first print',
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

test('buildQuoteBreakdown prices a second print area and keeps its artwork assignment', () => {
  const product = sampleCatalog.products[0];
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: ['front', 'back'],
        placements: [
          { code: 'front', designAssetId: 'art-front' },
          { code: 'back', designAssetId: 'art-back' },
        ],
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

  assert.equal(quote.placementCostCents, 595);
  assert.equal(quote.productCostCents, variant.costCents + 595);
  assert.equal(quote.aiDesignFeeCents, 600);
  assert.deepEqual(
    quote.items[0].placements.map((placement) => ({
      code: placement.code,
      designAssetId: placement.designAssetId,
      additionalCostCents: placement.additionalCostCents,
    })),
    [
      { code: 'front', designAssetId: 'art-front', additionalCostCents: 0 },
      { code: 'back', designAssetId: 'art-back', additionalCostCents: 595 },
    ]
  );
  assert.equal(
    quote.costLines.find((line) => line.code === 'additional-print-areas')?.amountCents,
    595
  );
});

test('buildQuoteBreakdown prefers live provider placement pricing', () => {
  const product = sampleCatalog.products[0];
  const variant = product.variants[0];
  const quote = buildQuoteBreakdown(
    [product],
    [
      {
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        placementCodes: ['front', 'back'],
      },
    ],
    undefined,
    {
      providerPricingByVariantId: {
        [variant.id]: {
          baseCostCents: 1675,
          placementCostsCents: { front: 725, back: 725 },
          source: 'printful-live',
        },
      },
    }
  );

  assert.equal(quote.items[0].pricingSource, 'printful-live');
  assert.equal(quote.items[0].placementCostCents, 725);
  assert.equal(quote.items[0].unitCostCents, 2400);
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

test('quote quantities are bounded before a customer can create an oversized charge', () => {
  assert.equal(validateQuoteItemQuantity(1), 1);
  assert.equal(validateQuoteItemQuantity(MAX_QUOTE_ITEM_QUANTITY), MAX_QUOTE_ITEM_QUANTITY);
  assert.throws(() => validateQuoteItemQuantity(0), /whole number/);
  assert.throws(() => validateQuoteItemQuantity(1.5), /whole number/);
  assert.throws(() => validateQuoteItemQuantity(MAX_QUOTE_ITEM_QUANTITY + 1), /whole number/);
});
