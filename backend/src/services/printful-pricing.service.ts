import { env } from '../config/env.js';
import { createPrintfulClient, unwrapPrintfulResponse } from './printful-client.service.js';

type PrintfulVariantPriceResult = {
  currency?: string;
  product?: {
    placements?: Array<{
      id?: string;
      technique_key?: string;
      price?: string | number | null;
      discounted_price?: string | number | null;
    }>;
  };
  variant?: {
    id?: number;
    techniques?: Array<{
      technique_key?: string;
      price?: string | number | null;
      discounted_price?: string | number | null;
    }>;
  };
};

export type PrintfulVariantPricing = {
  baseCostCents: number;
  placementCostsCents: Record<string, number>;
  source: 'printful-live';
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const variantPricingCache = new Map<number, { expiresAt: number; value: PrintfulVariantPricing }>();

const moneyToCents = (value: string | number | null | undefined): number => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
};

/**
 * Fetches current provider cost by variant and technique. The short in-process cache prevents one
 * quote from multiplying provider calls while keeping the resulting customer quote time-bounded.
 */
export async function fetchPrintfulVariantPricing(params: {
  printfulVariantId: number;
  technique: string;
}): Promise<PrintfulVariantPricing> {
  const cached = variantPricingCache.get(params.printfulVariantId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!env.printfulApiKey || !env.enableLivePrintful) {
    throw new Error('Live Printful pricing is unavailable.');
  }
  const response = await createPrintfulClient().get(
    `/v2/catalog-variants/${params.printfulVariantId}/prices`,
    {
      params: {
        selling_region_name: env.printfulSellingRegion,
        currency: env.defaultCurrency,
        production_currency: env.defaultCurrency,
      },
    }
  );
  const result = unwrapPrintfulResponse<PrintfulVariantPriceResult>(response.data);
  const techniqueKey = params.technique.toLowerCase();
  const technique =
    result.variant?.techniques?.find(
      (candidate) => candidate.technique_key?.toLowerCase() === techniqueKey
    ) ?? result.variant?.techniques?.[0];
  const baseCostCents = moneyToCents(technique?.discounted_price ?? technique?.price);
  if (!baseCostCents) throw new Error('Printful did not return a usable variant price.');
  const placementCostsCents = Object.fromEntries(
    (result.product?.placements ?? [])
      .filter(
        (placement) =>
          placement.id &&
          (!placement.technique_key || placement.technique_key.toLowerCase() === techniqueKey)
      )
      .map((placement) => [String(placement.id), moneyToCents(placement.price)])
  );
  const value: PrintfulVariantPricing = {
    baseCostCents,
    placementCostsCents,
    source: 'printful-live',
  };
  variantPricingCache.set(params.printfulVariantId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
  return value;
}
