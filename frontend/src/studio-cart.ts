import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  PlacementLayout,
  QuoteBreakdown,
} from './types/catalog';
import type { PreviewOrientation } from './studio-view-model.types';
import {
  normalizeStudioItemQuantity,
  prepareQuoteRequest,
  type StudioQuoteItemInput,
} from './studio-quote';

export const MAX_STUDIO_CART_LINES = 10;

export type StudioCartItem = {
  id: string;
  addedAt: string;
  productTitle: string;
  variantName: string;
  line: StudioQuoteItemInput;
};

/** Captures an immutable, provider-ready line without retaining a stale quote total. */
export function createStudioCartItem(params: {
  product: CatalogProduct;
  variant: CatalogVariant;
  quantity: number;
  selectedPlacements: string[];
  design: DesignDraft;
  placementArtwork: Record<string, DesignDraft>;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
}): StudioCartItem | null {
  const request = prepareQuoteRequest(params);
  const line = request?.items[0];
  if (!line) return null;
  return {
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
    productTitle: params.product.title,
    variantName: params.variant.name,
    line,
  };
}

export function updateStudioCartItemQuantity(
  item: StudioCartItem,
  quantity: number
): StudioCartItem {
  return {
    ...item,
    line: { ...item.line, quantity: normalizeStudioItemQuantity(quantity) },
  };
}

export function studioCartUnitCount(items: StudioCartItem[]): number {
  return items.reduce((total, item) => total + item.line.quantity, 0);
}

export function prepareCartQuoteRequest(params: {
  items: StudioCartItem[];
  sessionId?: string;
  studioPassId?: string;
}): { sessionId?: string; studioPassId?: string; items: StudioQuoteItemInput[] } | null {
  if (!params.items.length || params.items.length > MAX_STUDIO_CART_LINES) return null;
  return {
    sessionId: params.sessionId,
    studioPassId: params.studioPassId,
    items: params.items.map((item) => item.line),
  };
}

export function cartQuoteMatchesItems(
  quote: QuoteBreakdown | null,
  items: StudioCartItem[]
): boolean {
  return Boolean(
    quote &&
      quote.items.length === items.length &&
      quote.items.every((line, index) => {
        const expected = items[index]?.line;
        return (
          expected &&
          line.productId === expected.productId &&
          line.variantId === expected.variantId &&
          line.quantity === expected.quantity &&
          line.designAssetId === expected.designAssetId
        );
      })
  );
}
