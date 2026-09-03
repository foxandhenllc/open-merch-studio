import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  PlacementLayout,
  QuoteBreakdown,
} from './types/catalog';
import type { PreviewOrientation } from './studio-view-model.types';
import { buildPlacementSelections } from './studio-view-model.selectors';

export function prepareQuoteRequest(params: {
  sessionId?: string;
  studioPassId?: string;
  product: CatalogProduct;
  variant: CatalogVariant;
  selectedPlacements: string[];
  design: DesignDraft;
  placementArtwork: Record<string, DesignDraft>;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
}) {
  if (!params.design.id) return null;
  return {
    sessionId: params.sessionId,
    studioPassId: params.studioPassId,
    items: [
      {
        productId: params.product.id,
        variantId: params.variant.id,
        quantity: 1,
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
