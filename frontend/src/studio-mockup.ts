import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  DesignMockup,
  PlacementLayout,
  PlacementSelection,
} from './types/catalog';
import type { DataSource } from './services/api';
import type { PreviewOrientation } from './studio-view-model.types';
import { buildPlacementSelections, mockupKey } from './studio-view-model.selectors';

export type MockupRequestParameters = {
  product: CatalogProduct;
  variant: CatalogVariant;
  placements: string[];
  draft: DesignDraft;
  artworkByCode: Record<string, DesignDraft>;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
};

export type PreparedMockupRequest = {
  cacheKey: string;
  body: {
    sessionId?: string;
    productId: string;
    variantId: string;
    placementCodes: string[];
    placements: PlacementSelection[];
    designAssetId: string;
    imageUrl: string;
    orientation?: PreviewOrientation;
  };
};

/**
 * Builds both the provider payload and cache identity from the same normalized
 * placement data. Keeping them together prevents a cached preview from being
 * reused for a different front/back artwork assignment.
 */
export function prepareMockupRequest(
  params: MockupRequestParameters,
  sessionId?: string
): PreparedMockupRequest | null {
  if (!params.draft.id || params.draft.readiness.status === 'blocked') return null;
  const placements = buildPlacementSelections(
    params.placements,
    params.draft,
    params.artworkByCode,
    params.mugLayout
  );
  if (placements.some((placement) => !placement.designAssetId)) return null;
  const placementDesigns = Object.fromEntries(
    placements.map((placement) => [placement.code, placement.designAssetId!])
  );

  return {
    cacheKey: mockupKey({
      productId: params.product.id,
      variantId: params.variant.id,
      placements: params.placements,
      draftId: params.draft.id,
      placementDesigns,
      mugLayout: params.mugLayout,
      orientation: params.orientation,
    }),
    body: {
      sessionId,
      productId: params.product.id,
      variantId: params.variant.id,
      placementCodes: params.placements,
      placements,
      designAssetId: params.draft.id,
      imageUrl: params.draft.imageUrl,
      orientation: params.orientation,
    },
  };
}

export function classifyMockupResult(
  mockup: DesignMockup,
  source: DataSource
): {
  failed: boolean;
  analyticsSource: 'printful' | 'fallback';
  announcement: string;
  error?: Error;
} {
  if (mockup.status === 'failed') {
    return {
      failed: true,
      analyticsSource: source === 'live' ? 'printful' : 'fallback',
      announcement:
        'The product preview failed. Your artwork is safe; retry the preview or continue without it.',
      error: new Error(
        mockup.errorMessage || 'The fulfillment provider could not build this mockup.'
      ),
    };
  }
  return {
    failed: false,
    analyticsSource: mockup.provider === 'printful' ? 'printful' : 'fallback',
    announcement: 'Product mockup ready. Your price estimate is updating automatically.',
  };
}
