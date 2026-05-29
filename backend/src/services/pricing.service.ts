import { env } from '../config/env.js';
import type { CatalogProductDto, QuoteBreakdown, QuoteLineInput } from '../types/catalog.js';

export type PricingSettings = {
  currency: string;
  targetMarginPercent: number;
  minMarginCents: number;
  aiDesignFeeCents: number;
  paymentFeePercent: number;
  paymentFeeFixedCents: number;
};

export const pricingSettingsFromEnv = (): PricingSettings => ({
  currency: env.defaultCurrency,
  targetMarginPercent: env.targetMarginPercent,
  minMarginCents: env.minMarginCents,
  aiDesignFeeCents: env.aiDesignFeeCents,
  paymentFeePercent: env.paymentFeePercent,
  paymentFeeFixedCents: env.paymentFeeFixedCents,
});

const roundCents = (value: number) => Math.max(0, Math.round(value));

export function estimateShippingCents(productCount: number): number {
  if (productCount <= 0) return 0;
  return 495 + Math.max(0, productCount - 1) * 175;
}

export function calculatePaymentFeeCents(
  subtotalCents: number,
  settings = pricingSettingsFromEnv()
): number {
  return roundCents(
    subtotalCents * (settings.paymentFeePercent / 100) + settings.paymentFeeFixedCents
  );
}

export function calculateTargetMarginCents(
  productCostCents: number,
  settings = pricingSettingsFromEnv()
): number {
  return Math.max(
    settings.minMarginCents,
    roundCents(productCostCents * (settings.targetMarginPercent / 100))
  );
}

export function buildQuoteBreakdown(
  products: CatalogProductDto[],
  inputItems: QuoteLineInput[],
  settings = pricingSettingsFromEnv()
): QuoteBreakdown {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const items = inputItems.map((input) => {
    const product = productMap.get(input.productId);
    if (!product) {
      throw new Error(`Unknown product ${input.productId}`);
    }

    const variant = product.variants.find((candidate) => candidate.id === input.variantId);
    if (!variant) {
      throw new Error(`Unknown variant ${input.variantId}`);
    }

    const placementCodes = input.placementCodes.length
      ? input.placementCodes
      : product.placements
          .filter((placement) => placement.isDefault)
          .map((placement) => placement.code);

    if (!placementCodes.length) {
      throw new Error(`No print placement selected for ${product.title}`);
    }

    const quantity = Math.max(1, Math.floor(input.quantity || 1));
    const unitCostCents = variant.costCents;
    const unitMarginCents = calculateTargetMarginCents(unitCostCents, settings);
    const unitRetailCents = unitCostCents + unitMarginCents + settings.aiDesignFeeCents;

    return {
      productId: product.id,
      variantId: variant.id,
      printfulVariantId: variant.printfulVariantId,
      title: product.title,
      variantName: variant.name,
      quantity,
      placementCodes,
      unitCostCents,
      unitRetailCents,
    };
  });

  const productCostCents = items.reduce(
    (total, item) => total + item.unitCostCents * item.quantity,
    0
  );
  const itemRetailBeforeFees = items.reduce(
    (total, item) => total + item.unitRetailCents * item.quantity,
    0
  );
  const aiDesignFeeCents = items.reduce(
    (total, item) => total + settings.aiDesignFeeCents * item.quantity,
    0
  );
  const shippingEstimateCents = estimateShippingCents(
    items.reduce((total, item) => total + item.quantity, 0)
  );
  const paymentFeeCents = calculatePaymentFeeCents(
    itemRetailBeforeFees + shippingEstimateCents,
    settings
  );
  const targetMarginCents = items.reduce(
    (total, item) =>
      total + calculateTargetMarginCents(item.unitCostCents, settings) * item.quantity,
    0
  );
  const totalCents = itemRetailBeforeFees + shippingEstimateCents + paymentFeeCents;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  return {
    currency: settings.currency,
    productCostCents,
    shippingEstimateCents,
    taxEstimateCents: 0,
    aiDesignFeeCents,
    paymentFeeCents,
    targetMarginCents,
    totalCents,
    expiresAt,
    items,
  };
}
