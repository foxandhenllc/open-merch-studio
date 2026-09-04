import { env } from '../config/env.js';
import type {
  CatalogProductDto,
  PlacementSelection,
  QuoteBreakdown,
  QuoteLineInput,
} from '../types/catalog.js';
import type { PrintfulVariantPricing } from './printful.service.js';

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

export const MAX_QUOTE_ITEM_QUANTITY = 25;
export const MAX_QUOTE_LINE_ITEMS = 10;

/**
 * Enforces the commerce-wide per-line quantity limit at the pricing boundary.
 * Callers must reject invalid input instead of silently rounding it before a quote is persisted.
 */
export function validateQuoteItemQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_QUOTE_ITEM_QUANTITY) {
    throw new Error(`Quantity must be a whole number from 1 to ${MAX_QUOTE_ITEM_QUANTITY}.`);
  }
  return value;
}

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

export function estimateRetailTotalCents(
  productCostCents: number,
  productType?: string | null,
  settings = pricingSettingsFromEnv()
): number {
  const itemRetailCents =
    productCostCents +
    calculateTargetMarginCents(productCostCents, productType, settings) +
    settings.aiDesignFeeCents;
  const shippingEstimateCents = estimateShippingCents(1);
  return (
    itemRetailCents +
    shippingEstimateCents +
    calculatePaymentFeeCents(itemRetailCents + shippingEstimateCents, settings)
  );
}

export function buildQuoteBreakdown(
  products: CatalogProductDto[],
  inputItems: QuoteLineInput[],
  settings = pricingSettingsFromEnv(),
  options: {
    studioPassCreditCents?: number;
    designFeeCentsByAssetId?: Record<string, number>;
    providerPricingByVariantId?: Record<string, PrintfulVariantPricing>;
  } = {}
): QuoteBreakdown {
  if (inputItems.length > MAX_QUOTE_LINE_ITEMS) {
    throw new Error(`A quote can contain at most ${MAX_QUOTE_LINE_ITEMS} configured products.`);
  }
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

    const requestedPlacements: PlacementSelection[] = input.placements?.length
      ? input.placements
      : input.placementCodes.length
        ? input.placementCodes.map((code) => ({ code, designAssetId: input.designAssetId }))
        : product.placements
            .filter((placement) => placement.isDefault)
            .map((placement) => ({ code: placement.code, designAssetId: input.designAssetId }));
    const placements = Array.from(
      new Map(requestedPlacements.map((placement) => [placement.code, placement])).values()
    );
    const placementCodes = placements.length
      ? placements.map((placement) => placement.code)
      : product.placements
          .filter((placement) => placement.isDefault)
          .map((placement) => placement.code);

    if (!placementCodes.length) {
      throw new Error(`No print placement selected for ${product.title}`);
    }

    const quantity = validateQuoteItemQuantity(input.quantity);
    const unavailablePlacement = placementCodes.find(
      (placementCode) => !product.placements.some((placement) => placement.code === placementCode)
    );
    if (unavailablePlacement) {
      throw new Error(`Placement ${unavailablePlacement} is unavailable for ${product.title}`);
    }
    const placementTechniques = Object.fromEntries(
      placementCodes.map((placementCode) => {
        const placement = product.placements.find((candidate) => candidate.code === placementCode);
        if (!placement?.technique) {
          throw new Error(`Technique for ${placementCode} is unavailable for ${product.title}`);
        }
        return [placementCode, placement.technique];
      })
    );

    const providerPricing = options.providerPricingByVariantId?.[variant.id];
    const baseCostCents = providerPricing?.baseCostCents || variant.costCents;
    const resolvedPlacements = placements.map((selection, index) => {
      const placement = product.placements.find((candidate) => candidate.code === selection.code)!;
      const providerCost = providerPricing?.placementCostsCents[selection.code];
      const additionalCostCents =
        index === 0 ? 0 : (providerCost ?? placement.additionalPriceCents ?? 0);
      return {
        ...selection,
        technique: placement.technique,
        additionalCostCents,
      };
    });
    const placementCostCents = resolvedPlacements.reduce(
      (total, placement) => total + placement.additionalCostCents,
      0
    );
    const unitCostCents = baseCostCents + placementCostCents;

    const unitMarginCents = calculateTargetMarginCents(unitCostCents, product.type, settings);
    const designAssetIds = Array.from(
      new Set(
        resolvedPlacements
          .map((placement) => placement.designAssetId)
          .filter((assetId): assetId is string => Boolean(assetId))
      )
    );
    const legacyDesignAssetId = input.designAssetId ?? designAssetIds[0];
    const designFeeCents = designAssetIds.length
      ? designAssetIds.reduce(
          (total, assetId) =>
            total + (options.designFeeCentsByAssetId?.[assetId] ?? settings.aiDesignFeeCents),
          0
        )
      : legacyDesignAssetId
        ? (options.designFeeCentsByAssetId?.[legacyDesignAssetId] ?? settings.aiDesignFeeCents)
        : settings.aiDesignFeeCents;
    const unitRetailCents = unitCostCents + unitMarginCents + designFeeCents;

    return {
      productId: product.id,
      variantId: variant.id,
      printfulVariantId: variant.printfulVariantId,
      title: product.title,
      variantName: variant.name,
      quantity,
      placementCodes,
      placementTechniques,
      placements: resolvedPlacements,
      orientation: input.orientation,
      designAssetId: legacyDesignAssetId,
      designFeeCents,
      placementCostCents,
      pricingSource: providerPricing ? ('printful-live' as const) : ('catalog-snapshot' as const),
      unitCostCents,
      unitRetailCents,
    };
  });

  const productCostCents = items.reduce(
    (total, item) => total + item.unitCostCents * item.quantity,
    0
  );
  const placementCostCents = items.reduce(
    (total, item) => total + item.placementCostCents * item.quantity,
    0
  );
  const itemRetailBeforeFees = items.reduce(
    (total, item) => total + item.unitRetailCents * item.quantity,
    0
  );
  const aiDesignFeeCents = items.reduce(
    (total, item) => total + item.designFeeCents * item.quantity,
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
      label: 'Product & first print',
      amountCents: productCostCents - placementCostCents,
      kind: 'cost',
    },
    ...(placementCostCents > 0
      ? [
          {
            code: 'additional-print-areas',
            label: 'Additional print areas',
            amountCents: placementCostCents,
            kind: 'cost' as const,
          },
        ]
      : []),
    {
      code: 'design-allocation',
      label: aiDesignFeeCents > 0 ? 'Design work' : 'Customer-supplied artwork',
      amountCents: aiDesignFeeCents,
      kind: 'fee',
    },
    {
      code: 'margin',
      label: 'Open Merch Studio margin',
      amountCents: targetMarginCents,
      kind: 'margin',
    },
    {
      code: 'shipping-estimate',
      label: 'Estimated shipping',
      amountCents: shippingEstimateCents,
      kind: 'estimate',
    },
    {
      code: 'payment-fee-estimate',
      label: 'Card processing estimate',
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
    placementCostCents,
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
