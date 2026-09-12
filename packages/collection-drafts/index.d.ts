export type CollectionPurpose = "everyday" | "event" | "community" | "drop";
export type PrintWidth = {
  itemId: string;
  placementCode: string;
  widthInches: number;
};
export type CollectionReview = {
  collectionId: string;
  draftRevision: number;
  digest: string;
  ready: boolean;
  issues: string[];
  products: Array<{
    itemId: string;
    title: string;
    productTitle: string;
    variantName: string;
  }>;
  areas: Array<
    PrintWidth & {
      assetId: string;
      label: string;
      filename: string;
      widthPixels: number;
      heightPixels: number;
      heightInches: number;
      pixelsPerInch: number;
      warning?: string;
    }
  >;
};
export type CollectionPublicationSummary = {
  salesEnabled?: boolean;
  layoutRevision?: number;
  id: string;
  title: string;
  version: number;
  draftRevision: number;
  publishedAt: string;
  url: string;
};
export type CollectionPublicationState = {
  revision: number;
  publications: CollectionPublicationSummary[];
};
export type PublicCollection = CollectionPublicationSummary & {
  description: string;
  orderingAvailable: boolean;
  commerceMode?: "fixture" | "live" | "paused";
  products: Array<{
    id: string;
    title: string;
    productTitle: string;
    variantName: string;
    plannedPriceCents: number | null;
    artworkMode: ArtworkMode;
    artwork: Array<{
      label: string;
      previewUrl: string;
      widthInches: number;
      heightInches: number;
    }>;
  }>;
};
export type ArtworkMode = "fixed" | "upload" | "generate" | "reference";
export type ArtworkBinding = { placementCode: string; assetId: string };
export type CollectionArtwork = {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  status: "uploading" | "complete" | "deleting";
  rightsConfirmedAt: string;
  width?: number;
  height?: number;
  hasTransparency?: boolean;
  readiness?: "blocked" | "needs_review";
  readinessMessage?: string;
  removeAfter?: string;
};
export type ArtworkLibrary = {
  assets: CollectionArtwork[];
  maxBytes: number;
  available: boolean;
  storage: "fixture" | "private";
};
export type ArtworkAuthorization = {
  assetId: string;
  transport: "inline" | "signed";
  signedUrl?: string;
  maxBytes: number;
};
export type CollectionItem = {
  id: string;
  title: string;
  productId: string;
  variantId: string;
  placementCodes: string[];
  artworkMode: ArtworkMode;
  targetPriceCents: number | null;
  artwork?: ArtworkBinding[];
};
export type CollectionDraft = {
  id: string;
  title: string;
  description: string;
  purpose: CollectionPurpose;
  items: CollectionItem[];
};
export type CollectionCatalogProduct = {
  id: string;
  title: string;
  variants: Array<{ id: string; name: string }>;
  placements: Array<{ code: string; displayName: string; isDefault: boolean }>;
};
export type CollectionSnapshot = {
  collections: CollectionDraft[];
  revision: number;
  updatedAt: string | null;
  storage: "fixture" | "database";
  catalog: CollectionCatalogProduct[];
};
export const collectionPurposes: ReadonlyArray<{
  id: CollectionPurpose;
  label: string;
  hint: string;
}>;
export const artworkModes: ReadonlyArray<{
  id: ArtworkMode;
  label: string;
  hint: string;
}>;
export function validateCollections(value: unknown): CollectionDraft[];
export function collectionItemIssue(
  item: CollectionItem,
  catalog: CollectionCatalogProduct[],
): string | null;

export type CollectionSalesReadiness = {
  collectionId: string;
  version: number;
  checkedAt: string;
  orderingAvailable: boolean;
  products: Array<{
    id: string;
    title: string;
    priceCents: number | null;
    priceSpecified: boolean;
  }>;
  checks: Array<{
    id: string;
    label: string;
    status: "pass" | "action_required" | "not_available";
    message: string;
  }>;
};

export type CollectionPrintLayout = {
  itemId: string;
  placementCode: string;
  templateWidthInches: number;
  templateHeightInches: number;
  leftInches: number;
  topInches: number;
};
export type CollectionPrintLayouts = {
  version: number;
  revision: number;
  layouts: CollectionPrintLayout[];
  areas: Array<{
    itemId: string;
    placementCode: string;
    label: string;
    widthInches: number;
    heightInches: number;
    pixelsPerInch: number;
  }>;
};
