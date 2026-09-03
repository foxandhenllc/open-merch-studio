import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type DataSource, type Sourced } from '@services/api';
import { canUseCustomerCheckout } from './config';
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  CheckoutSession,
  CustomerOrderConfirmation,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  PlacementLayout,
  QuoteBreakdown,
  StudioCapabilities,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';
import type { StudioStep } from '@components/StepRail.types';
import {
  clearStudioResumeState,
  readStudioResumeState,
  writeStudioResumeState,
} from './studio-persistence';
import { productType, revisionBand, totalBand, trackEvent } from './utils/analytics';
import type {
  ActionKey,
  CreationPath,
  FlowState,
  PreviewOrientation,
  Surface,
  SurfaceError,
  WorkbenchMode,
} from './studio-view-model.types';
import {
  artworkAssignmentsForDraft,
  buildPlacementSelections,
  deriveArtworkState,
  deriveCheckoutReadiness,
  deriveDesignAllowance,
  deriveStepStates,
  emptyBusy,
  firstPlacement,
  firstVariant,
  mapStudioError,
  mockupKey,
  placementArtworkKey,
  previewOrientation,
} from './studio-view-model.selectors';

export type {
  ActionKey,
  CreationPath,
  FlowState,
  PreviewOrientation,
  Surface,
  SurfaceError,
  WorkbenchMode,
} from './studio-view-model.types';

const delay = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Cancelled', 'AbortError'));
      },
      { once: true }
    );
  });

export function useStudioViewModel() {
  const [flow, setFlow] = useState<FlowState>('booting');
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('product');
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [session, setSession] = useState<StudioSession | null>(null);
  const [studioPass, setStudioPass] = useState<StudioPass | null>(null);
  const [capabilities, setCapabilities] = useState<StudioCapabilities>({
    ai: 'demo',
    checkout: 'demo',
    fulfillment: 'demo',
  });
  const [selectedCategory, setSelectedCategoryState] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantIdState] = useState('');
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [placementArtwork, setPlacementArtwork] = useState<Record<string, DesignDraft>>({});
  const [activePlacementCode, setActivePlacementCode] = useState('');
  const [mugLayout, setMugLayoutState] = useState<PlacementLayout>('center');
  const [selectedOrientation, setSelectedOrientationState] = useState<
    PreviewOrientation | undefined
  >();
  const [prompt, setPrompt] = useState('');
  const [creationPath, setCreationPath] = useState<CreationPath>('generate');
  const [referenceAssets, setReferenceAssets] = useState<DesignDraft[]>([]);
  const [revision, setRevision] = useState('');
  const [email, setEmail] = useState('');
  const [idea, setIdea] = useState<DesignIdea | null>(null);
  const [design, setDesign] = useState<DesignDraft | null>(null);
  const [mockup, setMockup] = useState<DesignMockup | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [order, setOrder] = useState<CustomerOrderConfirmation | null>(null);
  const [busy, setBusy] = useState(emptyBusy);
  const [errors, setErrors] = useState<Partial<Record<Surface, SurfaceError>>>({});
  const [fallback, setFallback] = useState<{ visible: boolean; reason: string } | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('live');
  const [mockupStale, setMockupStale] = useState(false);
  const [quoteStale, setQuoteStale] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('Queued');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [activeMockupViewIndex, setActiveMockupViewIndex] = useState(0);
  const [designHistory, setDesignHistory] = useState<DesignDraft[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const generationController = useRef<AbortController | null>(null);
  const quoteController = useRef<AbortController | null>(null);
  const quoteRequestId = useRef(0);
  const mockupRequestId = useRef(0);
  const startingFresh = useRef(false);
  const mockupCache = useRef(new Map<string, DesignMockup>());
  const productSelections = useRef(
    new Map<string, { variantId: string; placements: string[]; orientation?: PreviewOrientation }>()
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );
  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedProduct, selectedVariantId]
  );
  const quoteExpired = Boolean(quote && new Date(quote.expiresAt).getTime() <= Date.now());
  const { artworkReady, artworkQuoteEligible } = deriveArtworkState({
    selectedPlacements,
    placementArtwork,
    design,
  });
  const checkoutReadiness = useMemo(
    () =>
      deriveCheckoutReadiness({
        artworkReady,
        quote,
        quoteStale,
        quoteExpired,
        email,
        paymentAvailable: canUseCustomerCheckout,
      }),
    [artworkReady, email, quote, quoteExpired, quoteStale]
  );
  const { canGenerateAnother, canRevise } = deriveDesignAllowance(design);

  const consumeSource = useCallback(<T>(result: Sourced<T>): T => {
    setDataSource(result.source);
    if (result.fallbackReason) setFallback({ visible: true, reason: result.fallbackReason });
    return result.data;
  }, []);
  const setAction = (key: ActionKey, value: boolean) =>
    setBusy((current) => ({ ...current, [key]: value }));
  const clearError = (surface: Surface) =>
    setErrors((current) => ({ ...current, [surface]: undefined }));
  const fail = (surface: Surface, error: unknown) =>
    setErrors((current) => ({ ...current, [surface]: mapStudioError(error, surface) }));

  const boot = useCallback(async () => {
    setFlow('booting');
    clearError('boot');
    setRecoveryMessage('');
    try {
      const saved = readStudioResumeState();
      const [categoryResult, productResult, sessionResult, capabilityResult] = await Promise.all([
        api.categories(),
        api.products(saved?.selectedCategory || undefined),
        api.session(saved?.sessionId),
        api.capabilities(),
      ]);
      const nextProducts = consumeSource(productResult);
      setCategories(consumeSource(categoryResult));
      setProducts(nextProducts);
      const nextSession = consumeSource(sessionResult);
      setCapabilities(consumeSource(capabilityResult));
      setSession(nextSession);
      setStudioPass(nextSession.studioPass ?? null);

      if (saved?.referenceAssetIds.length) {
        const restoredReferences = await Promise.all(
          saved.referenceAssetIds.map(async (assetId) => {
            try {
              return consumeSource(await api.designDraftById(assetId, nextSession.id));
            } catch {
              return null;
            }
          })
        );
        const availableReferences = restoredReferences.filter(
          (asset): asset is DesignDraft => Boolean(asset?.id)
        );
        setReferenceAssets(availableReferences);
        if (availableReferences.length) setCreationPath('reference');
      }

      if (!saved) {
        setFlow('configuring');
        setWorkbenchMode('product');
        return;
      }

      setSelectedCategoryState(saved.selectedCategory);
      setPrompt(saved.prompt);
      const product = nextProducts.find((candidate) => candidate.id === saved.productId);
      const variant = product?.variants.find(
        (candidate) => candidate.id === saved.variantId && candidate.isAvailable
      );
      if (!product || !variant) {
        setRecoveryMessage(
          'Your previous product selection is no longer available. Your guest session was restored so you can choose another product.'
        );
        setFlow('configuring');
        setWorkbenchMode('product');
        return;
      }

      const placementCodes = saved.placementCodes.filter((code) =>
        product.placements.some((placement) => placement.code === code)
      );
      const placements = placementCodes.length
        ? placementCodes
        : product.placements.filter((placement) => placement.isDefault).map((item) => item.code);
      const orientation = saved.orientation ?? previewOrientation(product, variant);
      setSelectedProductId(product.id);
      setSelectedVariantIdState(variant.id);
      setSelectedPlacements(placements);
      setMugLayoutState(saved.mugLayout ?? 'center');
      setSelectedOrientationState(orientation);
      productSelections.current.set(product.id, {
        variantId: variant.id,
        placements,
        orientation,
      });

      let restoredDraft: DesignDraft | null = null;
      if (saved.designId) {
        try {
          restoredDraft = consumeSource(await api.designDraftById(saved.designId, nextSession.id));
          if (!restoredDraft.id) restoredDraft = null;
        } catch {
          setRecoveryMessage(
            'Your saved artwork is no longer available. The product and prompt were restored so you can generate a new draft.'
          );
        }
      }
      setDesign(restoredDraft);
      const restoredPlacementArtworkEntries = await Promise.all(
        placements.map(async (code) => {
          const assetId = saved.placementDesignAssetIds[code];
          if (!assetId) return restoredDraft ? ([code, restoredDraft] as const) : null;
          if (restoredDraft?.id === assetId) return [code, restoredDraft] as const;
          try {
            const asset = consumeSource(await api.designDraftById(assetId, nextSession.id));
            return asset.id ? ([code, asset] as const) : null;
          } catch {
            return restoredDraft ? ([code, restoredDraft] as const) : null;
          }
        })
      );
      const restoredPlacementArtwork = Object.fromEntries(
        restoredPlacementArtworkEntries.filter(
          (entry): entry is readonly [string, DesignDraft] => Boolean(entry)
        )
      );
      setPlacementArtwork(restoredPlacementArtwork);
      setDesignHistory([]);
      setActiveMockupViewIndex(saved.mockupViewIndex);

      let restoredQuote: QuoteBreakdown | null = null;
      if (saved.quoteId && restoredDraft?.id) {
        try {
          const candidate = consumeSource(await api.quoteById(saved.quoteId));
          const item = candidate.items[0];
          if (
            item?.productId === product.id &&
            item.variantId === variant.id &&
            item.designAssetId === restoredDraft.id
          ) {
            restoredQuote = candidate;
          }
        } catch {
          setRecoveryMessage(
            'Your saved price estimate expired or is unavailable. A fresh estimate will be prepared automatically.'
          );
        }
      }
      setQuote(restoredQuote);
      setQuoteStale(false);

      if (restoredDraft?.id && restoredDraft.readiness.status !== 'blocked') {
        const savedMockup = saved.mockup;
        const savedMockupMatches = Boolean(
          savedMockup &&
          savedMockup.productId === product.id &&
          savedMockup.variantId === variant.id &&
          savedMockup.designAssetId === restoredDraft.id &&
          savedMockup.placementCodes.join('|') === placements.join('|') &&
          savedMockup.orientation === orientation
        );
        if (savedMockup && savedMockupMatches) {
          setMockup(savedMockup);
          mockupCache.current.set(
            mockupKey({
              productId: product.id,
              variantId: variant.id,
              placements,
              draftId: restoredDraft.id,
              placementDesigns: saved.placementDesignAssetIds,
              mugLayout: saved.mugLayout,
              orientation,
            }),
            savedMockup
          );
        } else
          try {
            const restoredMockup = consumeSource(
              await api.mockup({
                sessionId: nextSession.id,
                productId: product.id,
                variantId: variant.id,
                placementCodes: placements,
                placements: placements.map((code) => ({
                  code,
                  designAssetId: restoredPlacementArtwork[code]?.id ?? restoredDraft.id ?? undefined,
                  layout: code === 'default' ? saved.mugLayout : undefined,
                })),
                designAssetId: restoredDraft.id,
                imageUrl: restoredDraft.imageUrl,
                orientation,
              })
            );
            setMockup(restoredMockup);
            if (restoredMockup.status === 'complete') {
              mockupCache.current.set(
                mockupKey({
                  productId: product.id,
                  variantId: variant.id,
                  placements,
                  draftId: restoredDraft.id,
                  placementDesigns: saved.placementDesignAssetIds,
                  mugLayout: saved.mugLayout,
                  orientation,
                }),
                restoredMockup
              );
            }
          } catch {
            setRecoveryMessage(
              'Your artwork was restored, but its saved product preview needs to be rebuilt.'
            );
          }
      }

      setFlow(restoredQuote ? 'quoted' : restoredDraft ? 'drafted' : 'configuring');
      setWorkbenchMode(restoredDraft ? 'review' : saved.prompt.trim() ? 'describe' : 'configure');
      setAnnouncement('Your previous guest session was restored.');
    } catch (error) {
      fail('boot', error);
      setFlow('boot_failed');
    }
  }, [consumeSource]);

  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    if (startingFresh.current || !session || flow === 'booting' || flow === 'boot_failed') return;
    writeStudioResumeState({
      version: 4,
      sessionId: session.id,
      selectedCategory,
      productId: selectedProductId,
      variantId: selectedVariantId,
      placementCodes: selectedPlacements,
      placementDesignAssetIds: Object.fromEntries(
        Object.entries(placementArtwork).flatMap(([code, draft]) =>
          draft.id ? [[code, draft.id]] : []
        )
      ),
      mugLayout,
      orientation: selectedOrientation,
      prompt,
      designId: design?.id ?? undefined,
      referenceAssetIds: referenceAssets
        .map((asset) => asset.id)
        .filter((id): id is string => Boolean(id)),
      mockup: mockup?.status === 'complete' ? mockup : undefined,
      mockupViewIndex: activeMockupViewIndex,
      quoteId: quote?.id ?? undefined,
    });
  }, [
    activeMockupViewIndex,
    design?.id,
    flow,
    prompt,
    mockup,
    mugLayout,
    placementArtwork,
    quote?.id,
    referenceAssets,
    selectedCategory,
    selectedOrientation,
    selectedPlacements,
    selectedProductId,
    selectedVariantId,
    session,
  ]);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  useEffect(() => {
    if (!quote) return undefined;
    const timer = window.setInterval(() => {
      if (new Date(quote.expiresAt).getTime() <= Date.now()) setFlow('quote_expired');
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [quote]);

  const setSelectedCategory = async (category: string) => {
    setSelectedCategoryState(category);
    setAction('catalog', true);
    clearError('catalog');
    try {
      const result = await api.products(category || undefined);
      setProducts(consumeSource(result));
      trackEvent('catalog_opened', {
        source: 'studio',
        category: category || 'all',
      });
    } catch (error) {
      fail('catalog', error);
    } finally {
      setAction('catalog', false);
    }
  };
  const requestMockup = async (params: {
    product: CatalogProduct;
    variant: CatalogVariant;
    placements: string[];
    draft: DesignDraft;
    artworkByCode?: Record<string, DesignDraft>;
    mugLayout?: PlacementLayout;
    orientation?: PreviewOrientation;
    revealReview?: boolean;
  }) => {
    if (!params.draft.id || params.draft.readiness.status === 'blocked') return;
    const placementSelections = buildPlacementSelections(
      params.placements,
      params.draft,
      params.artworkByCode ?? placementArtwork,
      params.mugLayout ?? mugLayout
    );
    if (placementSelections.some((placement) => !placement.designAssetId)) return;
    const placementDesigns = Object.fromEntries(
      placementSelections.map((placement) => [placement.code, placement.designAssetId!])
    );
    const requestId = ++mockupRequestId.current;
    const key = mockupKey({
      productId: params.product.id,
      variantId: params.variant.id,
      placements: params.placements,
      draftId: params.draft.id,
      placementDesigns,
      mugLayout: params.mugLayout ?? mugLayout,
      orientation: params.orientation,
    });
    const cached = mockupCache.current.get(key);
    if (cached) {
      setAction('mockup', false);
      setOperationStartedAt(null);
      setMockup(cached);
      setActiveMockupViewIndex(0);
      setMockupStale(false);
      clearError('mockup');
      setFlow(quote ? 'quote_stale' : 'drafted');
      setAnnouncement('Saved product mockup restored.');
      trackEvent('mockup_completed', { result: 'success', source: 'fallback' });
      if (params.revealReview !== false) setWorkbenchMode('review');
      return;
    }
    if (mockup) setMockupStale(true);
    setAction('mockup', true);
    setFlow('previewing');
    setOperationStartedAt(Date.now());
    clearError('mockup');
    try {
      const sourced = await api.mockup({
        sessionId: session?.id,
        productId: params.product.id,
        variantId: params.variant.id,
        placementCodes: params.placements,
        placements: placementSelections,
        designAssetId: params.draft.id,
        imageUrl: params.draft.imageUrl,
        orientation: params.orientation,
      });
      const result = consumeSource(sourced);
      if (requestId !== mockupRequestId.current) return;
      setMockup(result);
      setActiveMockupViewIndex(0);
      setMockupStale(false);
      if (result.status === 'failed') {
        trackEvent('mockup_completed', {
          result: 'failed',
          source: sourced.source === 'live' ? 'printful' : 'fallback',
        });
        fail(
          'mockup',
          new Error(result.errorMessage || 'The fulfillment provider could not build this mockup.')
        );
        setFlow(quote ? 'quote_stale' : 'drafted');
        setAnnouncement(
          'The product preview failed. Your artwork is safe; retry the preview or continue without it.'
        );
        if (params.revealReview !== false) setWorkbenchMode('review');
      } else {
        trackEvent('mockup_completed', {
          result: 'success',
          source: result.provider === 'printful' ? 'printful' : 'fallback',
        });
        mockupCache.current.set(key, result);
        setFlow(quote ? 'quote_stale' : 'drafted');
        setAnnouncement('Product mockup ready. Your price estimate is updating automatically.');
        if (params.revealReview !== false) setWorkbenchMode('review');
      }
    } catch (error) {
      if (requestId !== mockupRequestId.current) return;
      trackEvent('mockup_completed', {
        result: 'failed',
        source: dataSource === 'live' ? 'printful' : 'fallback',
      });
      fail('mockup', error);
      setFlow(quote ? 'quote_stale' : 'drafted');
      setAnnouncement(
        'The product preview failed. Your artwork is safe; retry the preview or continue without it.'
      );
      if (params.revealReview !== false) setWorkbenchMode('review');
    } finally {
      if (requestId === mockupRequestId.current) {
        setAction('mockup', false);
        setOperationStartedAt(null);
      }
    }
  };
  const markStale = () => {
    quoteRequestId.current += 1;
    quoteController.current?.abort();
    quoteController.current = null;
    setAction('quoting', false);
    if (mockup) setMockupStale(true);
    if (quote) setQuoteStale(true);
    if (quote) setFlow('quote_stale');
    else setFlow(design ? 'drafted' : 'configuring');
    setCheckout(null);
    setOrder(null);
  };
  const selectProduct = (product: CatalogProduct) => {
    setRecoveryMessage('');
    if (selectedProductId && selectedVariantId) {
      productSelections.current.set(selectedProductId, {
        variantId: selectedVariantId,
        placements: selectedPlacements,
        orientation: selectedOrientation,
      });
    }
    const remembered = productSelections.current.get(product.id);
    const variant =
      product.variants.find(
        (candidate) => candidate.id === remembered?.variantId && candidate.isAvailable
      ) ?? firstVariant(product);
    const placement = firstPlacement(product);
    const placements = remembered?.placements.length
      ? remembered.placements.filter((code) =>
          product.placements.some((candidate) => candidate.code === code)
        )
      : placement
        ? [placement.code]
        : [];
    const orientation = remembered?.orientation ?? previewOrientation(product, variant);
    setSelectedProductId(product.id);
    setSelectedVariantIdState(variant?.id ?? '');
    const nextPlacementArtwork = design
      ? Object.fromEntries(placements.map((code) => [code, design]))
      : {};
    setSelectedPlacements(placements);
    if (design) {
      setPlacementArtwork(nextPlacementArtwork);
    } else {
      setPlacementArtwork({});
    }
    setActivePlacementCode('');
    setMugLayoutState('center');
    setSelectedOrientationState(orientation);
    trackEvent('product_selected', {
      category: product.categorySlug || 'other',
      product_type: productType(product.categorySlug),
    });
    if (variant) {
      productSelections.current.set(product.id, {
        variantId: variant.id,
        placements,
        orientation,
      });
    }
    markStale();
    setWorkbenchMode('configure');
    setMockup(null);
    if (design && variant && placements.length) {
      setAnnouncement(`${product.title} selected. Updating the product mockup.`);
      void requestMockup({
        product,
        variant,
        placements,
        draft: design,
        artworkByCode: nextPlacementArtwork,
        orientation,
        revealReview: false,
      });
    } else {
      setAnnouncement(`${product.title} selected. Next: describe your design.`);
    }
  };
  const setSelectedVariantId = (id: string) => {
    setSelectedVariantIdState(id);
    trackEvent('configuration_changed', { field: 'variant', value: 'selected' });
    markStale();
    const variant = selectedProduct?.variants.find((candidate) => candidate.id === id);
    const derivedOrientation = selectedProduct
      ? previewOrientation(selectedProduct, variant ?? null)
      : undefined;
    const orientation =
      derivedOrientation === 'square'
        ? 'square'
        : derivedOrientation
          ? selectedOrientation === 'portrait'
            ? 'portrait'
            : 'landscape'
          : undefined;
    setSelectedOrientationState(orientation);
    if (selectedProduct) {
      productSelections.current.set(selectedProduct.id, {
        variantId: id,
        placements: selectedPlacements,
        orientation,
      });
    }
    if (design && selectedProduct && variant) {
      setMockup(null);
      void requestMockup({
        product: selectedProduct,
        variant,
        placements: selectedPlacements,
        draft: design,
        orientation,
        revealReview: false,
      });
    }
  };
  const togglePlacement = (code: string) => {
    const next = selectedPlacements.includes(code)
      ? selectedPlacements.length === 1
        ? selectedPlacements
        : selectedPlacements.filter((item) => item !== code)
      : [...selectedPlacements, code];
    if (next === selectedPlacements) return;
    const nextPlacementArtwork = next.includes(code)
      ? design
        ? { ...placementArtwork, [code]: placementArtwork[code] ?? design }
        : placementArtwork
      : Object.fromEntries(
          Object.entries(placementArtwork).filter(([placementCode]) => placementCode !== code)
        );
    setSelectedPlacements(next);
    setPlacementArtwork(nextPlacementArtwork);
    trackEvent('configuration_changed', {
      field: 'placement',
      value: next.length > 1 ? 'multiple' : 'single',
    });
    if (selectedProduct && selectedVariant) {
      productSelections.current.set(selectedProduct.id, {
        variantId: selectedVariant.id,
        placements: next,
        orientation: selectedOrientation,
      });
    }
    markStale();
    if (design && selectedProduct && selectedVariant) {
      setMockup(null);
      void requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: next,
        draft: design,
        artworkByCode: nextPlacementArtwork,
        orientation: selectedOrientation,
        revealReview: false,
      });
    }
  };
  const setSelectedOrientation = (orientation: PreviewOrientation) => {
    if (!selectedProduct || !selectedVariant || orientation === selectedOrientation) return;
    setSelectedOrientationState(orientation);
    trackEvent('configuration_changed', { field: 'orientation', value: orientation });
    productSelections.current.set(selectedProduct.id, {
      variantId: selectedVariant.id,
      placements: selectedPlacements,
      orientation,
    });
    markStale();
    if (design) {
      setMockup(null);
      void requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft: design,
        orientation,
        revealReview: false,
      });
    }
  };
  const setMugLayout = (layout: PlacementLayout) => {
    if (!selectedProduct || !selectedVariant || layout === mugLayout) return;
    setMugLayoutState(layout);
    markStale();
    if (design) {
      setMockup(null);
      void requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft: design,
        artworkByCode: placementArtwork,
        mugLayout: layout,
        orientation: selectedOrientation,
        revealReview: false,
      });
    }
  };
  const customizePlacement = (code: string) => {
    setActivePlacementCode(code);
    setPrompt('');
    setIdea(null);
    setCreationPath('generate');
    setWorkbenchMode('describe');
    const label = selectedProduct?.placements.find((placement) => placement.code === code)?.displayName;
    setAnnouncement(`Create different artwork for ${label ?? code}.`);
  };
  const reusePlacementArtwork = (sourceCode: string, targetCode: string) => {
    const source = placementArtwork[sourceCode] ?? design;
    if (!source) return;
    const next = { ...placementArtwork, [targetCode]: source };
    setPlacementArtwork(next);
    setActivePlacementCode('');
    markStale();
    if (selectedProduct && selectedVariant && design) {
      setMockup(null);
      void requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft: design,
        artworkByCode: next,
        orientation: selectedOrientation,
        revealReview: false,
      });
    }
  };

  const updatePrompt = (value: string) => {
    setPrompt(value);
    if (idea) setIdea(null);
  };

  const uploadArtwork = async (file: File, removeBackground = false) => {
    if (!selectedProduct || !selectedVariant) return;
    setRecoveryMessage('');
    setAction('generating', true);
    setFlow('generating');
    setWorkbenchMode('generating');
    setGenerationPhase('Uploading artwork');
    setOperationStartedAt(Date.now());
    clearError('generation');
    try {
      const result = await api.uploadArtwork({
        file,
        sessionId: session?.id,
        purpose: 'print',
        rightsConfirmed: true,
        placementCodes: selectedPlacements,
        removeBackground,
      });
      const draft = consumeSource(result);
      const nextPlacementArtwork = artworkAssignmentsForDraft({
        draft,
        activePlacementCode,
        selectedPlacements,
        placementArtwork,
      });
      if (design?.id) {
        setDesignHistory((current) =>
          current.some((item) => item.id === design.id) ? current : [...current, design]
        );
      }
      setPrompt(draft.prompt);
      setDesign(draft);
      setPlacementArtwork(nextPlacementArtwork);
      setActivePlacementCode('');
      setMockup(null);
      setQuote(null);
      setMockupStale(false);
      setQuoteStale(false);
      setFlow('drafted');
      setAnnouncement('Your artwork is prepared. Building the product preview now.');
      trackEvent('design_generation_completed', {
        result: 'success',
        source: 'upload',
      });
      setAction('generating', false);
      setOperationStartedAt(null);
      await requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft,
        artworkByCode: nextPlacementArtwork,
        orientation: selectedOrientation,
      });
    } catch (error) {
      fail('generation', error);
      setFlow('configuring');
      setWorkbenchMode('describe');
    } finally {
      setAction('generating', false);
      setOperationStartedAt(null);
    }
  };

  const addReferenceImages = async (files: File[]) => {
    const remaining = Math.max(0, 5 - referenceAssets.length);
    const selectedFiles = files.slice(0, remaining);
    if (!selectedFiles.length) return;
    setAction('generating', true);
    setGenerationPhase('Uploading references');
    clearError('generation');
    try {
      const results: DesignDraft[] = [];
      for (const file of selectedFiles) {
        const result = await api.uploadArtwork({
          file,
          sessionId: session?.id,
          purpose: 'reference',
          rightsConfirmed: true,
          placementCodes: selectedPlacements,
        });
        results.push(consumeSource(result));
      }
      setReferenceAssets((current) => [...current, ...results].slice(0, 5));
      setAnnouncement(`${results.length} reference image${results.length === 1 ? '' : 's'} ready.`);
    } catch (error) {
      fail('generation', error);
    } finally {
      setAction('generating', false);
    }
  };

  const removeReferenceAsset = (assetId: string | null) => {
    setReferenceAssets((current) => current.filter((asset) => asset.id !== assetId));
    if (assetId && session?.id) void api.deleteUploadAsset(assetId, session.id);
  };

  const refineIdea = async () => {
    if (!prompt.trim()) return;
    setFlow('refining');
    setAction('refining', true);
    clearError('generation');
    try {
      const result = await api.designIdea({
        prompt,
        sessionId: session?.id,
        productId: selectedProduct?.id,
        placementCodes: selectedPlacements,
      });
      setIdea(consumeSource(result));
      trackEvent('design_idea_refined', {
        result: result.source === 'live' ? 'success' : 'fixture',
        source: result.source === 'live' ? 'api' : 'fallback',
      });
      setFlow('configuring');
      setAnnouncement('Prompt refined. Review it, then generate your draft.');
    } catch (error) {
      trackEvent('design_idea_refined', {
        result: 'failed',
        source: dataSource === 'live' ? 'api' : 'fallback',
      });
      fail('generation', error);
      setFlow('configuring');
    } finally {
      setAction('refining', false);
    }
  };
  const generate = async () => {
    if (!selectedProduct || !selectedVariant || !prompt.trim()) return;
    if (creationPath === 'reference' && !referenceAssets.some((asset) => asset.id)) return;
    setRecoveryMessage('');
    const controller = new AbortController();
    generationController.current = controller;
    setAction('generating', true);
    setFlow('generating');
    setWorkbenchMode('generating');
    setGenerationPhase('Queued');
    setOperationStartedAt(Date.now());
    clearError('generation');
    trackEvent('design_generation_started', {
      quality: 'standard',
      source: capabilities.ai === 'live' ? 'api' : 'fixture',
    });
    const phaseOne = window.setTimeout(() => setGenerationPhase('Generating artwork'), 1000);
    const phaseTwo = window.setTimeout(() => setGenerationPhase('Preparing the print file'), 10000);
    let completionSource = capabilities.ai === 'live' ? 'api' : 'fixture';
    try {
      const [result] = await Promise.all([
        creationPath === 'reference'
          ? api.designFromReferences(
              {
                prompt,
                referenceAssetIds: referenceAssets
                  .map((asset) => asset.id)
                  .filter((id): id is string => Boolean(id)),
                sessionId: session?.id,
                productId: selectedProduct.id,
                variantId: selectedVariant.id,
                placementCodes: selectedPlacements,
              },
              controller.signal
            )
          : api.designDraft(
              {
                prompt: idea?.refinedPrompt ?? prompt,
                sessionId: session?.id,
                productId: selectedProduct.id,
                variantId: selectedVariant.id,
                placementCodes: selectedPlacements,
              },
              controller.signal
            ),
        delay(1500, controller.signal),
      ]);
      completionSource = result.source === 'live' ? 'api' : 'fixture';
      const draft = consumeSource(result);
      if (draft.policy.status === 'blocked')
        throw new ApiError(
          draft.policy.reasons[0] || 'The prompt was blocked by content policy.',
          400,
          'policy_blocked'
        );
      if (draft.generationStatus === 'failed')
        throw new ApiError(
          draft.policy.reasons[0] || 'Artwork generation did not complete. Please retry.',
          503,
          'design_generation_failed'
        );
      if (design?.id) {
        setDesignHistory((current) =>
          current.some((item) => item.id === design.id) ? current : [...current, design]
        );
      }
      const nextPlacementArtwork = artworkAssignmentsForDraft({
        draft,
        activePlacementCode,
        selectedPlacements,
        placementArtwork,
      });
      setDesign(draft);
      setPlacementArtwork(nextPlacementArtwork);
      setActivePlacementCode('');
      setMockup(null);
      setQuote(null);
      setMockupStale(false);
      setQuoteStale(false);
      setFlow('drafted');
      setAnnouncement('Artwork ready. Building your product mockup now.');
      trackEvent('design_generation_completed', {
        result: 'success',
        source: result.source === 'live' ? 'api' : 'fixture',
      });
      setAction('generating', false);
      setOperationStartedAt(null);
      await requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft,
        artworkByCode: nextPlacementArtwork,
        orientation: selectedOrientation,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        trackEvent('design_generation_completed', {
          result: 'cancelled',
          source: completionSource,
        });
        setFlow('configuring');
        setWorkbenchMode('describe');
        setAnnouncement(
          'Generation cancelled on this screen. Your prompt is unchanged. If provider processing already started, a draft may still be counted.'
        );
      } else {
        trackEvent('design_generation_completed', {
          result: 'failed',
          source: completionSource,
        });
        fail('generation', error);
        setFlow('configuring');
        setWorkbenchMode('describe');
      }
    } finally {
      window.clearTimeout(phaseOne);
      window.clearTimeout(phaseTwo);
      setAction('generating', false);
      setOperationStartedAt(null);
      generationController.current = null;
    }
  };
  const cancelGeneration = () => generationController.current?.abort();
  const reviseDraft = async () => {
    if (!design?.id || !revision.trim()) return;
    setRecoveryMessage('');
    if (!canRevise) {
      setErrors((current) => ({
        ...current,
        generation: {
          cause: 'revision_allowance_required',
          title: 'No more variations are available in this studio session',
          message: 'This session has no revision allowance remaining.',
          recovery: 'Your current artwork, product preview, and price are unchanged.',
          retryable: false,
        },
      }));
      setAnnouncement('Revision blocked. Your current artwork is unchanged.');
      return;
    }
    setAction('revising', true);
    setWorkbenchMode('generating');
    clearError('generation');
    try {
      const result = await api.reviseDraft({
        draftId: design.id,
        instructions: revision,
        sessionId: session?.id,
      });
      const revised = consumeSource(result);
      const nextPlacementArtwork = Object.fromEntries(
        Object.entries(placementArtwork).map(([code, assigned]) => [
          code,
          assigned.id === design.id ? revised : assigned,
        ])
      );
      setDesignHistory((current) =>
        current.some((item) => item.id === design.id) ? current : [...current, design]
      );
      setDesign(revised);
      setPlacementArtwork(nextPlacementArtwork);
      setMockup(null);
      setQuoteStale(Boolean(quote));
      setFlow('drafted');
      setRevision('');
      setAnnouncement('New variation ready. Rebuilding your product mockup.');
      trackEvent('design_revision_completed', {
        result: 'success',
        remaining: revisionBand(revised.allowance.editsRemaining),
      });
      setAction('revising', false);
      if (selectedProduct && selectedVariant) {
        await requestMockup({
          product: selectedProduct,
          variant: selectedVariant,
          placements: selectedPlacements,
          draft: revised,
          artworkByCode: nextPlacementArtwork,
          orientation: selectedOrientation,
        });
      }
      setWorkbenchMode('review');
    } catch (error) {
      trackEvent('design_revision_completed', {
        result: 'failed',
        remaining: revisionBand(design.allowance.editsRemaining),
      });
      fail('generation', error);
      setWorkbenchMode('review');
    } finally {
      setAction('revising', false);
    }
  };
  const undoDraft = async () => {
    const previous = designHistory[designHistory.length - 1];
    if (!previous) return;
    const nextPlacementArtwork = Object.fromEntries(
      Object.entries(placementArtwork).map(([code, assigned]) => [
        code,
        assigned.id === design?.id ? previous : assigned,
      ])
    );
    setDesignHistory((current) => current.slice(0, -1));
    setDesign(previous);
    setPlacementArtwork(nextPlacementArtwork);
    setRevision('');
    setQuoteStale(Boolean(quote));
    setCheckout(null);
    setOrder(null);
    setAnnouncement('Previous artwork restored. Rebuilding its product preview.');
    trackEvent('design_revision_completed', {
      result: 'undone',
      remaining: revisionBand(previous.allowance.editsRemaining),
    });
    if (selectedProduct && selectedVariant) {
      await requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft: previous,
        artworkByCode: nextPlacementArtwork,
        orientation: selectedOrientation,
      });
    }
  };
  const createMockup = async () => {
    if (!selectedProduct || !selectedVariant || !design) return;
    await requestMockup({
      product: selectedProduct,
      variant: selectedVariant,
      placements: selectedPlacements,
      draft: design,
      artworkByCode: placementArtwork,
      mugLayout,
      orientation: selectedOrientation,
    });
  };
  const placementArtworkSignature = placementArtworkKey(
    selectedPlacements,
    placementArtwork,
    design
  );
  const createQuote = async (options: { automatic?: boolean } = {}) => {
    if (!selectedProduct || !selectedVariant || !artworkQuoteEligible || !design?.id) return;
    const requestId = ++quoteRequestId.current;
    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    setAction('quoting', true);
    clearError('quote');
    try {
      const sourced = await api.quote(
        {
          sessionId: session?.id,
          studioPassId: studioPass?.id,
          items: [
            {
              productId: selectedProduct.id,
              variantId: selectedVariant.id,
              quantity: 1,
              placementCodes: selectedPlacements,
              placements: buildPlacementSelections(
                selectedPlacements,
                design,
                placementArtwork,
                mugLayout
              ),
              orientation: selectedOrientation,
              designAssetId: design.id,
            },
          ],
        },
        controller.signal
      );
      const result = consumeSource(sourced);
      if (requestId !== quoteRequestId.current) return;
      setQuote(result);
      setQuoteStale(false);
      setFlow('quoted');
      trackEvent('quote_created', {
        source: sourced.source,
        total_band: totalBand(result.totalCents),
      });
      setAnnouncement(
        `${options.automatic ? 'Price estimate ready' : 'Price updated'}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: result.currency }).format(result.totalCents / 100)}.`
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== quoteRequestId.current) return;
      fail('quote', error);
    } finally {
      if (requestId === quoteRequestId.current) {
        setAction('quoting', false);
        quoteController.current = null;
      }
    }
  };
  useEffect(() => {
    if (!artworkQuoteEligible || !design?.id || !selectedProduct || !selectedVariant) {
      quoteController.current?.abort();
      setQuote(null);
      setQuoteStale(false);
      setCheckout(null);
      return undefined;
    }
    if (quote && !quoteStale && !quoteExpired) return undefined;
    const timer = window.setTimeout(() => {
      void createQuote({ automatic: true });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    artworkQuoteEligible,
    design?.id,
    quote,
    quoteExpired,
    quoteStale,
    placementArtworkSignature,
    mugLayout,
    selectedOrientation,
    selectedPlacements,
    selectedProduct?.id,
    selectedVariant?.id,
    studioPass?.id,
  ]);
  useEffect(
    () => () => {
      quoteController.current?.abort();
    },
    []
  );
  const buyStudioPass = async () => {
    if (!session) return;
    if (!canUseCustomerCheckout) {
      setCheckout({
        id: 'checkout-disabled',
        mode: 'stripe-ready',
        status: 'blocked',
        checkoutUrl: null,
        message: 'Checkout opens soon. Your design and quote stay in this session.',
      });
      return;
    }
    setAction('pass', true);
    clearError('checkout');
    try {
      const result = consumeSource(await api.studioPassCheckout(session.id));
      setCheckout(result);
      if (result.status === 'open' && result.checkoutUrl) {
        trackEvent('studio_pass_checkout_started', {
          source: 'gate',
          result: result.mode === 'stripe' ? 'live' : 'fallback',
        });
        setAnnouncement('Opening secure checkout.');
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.studioPassId)
        setStudioPass({
          id: result.studioPassId,
          sessionId: session.id,
          status: 'simulated',
          priceCents: 500,
          creditCents: 500,
          includedRoughDrafts: 8,
          includedEdits: 2,
          includedFinals: 1,
          roughDraftsUsed: 0,
          editsUsed: 0,
          finalsUsed: 0,
          createdAt: new Date().toISOString(),
        });
      setAnnouncement(
        'Studio Pass activated. The eligible order credit will be applied automatically.'
      );
    } catch (error) {
      fail('checkout', error);
    } finally {
      setAction('pass', false);
    }
  };
  const createCheckout = async (policyAccepted: true, policyVersion: string) => {
    if (!quote || !checkoutReadiness.ready) {
      setErrors((current) => ({
        ...current,
        checkout: {
          cause: 'checkout_not_ready',
          title: 'Checkout needs one more step',
          message: checkoutReadiness.blocker,
          recovery: 'Your artwork and estimate are saved.',
          retryable: false,
        },
      }));
      return;
    }
    if (!canUseCustomerCheckout) {
      setCheckout({
        id: 'checkout-disabled',
        mode: 'stripe-ready',
        status: 'blocked',
        checkoutUrl: null,
        quoteId: quote.id,
        message: 'Checkout opens soon. Your design and quote stay in this session.',
      });
      return;
    }
    setAction('checkout', true);
    setFlow('ordering');
    clearError('checkout');
    clearError('order');
    try {
      const result = consumeSource(
        await api.checkout({
          quote,
          quoteId: quote.id,
          sessionId: session?.id,
          studioPassId: studioPass?.id,
          email: email || undefined,
          designAssetId: design?.id ?? undefined,
          policyAccepted,
          policyVersion,
        })
      );
      setCheckout(result);
      if (result.status === 'open' && result.checkoutUrl) {
        trackEvent('checkout_started', {
          source: 'quote',
          studio_pass: Boolean(studioPass),
        });
        setFlow('redirecting');
        setAnnouncement('Checkout ready. Redirecting to secure payment.');
        window.location.assign(result.checkoutUrl);
        return;
      }
      const inlineOrder = (result as CheckoutSession & { order?: CustomerOrderConfirmation }).order;
      if (inlineOrder) {
        setOrder(inlineOrder);
        setFlow('confirmed');
        setAnnouncement(`Order ${inlineOrder.orderNumber} confirmed.`);
        setWorkbenchMode('order');
      } else if (result.orderId) {
        try {
          const nextOrder = consumeSource(await api.order(result.orderId));
          setOrder(nextOrder);
          setFlow('confirmed');
          setAnnouncement(`Order ${nextOrder.orderNumber} confirmed.`);
          setWorkbenchMode('order');
        } catch (error) {
          setFlow('confirmed');
          setErrors((current) => ({
            ...current,
            order: {
              cause: 'details_pending',
              title: 'Order received; details are still loading',
              message: error instanceof Error ? error.message : 'Order details are pending.',
              recovery: 'Retry the order lookup. Do not submit payment again.',
              retryable: true,
            },
          }));
        }
      }
    } catch (error) {
      fail('checkout', error);
      setFlow('quoted');
    } finally {
      setAction('checkout', false);
    }
  };

  const stepStates = useMemo(
    () => deriveStepStates({ workbenchMode, selectedProduct, design }),
    [selectedProduct, design, workbenchMode]
  );
  const navigate = (step: StudioStep) => {
    if (workbenchMode === 'generating' || busy.generating || busy.revising) return;
    if (step === 'product') setWorkbenchMode('product');
    if (step === 'make' && selectedProduct) setWorkbenchMode(design ? 'review' : 'configure');
    if (step === 'order' && artworkReady) setWorkbenchMode('checkout');
  };
  const acceptConfirmedOrder = useCallback((confirmedOrder: CustomerOrderConfirmation) => {
    setOrder(confirmedOrder);
    setFlow('confirmed');
    setAnnouncement(`Order ${confirmedOrder.orderNumber} is ready to review.`);
    setWorkbenchMode('order');
  }, []);
  const startFresh = () => {
    const confirmed = window.confirm(
      'Start fresh? This clears the product, prompt, artwork, and price saved in this browser.'
    );
    if (!confirmed) return;
    startingFresh.current = true;
    generationController.current?.abort();
    quoteController.current?.abort();
    clearStudioResumeState();
    if (session?.id) void api.cleanupSessionUploads(session.id);
    window.location.replace(window.location.pathname);
  };

  return {
    flow,
    workbenchMode,
    categories,
    products,
    session,
    studioPass,
    capabilities,
    selectedCategory,
    selectedProduct,
    selectedVariant,
    selectedProductId,
    selectedVariantId,
    selectedPlacements,
    placementArtwork,
    activePlacementCode,
    mugLayout,
    selectedOrientation,
    prompt,
    creationPath,
    referenceAssets,
    revision,
    email,
    idea,
    design,
    mockup,
    quote,
    checkout,
    order,
    busy,
    errors,
    fallback,
    dataSource,
    mockupStale,
    quoteStale,
    generationPhase,
    operationStartedAt,
    announcement,
    recoveryMessage,
    activeMockupViewIndex,
    designHistory,
    online,
    quoteExpired,
    artworkReady,
    artworkQuoteEligible,
    checkoutReadiness,
    canGenerateAnother,
    canRevise,
    stepStates,
    setPrompt: updatePrompt,
    setCreationPath,
    setRevision,
    setEmail,
    setSelectedCategory,
    selectProduct,
    setSelectedVariantId,
    setSelectedOrientation,
    togglePlacement,
    setMugLayout,
    customizePlacement,
    reusePlacementArtwork,
    refineIdea,
    generate,
    uploadArtwork,
    addReferenceImages,
    removeReferenceAsset,
    cancelGeneration,
    reviseDraft,
    undoDraft,
    setActiveMockupViewIndex,
    createMockup,
    createQuote,
    buyStudioPass,
    createCheckout,
    boot,
    navigate,
    acceptConfirmedOrder,
    startFresh,
    continueFromConfigure: () => setWorkbenchMode(design ? 'review' : 'describe'),
    showProduct: () => setWorkbenchMode('product'),
    showConfigure: () => setWorkbenchMode('configure'),
    showDescribe: () => setWorkbenchMode('describe'),
    showReview: () => setWorkbenchMode('review'),
    showCheckout: () => setWorkbenchMode('checkout'),
    dismissRecovery: () => setRecoveryMessage(''),
    dismissFallback: () => setFallback(null),
    clearError,
  };
}
