import type { DesignDraft, QuoteBreakdown } from '../types/catalog.js';
import { productionPrintReadiness } from '../utils/print-readiness.js';
import { listProducts } from './catalog.service.js';

export type CheckoutDesignState = {
  id: string;
  purpose?: string;
  imageUrl?: string | null;
  generationStatus: string;
  policyStatus: string;
  readinessStatus: string;
  readinessReport?: DesignDraft['readiness'];
};

export function checkoutDesignIssue(design: CheckoutDesignState | undefined): string | null {
  if (!design) return 'Selected artwork could not be verified for checkout.';
  if (design.purpose === 'reference') {
    return 'Reference images must be turned into print artwork first.';
  }
  if (!design.imageUrl) return 'Selected artwork is missing a generated or uploaded image.';
  if (design.generationStatus !== 'complete') {
    return 'Selected artwork has not completed generation successfully.';
  }
  if (design.policyStatus !== 'pass') {
    return 'Selected artwork needs policy review before checkout.';
  }
  const readiness = design.readinessReport
    ? productionPrintReadiness(design.readinessReport)
    : null;
  if (readiness ? readiness.status !== 'pass' : design.readinessStatus !== 'pass') {
    return 'Selected artwork must pass print-readiness checks before checkout.';
  }
  return null;
}

export function checkoutDesignAssetIds(
  quote: QuoteBreakdown,
  additionalDesignAssetId?: string
): string[] {
  const ids = new Set(
    quote.items
      .flatMap((item) => [
        item.designAssetId,
        ...item.placements.map((placement) => placement.designAssetId),
      ])
      .filter(Boolean) as string[]
  );
  if (additionalDesignAssetId) ids.add(additionalDesignAssetId);
  return Array.from(ids);
}

export async function validateQuoteForCheckout(
  quote: QuoteBreakdown,
  requireProviderMetadata = false
): Promise<string[]> {
  const issues: string[] = [];
  const products = await listProducts();
  for (const item of quote.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    if (!product) issues.push(`Product ${item.productId} is no longer sellable.`);
    if (!variant) issues.push(`Variant ${item.variantId} is no longer available.`);
    if (requireProviderMetadata && !item.printfulVariantId) {
      issues.push(`Provider variant metadata is missing for ${item.title}.`);
    }
    const unavailablePlacement = item.placementCodes.find(
      (placementCode) => !product?.placements.some((placement) => placement.code === placementCode)
    );
    if (unavailablePlacement) {
      issues.push(
        `Placement ${unavailablePlacement} is unavailable for ${product?.title ?? 'item'}.`
      );
    }
    const missingTechnique = item.placementCodes.find(
      (placementCode) => !item.placementTechniques[placementCode]
    );
    if (requireProviderMetadata && missingTechnique) {
      issues.push(`Provider technique metadata is missing for ${item.title} ${missingTechnique}.`);
    }
  }
  return issues;
}
