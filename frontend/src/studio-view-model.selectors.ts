import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  PlacementLayout,
  PlacementOption,
  PlacementSelection,
  QuoteBreakdown,
} from './types/catalog';
import type { StepState, StudioStep } from './components/StepRail.types';
import { customerPrintReadiness } from './utils/print-readiness';
import { ApiError } from './services/api-error';
import type {
  ActionKey,
  PreviewOrientation,
  Surface,
  SurfaceError,
  WorkbenchMode,
} from './studio-view-model.types';

export const emptyBusy: Record<ActionKey, boolean> = {
  catalog: false,
  refining: false,
  generating: false,
  revising: false,
  mockup: false,
  quoting: false,
  pass: false,
  checkout: false,
  reorder: false,
};

export function mapStudioError(error: unknown, surface: Surface): SurfaceError {
  const message = error instanceof Error ? error.message : 'The request could not be completed.';
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  const normalized = `${code || ''} ${message}`.toLowerCase();
  if (code === 'reorder_unavailable')
    return {
      cause: 'reorder_unavailable',
      title: 'This order cannot be repeated as-is',
      message,
      recovery: 'Choose a current product in the studio or contact support about the original.',
      retryable: false,
    };
  if (code === 'revision_allowance_required')
    return {
      cause: 'revision_allowance_required',
      title: 'No more variations are available in this studio session',
      message,
      recovery: 'Your current artwork, mockup, and price are unchanged.',
      retryable: false,
    };
  if (status === 429 || normalized.includes('rate') || normalized.includes('budget'))
    return {
      cause: 'rate_limited',
      title: 'Generation is temporarily at capacity',
      message: 'Your place and prompt are saved.',
      recovery: 'Wait a moment, then retry this same request.',
      retryable: true,
    };
  if (normalized.includes('policy') || normalized.includes('blocked'))
    return {
      cause: 'policy_blocked',
      title: 'This prompt needs a change',
      message,
      recovery: 'Edit the flagged wording and review the content policy before retrying.',
      retryable: false,
    };
  if (normalized.includes('payment') || normalized.includes('stripe'))
    return {
      cause: 'payment_failed',
      title: 'Checkout did not complete',
      message,
      recovery:
        'Retry with the same quote. Checkout creation is idempotent, so you cannot be double-charged.',
      retryable: true,
    };
  if (surface === 'mockup')
    return {
      cause: 'mockup_failed',
      title: 'The product preview failed',
      message,
      recovery: 'Retry the preview or continue to price without it. Your artwork is unchanged.',
      retryable: true,
    };
  if (surface === 'quote')
    return {
      cause: 'quote_failed',
      title: 'The price could not be calculated',
      message,
      recovery: 'Retry with the current product selection.',
      retryable: true,
    };
  if (surface === 'generation')
    return {
      cause: 'provider_failed',
      title: 'The draft was not generated',
      message,
      recovery:
        'Retry with the same prompt. Failed provider requests are reconciled automatically.',
      retryable: true,
    };
  return {
    cause: 'network',
    title: 'The studio server is unreachable',
    message,
    recovery: 'Check your connection. Self-hosters should also check the backend and VITE_API_URL.',
    retryable: true,
  };
}

export const firstVariant = (product: CatalogProduct): CatalogVariant | null =>
  product.variants.find((variant) => variant.isAvailable) ?? product.variants[0] ?? null;

export const firstPlacement = (product: CatalogProduct): PlacementOption | null =>
  product.placements.find((placement) => placement.isDefault) ?? product.placements[0] ?? null;

export function previewOrientation(
  product: CatalogProduct,
  variant: CatalogVariant | null
): PreviewOrientation | undefined {
  if (product.categorySlug !== 'wall-art') return undefined;
  const dimensions = variant?.size?.match(/([\d.]+)\s*[x×]\s*([\d.]+)/i);
  return dimensions && dimensions[1] === dimensions[2] ? 'square' : 'landscape';
}

export function mockupKey(params: {
  productId: string;
  variantId: string;
  placements: string[];
  draftId: string;
  placementDesigns?: Record<string, string>;
  mugLayout?: PlacementLayout;
  orientation?: PreviewOrientation;
}): string {
  return [
    params.draftId,
    params.productId,
    params.variantId,
    [...params.placements].sort().join(','),
    Object.entries(params.placementDesigns ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, assetId]) => `${code}:${assetId}`)
      .join(','),
    params.mugLayout ?? 'center',
    params.orientation ?? 'default',
  ].join('|');
}

export function deriveArtworkState(params: {
  selectedPlacements: string[];
  placementArtwork: Record<string, DesignDraft>;
  design: DesignDraft | null;
}): { artworkReady: boolean; artworkQuoteEligible: boolean } {
  const selectedArtwork = params.selectedPlacements.map(
    (code) => params.placementArtwork[code] ?? params.design
  );
  const uniqueSelectedArtwork = Array.from(
    new Map(
      selectedArtwork
        .filter((draft): draft is DesignDraft => Boolean(draft?.id))
        .map((draft) => [draft.id!, draft])
    ).values()
  );
  const allPlacementsAssigned =
    params.selectedPlacements.length > 0 &&
    selectedArtwork.every((draft) => Boolean(draft?.id));
  const artworkReady = Boolean(
    allPlacementsAssigned &&
      uniqueSelectedArtwork.every(
        (draft) =>
          draft.generationStatus === 'complete' &&
          draft.policy.status === 'pass' &&
          customerPrintReadiness(draft.readiness).status === 'pass'
      )
  );
  const artworkQuoteEligible = Boolean(
    allPlacementsAssigned &&
      uniqueSelectedArtwork.every((draft) => {
        const readiness = customerPrintReadiness(draft.readiness);
        return (
          draft.generationStatus === 'complete' &&
          draft.policy.status === 'pass' &&
          (readiness.status === 'pass' || readiness.status === 'warning')
        );
      })
  );
  return { artworkReady, artworkQuoteEligible };
}

export function deriveCheckoutReadiness(params: {
  artworkReady: boolean;
  quote: QuoteBreakdown | null;
  quoteStale: boolean;
  quoteExpired: boolean;
  email: string;
  paymentAvailable: boolean;
}) {
  const emailValid = /^\S+@\S+\.\S+$/.test(params.email.trim());
  const quoteReady = Boolean(params.quote && !params.quoteStale && !params.quoteExpired);
  const canOpen = params.artworkReady && quoteReady && params.paymentAvailable;
  const blocker = !params.artworkReady
    ? 'Finish artwork checks before checkout.'
    : !params.quote
      ? 'Preparing your price estimate.'
      : params.quoteExpired
        ? 'Refresh the expired estimate before checkout.'
        : params.quoteStale
          ? 'Updating the estimate for your current selection.'
          : !params.paymentAvailable
            ? 'Secure checkout is temporarily unavailable.'
            : !emailValid
              ? 'Enter a valid email for your receipt.'
              : '';
  return {
    artworkReady: params.artworkReady,
    quoteReady,
    emailValid,
    paymentAvailable: params.paymentAvailable,
    fulfillmentReview: 'Your order is reviewed for print quality before production.',
    canOpen,
    ready: canOpen && emailValid,
    blocker,
  };
}

export function deriveDesignAllowance(design: DesignDraft | null): {
  canGenerateAnother: boolean;
  canRevise: boolean;
} {
  return {
    canGenerateAnother: Boolean(
      !design || design.allowance.freeDraftsRemaining + design.allowance.roughDraftsRemaining > 0
    ),
    canRevise: Boolean(
      design?.id &&
        design.allowance.editsRemaining +
          design.allowance.freeDraftsRemaining +
          design.allowance.roughDraftsRemaining >
          0
    ),
  };
}

export function buildPlacementSelections(
  codes: string[],
  fallbackDraft: DesignDraft,
  artworkByCode: Record<string, DesignDraft>,
  layout: PlacementLayout
): PlacementSelection[] {
  return codes.map((code) => ({
    code,
    designAssetId: artworkByCode[code]?.id ?? fallbackDraft.id ?? undefined,
    layout: code === 'default' ? layout : undefined,
  }));
}

export function placementArtworkKey(
  selectedPlacements: string[],
  placementArtwork: Record<string, DesignDraft>,
  design: DesignDraft | null
): string {
  return selectedPlacements
    .map((code) => `${code}:${placementArtwork[code]?.id ?? design?.id ?? ''}`)
    .join('|');
}

export function artworkAssignmentsForDraft(params: {
  draft: DesignDraft;
  activePlacementCode: string;
  selectedPlacements: string[];
  placementArtwork: Record<string, DesignDraft>;
}): Record<string, DesignDraft> {
  if (
    params.activePlacementCode &&
    params.selectedPlacements.includes(params.activePlacementCode)
  ) {
    return { ...params.placementArtwork, [params.activePlacementCode]: params.draft };
  }
  return Object.fromEntries(params.selectedPlacements.map((code) => [code, params.draft]));
}

export function deriveStepStates(params: {
  workbenchMode: WorkbenchMode;
  selectedProduct: CatalogProduct | null;
  design: DesignDraft | null;
}): Record<StudioStep, StepState> {
  return {
    product: params.workbenchMode === 'product' ? 'active' : params.selectedProduct ? 'done' : 'todo',
    make: ['configure', 'describe', 'generating', 'review'].includes(params.workbenchMode)
      ? 'active'
      : params.design
        ? 'done'
        : 'todo',
    order: ['cart', 'checkout', 'order'].includes(params.workbenchMode) ? 'active' : 'todo',
  };
}
