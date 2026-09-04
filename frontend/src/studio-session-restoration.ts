import { api, type Sourced } from '@services/api';
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  DesignMockup,
  PlacementLayout,
  QuoteBreakdown,
  StudioCapabilities,
  StudioSession,
} from '@app-types/catalog';
import { readStudioResumeState } from './studio-persistence';
import { mockupKey, previewOrientation } from './studio-view-model.selectors';
import type {
  CreationPath,
  FlowState,
  PreviewOrientation,
  WorkbenchMode,
} from './studio-view-model.types';

type RestoredSelection = {
  category: string;
  product: CatalogProduct;
  variant: CatalogVariant;
  quantity: number;
  placements: string[];
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
  prompt: string;
};

export type RestoredStudioSession = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  session: StudioSession;
  capabilities: StudioCapabilities;
  selectedCategory: string;
  prompt: string;
  references: DesignDraft[];
  creationPath: CreationPath;
  selection?: RestoredSelection;
  design: DesignDraft | null;
  placementArtwork: Record<string, DesignDraft>;
  quote: QuoteBreakdown | null;
  mockup: DesignMockup | null;
  mockupCacheKey?: string;
  mockupViewIndex: number;
  flow: FlowState;
  mode: WorkbenchMode;
  announcement: string;
  recoveryMessage: string;
};

type RestorationOptions = {
  onSource: <T>(result: Sourced<T>) => T;
};

const loadDraft = async (
  assetId: string,
  sessionId: string,
  onSource: RestorationOptions['onSource']
): Promise<DesignDraft | null> => {
  try {
    const draft = onSource(await api.designDraftById(assetId, sessionId));
    return draft.id ? draft : null;
  } catch {
    return null;
  }
};

/**
 * Reconstructs a guest workbench as one validated snapshot. No React setters
 * are accepted here: restoration either returns a coherent state graph or a
 * safe partial recovery that asks the customer to choose a product again.
 */
export async function restoreStudioSession({
  onSource,
}: RestorationOptions): Promise<RestoredStudioSession> {
  const saved = readStudioResumeState();
  const [categoryResult, productResult, sessionResult, capabilityResult] = await Promise.all([
    api.categories(),
    api.products(saved?.selectedCategory || undefined),
    api.session(saved?.sessionId),
    api.capabilities(),
  ]);
  const products = onSource(productResult);
  const categories = onSource(categoryResult);
  const session = onSource(sessionResult);
  const capabilities = onSource(capabilityResult);
  const references = saved?.referenceAssetIds.length
    ? (
        await Promise.all(
          saved.referenceAssetIds.map((assetId) => loadDraft(assetId, session.id, onSource))
        )
      ).filter((asset): asset is DesignDraft => Boolean(asset?.id))
    : [];

  const base = {
    categories,
    products,
    session,
    capabilities,
    selectedCategory: saved?.selectedCategory ?? '',
    prompt: saved?.prompt ?? '',
    references,
    creationPath: references.length ? ('reference' as const) : ('generate' as const),
    design: null,
    placementArtwork: {},
    quote: null,
    mockup: null,
    mockupViewIndex: saved?.mockupViewIndex ?? 0,
    announcement: saved ? 'Your previous guest session was restored.' : '',
    recoveryMessage: '',
  };
  if (!saved) {
    return { ...base, flow: 'configuring', mode: 'product' };
  }

  const product = products.find((candidate) => candidate.id === saved.productId);
  const variant = product?.variants.find(
    (candidate) => candidate.id === saved.variantId && candidate.isAvailable
  );
  if (!product || !variant) {
    return {
      ...base,
      flow: 'configuring',
      mode: 'product',
      recoveryMessage:
        'Your previous product selection is no longer available. Your guest session was restored so you can choose another product.',
    };
  }

  const validPlacements = saved.placementCodes.filter((code) =>
    product.placements.some((placement) => placement.code === code)
  );
  const placements = validPlacements.length
    ? validPlacements
    : product.placements.filter((placement) => placement.isDefault).map((item) => item.code);
  const orientation = saved.orientation ?? previewOrientation(product, variant);
  const selection: RestoredSelection = {
    category: saved.selectedCategory,
    product,
    variant,
    quantity: saved.quantity,
    placements,
    mugLayout: saved.mugLayout ?? 'center',
    orientation,
    prompt: saved.prompt,
  };

  let recoveryMessage = '';
  const design = saved.designId ? await loadDraft(saved.designId, session.id, onSource) : null;
  if (saved.designId && !design) {
    recoveryMessage =
      'Your saved artwork is no longer available. The product and prompt were restored so you can generate a new draft.';
  }
  const placementEntries = await Promise.all(
    placements.map(async (code) => {
      const assetId = saved.placementDesignAssetIds[code];
      if (!assetId) return design ? ([code, design] as const) : null;
      if (design?.id === assetId) return [code, design] as const;
      return [code, (await loadDraft(assetId, session.id, onSource)) ?? design] as const;
    })
  );
  const placementArtwork = Object.fromEntries(
    placementEntries.filter((entry): entry is readonly [string, DesignDraft] =>
      Boolean(entry?.[1]?.id)
    )
  );

  let quote: QuoteBreakdown | null = null;
  if (saved.quoteId && design?.id) {
    try {
      const candidate = onSource(await api.quoteById(saved.quoteId));
      const item = candidate.items[0];
      // A quote is reusable only for the exact product configuration it priced.
      // Provider totals must never survive a product, variant, artwork, or quantity change.
      if (
        item?.productId === product.id &&
        item.variantId === variant.id &&
        item.designAssetId === design.id &&
        item.quantity === saved.quantity
      ) {
        quote = candidate;
      }
    } catch {
      recoveryMessage =
        'Your saved price estimate expired or is unavailable. A fresh estimate will be prepared automatically.';
    }
  }

  let mockup: DesignMockup | null = null;
  let mockupCacheKey: string | undefined;
  if (design?.id && design.readiness.status !== 'blocked') {
    const savedMockupMatches = Boolean(
      saved.mockup &&
      saved.mockup.productId === product.id &&
      saved.mockup.variantId === variant.id &&
      saved.mockup.designAssetId === design.id &&
      saved.mockup.placementCodes.join('|') === placements.join('|') &&
      saved.mockup.orientation === orientation
    );
    if (saved.mockup && savedMockupMatches) {
      mockup = saved.mockup;
    } else {
      try {
        mockup = onSource(
          await api.mockup({
            sessionId: session.id,
            productId: product.id,
            variantId: variant.id,
            placementCodes: placements,
            placements: placements.map((code) => ({
              code,
              designAssetId: placementArtwork[code]?.id ?? design.id ?? undefined,
              layout: code === 'default' ? saved.mugLayout : undefined,
            })),
            designAssetId: design.id,
            imageUrl: design.imageUrl,
            orientation,
          })
        );
      } catch {
        recoveryMessage =
          'Your artwork was restored, but its saved product preview needs to be rebuilt.';
      }
    }
    if (mockup?.status === 'complete') {
      mockupCacheKey = mockupKey({
        productId: product.id,
        variantId: variant.id,
        placements,
        draftId: design.id,
        placementDesigns: saved.placementDesignAssetIds,
        mugLayout: saved.mugLayout,
        orientation,
      });
    }
  }

  return {
    ...base,
    selection,
    design,
    placementArtwork,
    quote,
    mockup,
    mockupCacheKey,
    flow: quote ? 'quoted' : design ? 'drafted' : 'configuring',
    mode: design ? 'review' : saved.prompt.trim() ? 'describe' : 'configure',
    recoveryMessage,
  };
}
