export type CatalogCategory = {
  id: string;
  printfulId?: number | null;
  title: string;
  slug: string;
  imageUrl?: string | null;
  isLaunchCategory: boolean;
};

export type PlacementOption = {
  code: string;
  displayName: string;
  technique: string;
  isDefault: boolean;
  width?: number;
  height?: number;
};

export type CatalogVariant = {
  id: string;
  printfulVariantId?: number | null;
  name: string;
  size?: string | null;
  color?: string | null;
  colorCode?: string | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  costCents: number;
};

export type CatalogProduct = {
  id: string;
  printfulId?: number | null;
  title: string;
  slug: string;
  type?: string | null;
  brand?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  categorySlug?: string | null;
  categoryTitle?: string | null;
  isSellable: boolean;
  variants: CatalogVariant[];
  placements: PlacementOption[];
};

export type QuoteBreakdown = {
  id: string | null;
  currency: string;
  productCostCents: number;
  shippingEstimateCents: number;
  taxEstimateCents: number;
  aiDesignFeeCents: number;
  paymentFeeCents: number;
  targetMarginCents: number;
  totalCents: number;
  expiresAt: string;
  items: Array<{
    productId: string;
    variantId: string;
    printfulVariantId?: number | null;
    title: string;
    variantName: string;
    quantity: number;
    placementCodes: string[];
    unitCostCents: number;
    unitRetailCents: number;
  }>;
};

export type DesignDraft = {
  id: string | null;
  provider: 'mock' | 'openai-ready';
  prompt: string;
  imageUrl: string;
  readiness: {
    status: 'pass' | 'needs_review';
    checks: Array<{ label: string; result: string }>;
  };
};
