import type {
  CatalogProduct,
  DesignDraft,
  PlacementLayout,
  QuoteBreakdown,
} from '../types/catalog';

export type PrintAreaReviewProps = {
  categorySlug?: string | null;
  placements: CatalogProduct['placements'];
  selectedPlacementCodes: string[];
  placementArtwork: Record<string, DesignDraft>;
  defaultArtwork: DesignDraft;
  quote: QuoteBreakdown | null;
  mugLayout: PlacementLayout;
  onEditAreas: () => void;
  onCustomizePlacement: (code: string) => void;
  onReusePlacementArtwork: (sourceCode: string, targetCode: string) => void;
};
