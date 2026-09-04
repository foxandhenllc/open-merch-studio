import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  PlacementLayout,
  QuoteBreakdown,
} from './types/catalog';
import type { PreviewOrientation } from './studio-view-model.types';
import { buildPlacementSelections } from './studio-view-model.selectors';

export const MAX_STUDIO_ITEM_QUANTITY = 25;

export type StudioQuoteItemInput = {
  productId: string;
  variantId: string;
  quantity: number;
  placementCodes: string[];
  placements: ReturnType<typeof buildPlacementSelections>;
  orientation?: PreviewOrientation;
  designAssetId: string;
};

/** Normalizes browser input for presentation; the quote API independently validates the result. */
export function normalizeStudioItemQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_STUDIO_ITEM_QUANTITY, Math.max(1, Math.floor(value)));
}

export function prepareQuoteRequest(params: {
  sessionId?: string;
  studioPassId?: string;
  product: CatalogProduct;
  variant: CatalogVariant;
  selectedPlacements: string[];
  design: DesignDraft;
  placementArtwork: Record<string, DesignDraft>;
  quantity: number;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
}): {
  sessionId?: string;
  studioPassId?: string;
  items: StudioQuoteItemInput[];
} | null {
  if (!params.design.id) return null;
  return {
    sessionId: params.sessionId,
    studioPassId: params.studioPassId,
    items: [
      {
        productId: params.product.id,
        variantId: params.variant.id,
        quantity: normalizeStudioItemQuantity(params.quantity),
        placementCodes: params.selectedPlacements,
        placements: buildPlacementSelections(
          params.selectedPlacements,
          params.design,
          params.placementArtwork,
          params.mugLayout
        ),
        orientation: params.orientation,
        designAssetId: params.design.id,
      },
    ],
  };
}

export function quoteAnnouncement(quote: QuoteBreakdown, automatic: boolean): string {
  const total = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: quote.currency,
  }).format(quote.totalCents / 100);
  return `${automatic ? 'Price estimate ready' : 'Price updated'}: ${total}.`;
}
