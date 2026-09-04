import type {
  CatalogProduct,
  DesignDraft,
  PlacementLayout,
  QuoteBreakdown,
} from '../types/catalog';
import type { SurfaceError } from '../studio-view-model.types';

export type ReviewPanelStatus = {
  settling: boolean;
  artworkReady: boolean;
  quoteStale: boolean;
  quoteExpired: boolean;
  quoting: boolean;
  mockupBusy: boolean;
  mockupComplete: boolean;
  mockupErrorPresent: boolean;
  revising: boolean;
  quoteError?: SurfaceError;
};

export type ReviewDesignOptions = {
  open: boolean;
  canRevise: boolean;
  hasHistory: boolean;
  canGenerateAnother: boolean;
  revision: string;
};

export type ReviewPanelActions = {
  onQuantityChange: (quantity: number) => void;
  onAddToCart: () => void;
  onEditAreas: () => void;
  onCustomizePlacement: (code: string) => void;
  onReusePlacementArtwork: (sourceCode: string, targetCode: string) => void;
  onRetryQuote: () => void;
  onCheckout: () => void;
  onMakeChanges: () => void;
  onTryAnotherProduct: () => void;
  onOptionsToggle: (open: boolean) => void;
  onRevisionChange: (revision: string) => void;
  onRevise: () => void;
  onUndo: () => void;
  onGenerateAnother: () => void;
};

export type ReviewPanelProps = {
  product: CatalogProduct;
  design: DesignDraft;
  quote: QuoteBreakdown | null;
  quantity: number;
  placementArtwork: Record<string, DesignDraft>;
  selectedPlacementCodes: string[];
  mugLayout: PlacementLayout;
  status: ReviewPanelStatus;
  designOptions: ReviewDesignOptions;
  actions: ReviewPanelActions;
};
