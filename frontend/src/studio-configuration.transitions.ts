import type { CatalogProduct, CatalogVariant, DesignDraft } from './types/catalog';
import type { PreviewOrientation } from './studio-view-model.types';
import { firstPlacement, firstVariant, previewOrientation } from './studio-view-model.selectors';

export type RememberedProductSelection = {
  variantId: string;
  placements: string[];
  orientation?: PreviewOrientation;
};

export function selectProductConfiguration(params: {
  product: CatalogProduct;
  remembered?: RememberedProductSelection;
  design: DesignDraft | null;
}): {
  variant: CatalogVariant | null;
  placements: string[];
  orientation?: PreviewOrientation;
  placementArtwork: Record<string, DesignDraft>;
} {
  const variant =
    params.product.variants.find(
      (candidate) =>
        candidate.id === params.remembered?.variantId && candidate.isAvailable
    ) ?? firstVariant(params.product);
  const placement = firstPlacement(params.product);
  const placements = params.remembered?.placements.length
    ? params.remembered.placements.filter((code) =>
        params.product.placements.some((candidate) => candidate.code === code)
      )
    : placement
      ? [placement.code]
      : [];
  const orientation =
    params.remembered?.orientation ?? previewOrientation(params.product, variant);
  const placementArtwork = params.design
    ? Object.fromEntries(placements.map((code) => [code, params.design!]))
    : {};

  return { variant, placements, orientation, placementArtwork };
}

export function selectVariantConfiguration(params: {
  product: CatalogProduct;
  variantId: string;
  selectedOrientation?: PreviewOrientation;
}): { variant: CatalogVariant | undefined; orientation?: PreviewOrientation } {
  const variant = params.product.variants.find(
    (candidate) => candidate.id === params.variantId
  );
  const derivedOrientation = previewOrientation(params.product, variant ?? null);
  const orientation =
    derivedOrientation === 'square'
      ? 'square'
      : derivedOrientation
        ? params.selectedOrientation === 'portrait'
          ? 'portrait'
          : 'landscape'
        : undefined;

  return { variant, orientation };
}

export function togglePlacementConfiguration(params: {
  code: string;
  selectedPlacements: string[];
  placementArtwork: Record<string, DesignDraft>;
  design: DesignDraft | null;
}): {
  changed: boolean;
  placements: string[];
  placementArtwork: Record<string, DesignDraft>;
} {
  if (
    params.selectedPlacements.includes(params.code) &&
    params.selectedPlacements.length === 1
  ) {
    return {
      changed: false,
      placements: params.selectedPlacements,
      placementArtwork: params.placementArtwork,
    };
  }

  const placements = params.selectedPlacements.includes(params.code)
    ? params.selectedPlacements.filter((item) => item !== params.code)
    : [...params.selectedPlacements, params.code];
  const placementArtwork = placements.includes(params.code)
    ? params.design
      ? {
          ...params.placementArtwork,
          [params.code]: params.placementArtwork[params.code] ?? params.design,
        }
      : params.placementArtwork
    : Object.fromEntries(
        Object.entries(params.placementArtwork).filter(
          ([placementCode]) => placementCode !== params.code
        )
      );

  return { changed: true, placements, placementArtwork };
}

export function reusePlacementAssignment(params: {
  sourceCode: string;
  targetCode: string;
  placementArtwork: Record<string, DesignDraft>;
  design: DesignDraft | null;
}): Record<string, DesignDraft> | null {
  const source = params.placementArtwork[params.sourceCode] ?? params.design;
  return source ? { ...params.placementArtwork, [params.targetCode]: source } : null;
}
