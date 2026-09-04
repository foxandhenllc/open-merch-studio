import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type DataSource, type Sourced } from '@services/api';
import { canUseCustomerCheckout } from './config';
import type {
  CatalogCategory,
  CatalogProduct,
  CheckoutSession,
  CustomerOrderConfirmation,
  DesignDraft,
  DesignIdea,
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
  deriveArtworkState,
  deriveCheckoutReadiness,
  deriveDesignAllowance,
  deriveStepStates,
  emptyBusy,
  mapStudioError,
  mockupKey,
  placementArtworkKey,
  previewOrientation,
} from './studio-view-model.selectors';
import {
  reusePlacementAssignment,
  selectProductConfiguration,
  selectVariantConfiguration,
  togglePlacementConfiguration,
  type RememberedProductSelection,
} from './studio-configuration.transitions';
import {
  acceptArtworkDraft,
  appendDesignHistory,
  appendReferenceAssets,
  assertUsableGeneratedDraft,
  referenceAssetIds,
  replaceDraftAssignments,
  selectReferenceFiles,
  undoArtworkRevision,
} from './studio-artwork.transitions';
import {
  normalizeStudioItemQuantity,
  prepareQuoteRequest,
  quoteAnnouncement,
} from './studio-quote';
import {
  checkoutNotReadyError,
  checkoutUnavailable,
  classifyCheckoutResult,
  orderDetailsPendingError,
  prepareCheckoutRequest,
} from './studio-checkout';
import { createStudioCartItem, MAX_STUDIO_CART_LINES, studioCartUnitCount } from './studio-cart';
import { useGuestCart } from './hooks/useGuestCart';
import { useStudioMockup, type StudioMockupRequest } from './hooks/useStudioMockup';

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
  const [quantity, setQuantityState] = useState(1);
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
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [checkoutSource, setCheckoutSource] = useState<'design' | 'cart'>('design');
  const [order, setOrder] = useState<CustomerOrderConfirmation | null>(null);
  const [busy, setBusy] = useState(emptyBusy);
  const [errors, setErrors] = useState<Partial<Record<Surface, SurfaceError>>>({});
  const [fallback, setFallback] = useState<{ visible: boolean; reason: string } | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('live');
  const [quoteStale, setQuoteStale] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('Queued');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [designHistory, setDesignHistory] = useState<DesignDraft[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const generationController = useRef<AbortController | null>(null);
  const quoteController = useRef<AbortController | null>(null);
  const quoteRequestId = useRef(0);
  const startingFresh = useRef(false);
  const productSelections = useRef(new Map<string, RememberedProductSelection>());

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
  const studioMockup = useStudioMockup({
    sessionId: session?.id,
    quotePresent: Boolean(quote),
    dataSource,
    onSource: consumeSource,
    onFlowChange: setFlow,
    onModeChange: setWorkbenchMode,
    onAnnouncement: setAnnouncement,
    onOperationStartedAt: setOperationStartedAt,
  });
  const {
    mockup,
    setMockup,
    stale: mockupStale,
    setStale: setMockupStale,
    busy: mockupBusy,
    error: mockupError,
    activeViewIndex: activeMockupViewIndex,
    setActiveViewIndex: setActiveMockupViewIndex,
    cacheMockup,
  } = studioMockup;
  const cart = useGuestCart({
    sessionId: session?.id,
    studioPassId: studioPass?.id,
    onSource: consumeSource,
  });
  const cartCheckoutReadiness = useMemo(
    () =>
      deriveCheckoutReadiness({
        artworkReady: cart.items.length > 0,
        quote: cart.quote,
        quoteStale: cart.quoteStale,
        quoteExpired: cart.quoteExpired,
        email,
        paymentAvailable: canUseCustomerCheckout,
      }),
    [cart.items.length, cart.quote, cart.quoteExpired, cart.quoteStale, email]
  );
  const setAction = (key: ActionKey, value: boolean) =>
    setBusy((current) => ({ ...current, [key]: value }));
  const clearError = (surface: Surface) => {
    if (surface === 'mockup') {
      studioMockup.clearError();
      return;
    }
    setErrors((current) => ({ ...current, [surface]: undefined }));
  };
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
        const availableReferences = restoredReferences.filter((asset): asset is DesignDraft =>
          Boolean(asset?.id)
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
      setQuantityState(saved.quantity);
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
        restoredPlacementArtworkEntries.filter((entry): entry is readonly [string, DesignDraft] =>
          Boolean(entry)
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
            item.designAssetId === restoredDraft.id &&
            item.quantity === saved.quantity
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
          cacheMockup(
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
                  designAssetId:
                    restoredPlacementArtwork[code]?.id ?? restoredDraft.id ?? undefined,
                  layout: code === 'default' ? saved.mugLayout : undefined,
                })),
                designAssetId: restoredDraft.id,
                imageUrl: restoredDraft.imageUrl,
                orientation,
              })
            );
            setMockup(restoredMockup);
            if (restoredMockup.status === 'complete') {
              cacheMockup(
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
  }, [cacheMockup, consumeSource]);

  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    if (startingFresh.current || !session || flow === 'booting' || flow === 'boot_failed') return;
    writeStudioResumeState({
      version: 5,
      sessionId: session.id,
      selectedCategory,
      productId: selectedProductId,
      variantId: selectedVariantId,
      quantity,
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
      referenceAssetIds: referenceAssetIds(referenceAssets),
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
    quantity,
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
  const requestMockup = (
    params: Omit<StudioMockupRequest, 'artworkByCode' | 'mugLayout'> & {
      artworkByCode?: Record<string, DesignDraft>;
      mugLayout?: PlacementLayout;
    }
  ) =>
    studioMockup.request({
      ...params,
      artworkByCode: params.artworkByCode ?? placementArtwork,
      mugLayout: params.mugLayout ?? mugLayout,
    });
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
  const setQuantity = (value: number) => {
    const nextQuantity = normalizeStudioItemQuantity(value);
    if (nextQuantity === quantity) return;
    quoteRequestId.current += 1;
    quoteController.current?.abort();
    quoteController.current = null;
    setAction('quoting', false);
    setQuantityState(nextQuantity);
    if (quote) {
      setQuoteStale(true);
      setFlow('quote_stale');
    }
    setCheckout(null);
    setOrder(null);
    setAnnouncement(`Quantity updated to ${nextQuantity}. Refreshing your price estimate.`);
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
    const {
      variant,
      placements,
      orientation,
      placementArtwork: nextPlacementArtwork,
    } = selectProductConfiguration({
      product,
      remembered: productSelections.current.get(product.id),
      design,
    });
    setSelectedProductId(product.id);
    setSelectedVariantIdState(variant?.id ?? '');
    setSelectedPlacements(placements);
    setPlacementArtwork(nextPlacementArtwork);
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
    const { variant, orientation } = selectedProduct
      ? selectVariantConfiguration({
          product: selectedProduct,
          variantId: id,
          selectedOrientation,
        })
      : { variant: undefined, orientation: undefined };
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
    const transition = togglePlacementConfiguration({
      code,
      selectedPlacements,
      placementArtwork,
      design,
    });
    if (!transition.changed) return;
    const next = transition.placements;
    const nextPlacementArtwork = transition.placementArtwork;
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
    const label = selectedProduct?.placements.find(
      (placement) => placement.code === code
    )?.displayName;
    setAnnouncement(`Create different artwork for ${label ?? code}.`);
  };
  const reusePlacementArtwork = (sourceCode: string, targetCode: string) => {
    const next = reusePlacementAssignment({
      sourceCode,
      targetCode,
      placementArtwork,
      design,
    });
    if (!next) return;
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
      const nextPlacementArtwork = acceptArtworkDraft({
        draft,
        activePlacementCode,
        selectedPlacements,
        placementArtwork,
      });
      if (design?.id) {
        setDesignHistory((current) => appendDesignHistory(current, design));
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
    const selectedFiles = selectReferenceFiles(files, referenceAssets.length);
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
      setReferenceAssets((current) => appendReferenceAssets(current, results));
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
                referenceAssetIds: referenceAssetIds(referenceAssets),
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
      assertUsableGeneratedDraft(draft);
      const nextPlacementArtwork = acceptArtworkDraft({
        draft,
        activePlacementCode,
        selectedPlacements,
        placementArtwork,
      });
      if (design?.id) {
        setDesignHistory((current) => appendDesignHistory(current, design));
      }
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
      const nextPlacementArtwork = replaceDraftAssignments(placementArtwork, design.id, revised);
      setDesignHistory((current) => appendDesignHistory(current, design));
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
    const undone = undoArtworkRevision({
      history: designHistory,
      currentDesign: design,
      placementArtwork,
    });
    if (!undone) return;
    setDesignHistory(undone.history);
    setDesign(undone.design);
    setPlacementArtwork(undone.placementArtwork);
    setRevision('');
    setQuoteStale(Boolean(quote));
    setCheckout(null);
    setOrder(null);
    setAnnouncement('Previous artwork restored. Rebuilding its product preview.');
    trackEvent('design_revision_completed', {
      result: 'undone',
      remaining: revisionBand(undone.design.allowance.editsRemaining),
    });
    if (selectedProduct && selectedVariant) {
      await requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft: undone.design,
        artworkByCode: undone.placementArtwork,
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
      const request = prepareQuoteRequest({
        sessionId: session?.id,
        studioPassId: studioPass?.id,
        product: selectedProduct,
        variant: selectedVariant,
        selectedPlacements,
        design,
        placementArtwork,
        quantity,
        mugLayout,
        orientation: selectedOrientation,
      });
      if (!request) return;
      const sourced = await api.quote(request, controller.signal);
      const result = consumeSource(sourced);
      if (requestId !== quoteRequestId.current) return;
      setQuote(result);
      setQuoteStale(false);
      setFlow('quoted');
      trackEvent('quote_created', {
        source: sourced.source,
        total_band: totalBand(result.totalCents),
      });
      setAnnouncement(quoteAnnouncement(result, Boolean(options.automatic)));
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
    quantity,
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
      setCheckout(checkoutUnavailable());
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
    const activeQuote = checkoutSource === 'cart' ? cart.quote : quote;
    const activeReadiness = checkoutSource === 'cart' ? cartCheckoutReadiness : checkoutReadiness;
    if (!activeQuote || !activeReadiness.ready) {
      setErrors((current) => ({
        ...current,
        checkout: checkoutNotReadyError(activeReadiness.blocker),
      }));
      return;
    }
    if (!canUseCustomerCheckout) {
      setCheckout(checkoutUnavailable(activeQuote.id));
      return;
    }
    setAction('checkout', true);
    if (checkoutSource === 'cart') {
      window.sessionStorage.setItem('open-merch-studio:pending-cart-checkout:v1', 'true');
    } else {
      window.sessionStorage.removeItem('open-merch-studio:pending-cart-checkout:v1');
    }
    setFlow('ordering');
    clearError('checkout');
    clearError('order');
    try {
      const result = consumeSource(
        await api.checkout(
          prepareCheckoutRequest({
            quote: activeQuote,
            sessionId: session?.id,
            studioPassId: studioPass?.id,
            email,
            design: checkoutSource === 'cart' ? null : design,
            policyAccepted,
            policyVersion,
          })
        )
      );
      setCheckout(result);
      const outcome = classifyCheckoutResult(result);
      if (outcome.kind === 'redirect') {
        trackEvent('checkout_started', {
          source: 'quote',
          studio_pass: Boolean(studioPass),
        });
        setFlow('redirecting');
        setAnnouncement('Checkout ready. Redirecting to secure payment.');
        window.location.assign(outcome.checkoutUrl);
        return;
      }
      if (outcome.kind === 'inline-order') {
        if (checkoutSource === 'cart') cart.clear();
        setOrder(outcome.order);
        setFlow('confirmed');
        setAnnouncement(`Order ${outcome.order.orderNumber} confirmed.`);
        setWorkbenchMode('order');
      } else if (outcome.kind === 'lookup-order') {
        try {
          const nextOrder = consumeSource(await api.order(outcome.orderId));
          if (checkoutSource === 'cart') cart.clear();
          setOrder(nextOrder);
          setFlow('confirmed');
          setAnnouncement(`Order ${nextOrder.orderNumber} confirmed.`);
          setWorkbenchMode('order');
        } catch (error) {
          setFlow('confirmed');
          setErrors((current) => ({
            ...current,
            order: orderDetailsPendingError(error),
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

  const resetCurrentDesign = () => {
    quoteRequestId.current += 1;
    quoteController.current?.abort();
    setSelectedProductId('');
    setSelectedVariantIdState('');
    setQuantityState(1);
    setSelectedPlacements([]);
    setPlacementArtwork({});
    setActivePlacementCode('');
    setPrompt('');
    setCreationPath('generate');
    setReferenceAssets([]);
    setIdea(null);
    setDesign(null);
    setMockup(null);
    setQuote(null);
    setQuoteStale(false);
    setCheckout(null);
    setFlow('configuring');
    setWorkbenchMode('product');
  };

  const addCurrentDesignToCart = () => {
    if (cart.items.length >= MAX_STUDIO_CART_LINES) {
      setAnnouncement(`Your cart can hold up to ${MAX_STUDIO_CART_LINES} configured products.`);
      setWorkbenchMode('cart');
      return;
    }
    if (
      !selectedProduct ||
      !selectedVariant ||
      !design ||
      !artworkReady ||
      !quote ||
      quoteStale ||
      quoteExpired
    ) {
      setAnnouncement('Wait for a print-ready design and current estimate before adding it.');
      return;
    }
    const item = createStudioCartItem({
      product: selectedProduct,
      variant: selectedVariant,
      quantity,
      selectedPlacements,
      design,
      placementArtwork,
      mugLayout,
      orientation: selectedOrientation,
    });
    if (!item) return;
    cart.add(item);
    setAnnouncement(`${selectedProduct.title} added to your cart.`);
    resetCurrentDesign();
  };

  const stepStates = useMemo(
    () => deriveStepStates({ workbenchMode, selectedProduct, design }),
    [selectedProduct, design, workbenchMode]
  );
  const navigate = (step: StudioStep) => {
    if (workbenchMode === 'generating' || busy.generating || busy.revising) return;
    if (step === 'product') setWorkbenchMode('product');
    if (step === 'make' && selectedProduct) setWorkbenchMode(design ? 'review' : 'configure');
    if (step === 'order' && cart.items.length) setWorkbenchMode('cart');
    else if (step === 'order' && artworkReady) {
      setCheckoutSource('design');
      setWorkbenchMode('checkout');
    }
  };
  const acceptConfirmedOrder = useCallback(
    (confirmedOrder: CustomerOrderConfirmation) => {
      if (window.sessionStorage.getItem('open-merch-studio:pending-cart-checkout:v1')) {
        cart.clear();
        window.sessionStorage.removeItem('open-merch-studio:pending-cart-checkout:v1');
      }
      setOrder(confirmedOrder);
      setFlow('confirmed');
      setAnnouncement(`Order ${confirmedOrder.orderNumber} is ready to review.`);
      setWorkbenchMode('order');
    },
    [cart.clear]
  );
  const startFresh = () => {
    const confirmed = window.confirm(
      'Start fresh? This clears the product, prompt, artwork, cart, and prices saved in this browser.'
    );
    if (!confirmed) return;
    startingFresh.current = true;
    generationController.current?.abort();
    quoteController.current?.abort();
    clearStudioResumeState();
    cart.clear();
    window.sessionStorage.removeItem('open-merch-studio:pending-cart-checkout:v1');
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
    quantity,
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
    cart,
    cartUnitCount: studioCartUnitCount(cart.items),
    checkoutSource,
    checkout,
    order,
    busy: { ...busy, mockup: mockupBusy },
    errors: { ...errors, mockup: mockupError },
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
    cartCheckoutReadiness,
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
    setQuantity,
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
    addCurrentDesignToCart,
    boot,
    navigate,
    acceptConfirmedOrder,
    startFresh,
    continueFromConfigure: () => setWorkbenchMode(design ? 'review' : 'describe'),
    showProduct: () => setWorkbenchMode('product'),
    showConfigure: () => setWorkbenchMode('configure'),
    showDescribe: () => setWorkbenchMode('describe'),
    showReview: () => setWorkbenchMode('review'),
    showCart: () => setWorkbenchMode('cart'),
    showCheckout: () => {
      setCheckoutSource('design');
      setWorkbenchMode('checkout');
    },
    showCartCheckout: () => {
      setCheckoutSource('cart');
      setWorkbenchMode('checkout');
    },
    showCheckoutBack: () => setWorkbenchMode(checkoutSource === 'cart' ? 'cart' : 'review'),
    dismissRecovery: () => setRecoveryMessage(''),
    dismissFallback: () => setFallback(null),
    clearError,
  };
}
