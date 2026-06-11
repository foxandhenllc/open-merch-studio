import type { CatalogProduct, CatalogVariant, DesignDraft, DesignMockup } from './types/catalog';

export type StudioCanvasScene =
  | 'start'
  | 'drafting'
  | 'artwork-ready'
  | 'mockup-loading'
  | 'mockup-ready'
  | 'mockup-failed'
  | 'print-warning'
  | 'policy-review'
  | 'checkout-ready'
  | 'checkout-gated';

export type StudioCanvasTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger';

export type StudioProgressStep = {
  label: string;
  state: 'done' | 'active' | 'todo';
};

export type StudioCanvasState = {
  scene: StudioCanvasScene;
  tone: StudioCanvasTone;
  title: string;
  detail: string;
  progressSteps: StudioProgressStep[];
};

export type VariantOption = {
  key: string;
  label: string;
  colorCode?: string | null;
  available: boolean;
  variantCount: number;
  costCents: number;
};

export type VariantOptionGroups = {
  colorOptions: VariantOption[];
  sizeOptions: VariantOption[];
  selectedColorKey: string;
  selectedSizeKey: string;
};

export const variantOptionKey = (value?: string | null) =>
  (value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'default';

const firstAvailableVariant = (product: CatalogProduct): CatalogVariant | null =>
  product.variants.find((variant) => variant.isAvailable) ?? product.variants[0] ?? null;

const variantColorLabel = (variant: CatalogVariant) => variant.color ?? null;
const variantColorKey = (variant: CatalogVariant) =>
  variantOptionKey(variantColorLabel(variant) ?? variant.colorCode ?? null);
const variantSizeLabel = (variant: CatalogVariant) => variant.size ?? null;
const variantSizeKey = (variant: CatalogVariant) => variantOptionKey(variantSizeLabel(variant));

const collectOptions = (
  variants: CatalogVariant[],
  getLabel: (variant: CatalogVariant) => string | null,
  getKey: (variant: CatalogVariant) => string,
  includeColorCode = false
): VariantOption[] => {
  const hasRealOption = variants.some((variant) => Boolean(getLabel(variant)));
  if (!hasRealOption) return [];

  const byKey = new Map<string, VariantOption>();
  variants.forEach((variant) => {
    const key = getKey(variant);
    const label = getLabel(variant) ?? variant.name;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        key,
        label,
        colorCode: includeColorCode ? variant.colorCode : undefined,
        available: variant.isAvailable,
        variantCount: 1,
        costCents: variant.costCents,
      });
      return;
    }
    current.available = current.available || variant.isAvailable;
    current.variantCount += 1;
    current.costCents = Math.min(current.costCents, variant.costCents);
    if (includeColorCode && !current.colorCode) current.colorCode = variant.colorCode;
  });

  return [...byKey.values()];
};

export function groupVariantOptions(
  product: CatalogProduct,
  selectedVariantId: string
): VariantOptionGroups {
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? firstAvailableVariant(product);

  return {
    colorOptions: collectOptions(product.variants, variantColorLabel, variantColorKey, true),
    sizeOptions: collectOptions(product.variants, variantSizeLabel, variantSizeKey),
    selectedColorKey: selectedVariant ? variantColorKey(selectedVariant) : '',
    selectedSizeKey: selectedVariant ? variantSizeKey(selectedVariant) : '',
  };
}

export function findVariantForOption(
  product: CatalogProduct,
  selectedVariantId: string,
  updates: { colorKey?: string; sizeKey?: string }
): CatalogVariant | null {
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? firstAvailableVariant(product);
  const currentColorKey = selectedVariant ? variantColorKey(selectedVariant) : '';
  const currentSizeKey = selectedVariant ? variantSizeKey(selectedVariant) : '';
  const nextColorKey = updates.colorKey ?? currentColorKey;
  const nextSizeKey = updates.sizeKey ?? currentSizeKey;
  const available = product.variants.filter((variant) => variant.isAvailable);
  const candidates = available.length ? available : product.variants;

  return (
    candidates.find(
      (variant) => variantColorKey(variant) === nextColorKey && variantSizeKey(variant) === nextSizeKey
    ) ??
    candidates.find((variant) => updates.colorKey && variantColorKey(variant) === nextColorKey) ??
    candidates.find((variant) => updates.sizeKey && variantSizeKey(variant) === nextSizeKey) ??
    selectedVariant ??
    firstAvailableVariant(product)
  );
}

const draftProgress = (busy: string | null): StudioProgressStep[] => [
  { label: 'Prompt sent to the image model', state: busy ? 'done' : 'todo' },
  { label: 'Rendering a square draft...', state: busy ? 'active' : 'todo' },
  { label: 'Checking print readiness', state: 'todo' },
];

const completeProgress: StudioProgressStep[] = [
  { label: 'Prompt sent to the image model', state: 'done' },
  { label: 'Rendering a square draft...', state: 'done' },
  { label: 'Checking print readiness', state: 'done' },
];

export function deriveStudioCanvasState({
  busy,
  design,
  mockup,
  quoteReady,
  checkoutUnavailable,
}: {
  busy: string | null;
  design: DesignDraft | null;
  mockup: DesignMockup | null;
  quoteReady: boolean;
  checkoutUnavailable: string | null;
}): StudioCanvasState {
  if (busy === 'draft' || busy === 'revision') {
    return {
      scene: 'drafting',
      tone: 'active',
      title: busy === 'revision' ? 'Reworking your artwork' : 'Drafting your artwork',
      detail: 'The studio is generating a square draft and preparing print checks.',
      progressSteps: draftProgress(busy),
    };
  }

  if (busy === 'mockup' || mockup?.status === 'queued' || mockup?.status === 'processing') {
    return {
      scene: 'mockup-loading',
      tone: 'active',
      title: 'Building your product preview',
      detail: 'Printful is placing the current artwork on the selected variant.',
      progressSteps: completeProgress,
    };
  }

  if (mockup?.status === 'failed') {
    return {
      scene: 'mockup-failed',
      tone: 'danger',
      title: 'Mockup needs another try',
      detail: mockup.errorMessage ?? 'The provider preview could not be generated.',
      progressSteps: completeProgress,
    };
  }

  if (design?.policy.status === 'blocked' || design?.policy.status === 'needs_review') {
    return {
      scene: 'policy-review',
      tone: design.policy.status === 'blocked' ? 'danger' : 'warning',
      title: design.policy.status === 'blocked' ? 'Artwork blocked for review' : 'Artwork needs policy review',
      detail: design.policy.reasons[0] ?? 'An operator should review this output before checkout.',
      progressSteps: completeProgress,
    };
  }

  if (
    design?.readiness.status === 'blocked' ||
    design?.readiness.status === 'needs_review' ||
    design?.readiness.status === 'warning'
  ) {
    const warning = design.readiness.checks.find((check) => check.severity !== 'pass');
    return {
      scene: 'print-warning',
      tone: design.readiness.status === 'blocked' ? 'danger' : 'warning',
      title: design.readiness.status === 'blocked' ? 'Print readiness blocked' : 'Check print readiness',
      detail: warning ? `${warning.label}: ${warning.result}` : 'This artwork should be reviewed before checkout.',
      progressSteps: completeProgress,
    };
  }

  if (quoteReady && checkoutUnavailable) {
    return {
      scene: 'checkout-gated',
      tone: 'warning',
      title: 'Quote ready, checkout gated',
      detail: checkoutUnavailable,
      progressSteps: completeProgress,
    };
  }

  if (quoteReady) {
    return {
      scene: 'checkout-ready',
      tone: 'success',
      title: 'Ready for checkout',
      detail: 'The quote is built from the selected product, variant, placement, and artwork.',
      progressSteps: completeProgress,
    };
  }

  if (mockup?.status === 'complete') {
    return {
      scene: 'mockup-ready',
      tone: 'success',
      title: 'Product preview ready',
      detail: 'Review placement, color, and scale before pricing the order.',
      progressSteps: completeProgress,
    };
  }

  if (design) {
    return {
      scene: 'artwork-ready',
      tone: 'success',
      title: 'Artwork draft ready',
      detail: 'Open it full size, revise it, or place it on the selected product.',
      progressSteps: completeProgress,
    };
  }

  return {
    scene: 'start',
    tone: 'neutral',
    title: 'Your canvas is ready',
    detail: 'Describe the design you want and generate a first draft.',
    progressSteps: draftProgress(null),
  };
}
