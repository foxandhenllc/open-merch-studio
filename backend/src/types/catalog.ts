export type PlacementOption = {
  code: string;
  displayName: string;
  technique: string;
  isDefault: boolean;
  width?: number;
  height?: number;
};

export type CatalogVariantDto = {
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

export type CatalogProductDto = {
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
  variants: CatalogVariantDto[];
  placements: PlacementOption[];
};

export type CatalogCategoryDto = {
  id: string;
  printfulId?: number | null;
  title: string;
  slug: string;
  imageUrl?: string | null;
  isLaunchCategory: boolean;
};

export type QuoteLineInput = {
  productId: string;
  variantId: string;
  quantity: number;
  placementCodes: string[];
  designAssetId?: string;
};

export type QuoteBreakdown = {
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
