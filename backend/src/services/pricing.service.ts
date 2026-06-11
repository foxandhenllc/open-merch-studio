import { env } from '../config/env.js';
import type { CatalogProductDto, QuoteBreakdown, QuoteLineInput } from '../types/catalog.js';

export type PricingSettings = {
  currency: string;
  targetMarginPercent: number;
  minMarginCents: number;
  aiDesignFeeCents: number;
  paymentFeePercent: number;
  paymentFeeFixedCents: number;
  studioPassCreditCents: number;
};

export const pricingSettingsFromEnv = (): PricingSettings => ({
  currency: env.defaultCurrency,
  targetMarginPercent: env.targetMarginPercent,
  minMarginCents: env.minMarginCents,
  aiDesignFeeCents: env.aiDesignFeeCents,
  paymentFeePercent: env.paymentFeePercent,
  paymentFeeFixedCents: env.paymentFeeFixedCents,
  studioPassCreditCents: env.studioPassPriceCents,
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
  productType?: string | null,
  settings = pricingSettingsFromEnv()
): number {
  const categoryMultiplier =
    productType === 'sticker'
      ? 1.45
      : productType === 'wall-art'
        ? 1.2
        : productType === 'phone-case'
          ? 1.15
          : 1;
  return Math.max(
    settings.minMarginCents,
    roundCents(productCostCents * (settings.targetMarginPercent / 100) * categoryMultiplier)
  );
}

export function buildQuoteBreakdown(
  products: CatalogProductDto[],
  inputItems: QuoteLineInput[],
  settings = pricingSettingsFromEnv(),
  options: { studioPassCreditCents?: number } = {}
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
    const placements = placementCodes
      .map((placementCode) =>
        product.placements.find((placement) => placement.code === placementCode)
      )
      .filter(Boolean) as Array<(typeof product.placements)[number]>;
    const unavailablePlacement = placementCodes.find(
      (placementCode) => !placements.some((placement) => placement.code === placementCode)
    );
    if (unavailablePlacement) {
      throw new Error(`Placement ${unavailablePlacement} is unavailable for ${product.title}`);
    }
    const placementTechniques = Object.fromEntries(
      placements.map((placement) => [placement.code, placement.technique])
    );

    const unitMarginCents = calculateTargetMarginCents(unitCostCents, product.type, settings);
    const unitRetailCents = unitCostCents + unitMarginCents + settings.aiDesignFeeCents;

    return {
      productId: product.id,
      variantId: variant.id,
      printfulVariantId: variant.printfulVariantId,
      title: product.title,
      variantName: variant.name,
      quantity,
      placementCodes,
      placementTechniques,
      designAssetId: input.designAssetId,
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
      total +
      calculateTargetMarginCents(
        item.unitCostCents,
        productMap.get(item.productId)?.type,
        settings
      ) *
        item.quantity,
    0
  );
  const subtotalBeforeCreditsCents = itemRetailBeforeFees + shippingEstimateCents + paymentFeeCents;
  const studioPassCreditCents = Math.min(
    options.studioPassCreditCents ?? 0,
    settings.studioPassCreditCents,
    subtotalBeforeCreditsCents
  );
  const totalCents = Math.max(0, subtotalBeforeCreditsCents - studioPassCreditCents);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const costLines: QuoteBreakdown['costLines'] = [
    {
      code: 'product-cost',
      label: 'Product and fulfillment base',
      amountCents: productCostCents,
      kind: 'cost',
    },
    {
      code: 'design-allocation',
      label: 'Design readiness allocation',
      amountCents: aiDesignFeeCents,
      kind: 'fee',
    },
    {
      code: 'margin',
      label: 'Studio margin',
      amountCents: targetMarginCents,
      kind: 'margin',
    },
    {
      code: 'shipping-estimate',
      label: 'Shipping estimate',
      amountCents: shippingEstimateCents,
      kind: 'estimate',
    },
    {
      code: 'payment-fee-estimate',
      label: 'Payment fee estimate',
      amountCents: paymentFeeCents,
      kind: 'estimate',
    },
  ];
  if (studioPassCreditCents > 0) {
    costLines.push({
      code: 'studio-pass-credit',
      label: 'Studio Pass credit',
      amountCents: -studioPassCreditCents,
      kind: 'credit',
    });
  }

  return {
    currency: settings.currency,
    productCostCents,
    shippingEstimateCents,
    taxEstimateCents: 0,
    aiDesignFeeCents,
    paymentFeeCents,
    targetMarginCents,
    studioPassCreditCents,
    subtotalBeforeCreditsCents,
    totalCents,
    estimateFlags: {
      shipping: true,
      tax: true,
      paymentFee: true,
    },
    costLines,
    expiresAt,
    items,
  };
}
