import type {
  CatalogProduct,
  CatalogVariant,
  PlacementLayout,
  QuoteBreakdown,
} from '../types/catalog';
import type { PreviewOrientation } from '../studio-view-model.types';

export type ConfigurationPanelProps = {
  product: CatalogProduct;
  variant: CatalogVariant;
  selectedPlacements: string[];
  quote: QuoteBreakdown | null;
  quoteStale: boolean;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
  onVariantChange: (id: string) => void;
  onTogglePlacement: (code: string) => void;
  onMugLayoutChange: (layout: PlacementLayout) => void;
  onOrientationChange: (orientation: PreviewOrientation) => void;
  onContinue: () => void;
};
