import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type DataSource, type Sourced } from '@services/api';
import { canUseCustomerCheckout } from './config';
import type {
  CatalogCategory,
  CatalogProduct,
  DesignDraft,
  PlacementLayout,
  StudioCapabilities,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';
import type { StudioStep } from '@components/StepRail.types';
import { clearStudioResumeState, writeStudioResumeState } from './studio-persistence';
import { productType, trackEvent } from './utils/analytics';
import type {
  ActionKey,
  FlowState,
  PreviewOrientation,
  Surface,
  SurfaceError,
  WorkbenchMode,
} from './studio-view-model.types';
import {
  deriveArtworkState,
  deriveCheckoutReadiness,
  deriveStepStates,
  emptyBusy,
  mapStudioError,
  placementArtworkKey,
} from './studio-view-model.selectors';
import {
  reusePlacementAssignment,
  selectProductConfiguration,
  selectVariantConfiguration,
  togglePlacementConfiguration,
  type RememberedProductSelection,
} from './studio-configuration.transitions';
import { referenceAssetIds } from './studio-artwork.transitions';
import { normalizeStudioItemQuantity } from './studio-quote';
import { createStudioCartItem, MAX_STUDIO_CART_LINES, studioCartUnitCount } from './studio-cart';
import { useGuestCart } from './hooks/useGuestCart';
import { useStudioMockup, type StudioMockupRequest } from './hooks/useStudioMockup';
import { useStudioQuote } from './hooks/useStudioQuote';
import { useStudioArtwork, type ArtworkCommit } from './hooks/useStudioArtwork';
import { useStudioCheckout } from './hooks/useStudioCheckout';
import { restoreStudioSession } from './studio-session-restoration';

export type {
  ActionKey,
  CreationPath,
  FlowState,
  PreviewOrientation,
  Surface,
  SurfaceError,
  WorkbenchMode,
} from './studio-view-model.types';

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
  const [mugLayout, setMugLayoutState] = useState<PlacementLayout>('center');
  const [selectedOrientation, setSelectedOrientationState] = useState<
    PreviewOrientation | undefined
  >();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(emptyBusy);
  const [errors, setErrors] = useState<Partial<Record<Surface, SurfaceError>>>({});
  const [fallback, setFallback] = useState<{ visible: boolean; reason: string } | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('live');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const startingFresh = useRef(false);
  const productSelections = useRef(new Map<string, RememberedProductSelection>());
  // Artwork is constructed before checkout; this narrow bridge avoids either hook owning the other.
  const clearCheckoutResults = useRef<() => void>(() => undefined);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );
  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedProduct, selectedVariantId]
  );
  const consumeSource = useCallback(<T>(result: Sourced<T>): T => {
    setDataSource(result.source);
    if (result.fallbackReason) setFallback({ visible: true, reason: result.fallbackReason });
    return result.data;
  }, []);
  const studioQuote = useStudioQuote({
    sessionId: session?.id,
    studioPassId: studioPass?.id,
    onSource: consumeSource,
    onFlowChange: setFlow,
    onAnnouncement: setAnnouncement,
  });
  const {
    quote,
    setQuote,
    stale: quoteStale,
    setStale: setQuoteStale,
    expired: quoteExpired,
    busy: quoteBusy,
    error: quoteError,
  } = studioQuote;
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
    request: requestStudioMockup,
  } = studioMockup;
  const commitArtwork = useCallback(
    async (commit: ArtworkCommit) => {
      setMockup(null);
      if (commit.kind === 'replacement') {
        studioQuote.clear();
        setMockupStale(false);
      } else {
        studioQuote.invalidate();
      }
      if (commit.kind === 'undo') {
        clearCheckoutResults.current();
      }
      await requestStudioMockup({
        product: commit.product,
        variant: commit.variant,
        placements: commit.selectedPlacements,
        draft: commit.draft,
        artworkByCode: commit.placementArtwork,
        mugLayout: commit.mugLayout,
        orientation: commit.orientation,
      });
    },
    [requestStudioMockup, setMockup, setMockupStale, studioQuote]
  );
  const artwork = useStudioArtwork({
    sessionId: session?.id,
    capabilities,
    dataSource,
    onSource: consumeSource,
    onFlowChange: setFlow,
    onModeChange: setWorkbenchMode,
    onAnnouncement: setAnnouncement,
    onRecoveryClear: () => setRecoveryMessage(''),
    onOperationStartedAt: setOperationStartedAt,
    onArtworkCommit: commitArtwork,
  });
  const {
    prompt,
    setPrompt,
    updatePrompt,
    creationPath,
    setCreationPath,
    referenceAssets,
    setReferenceAssets,
    revision,
    setRevision,
    idea,
    setIdea,
    design,
    setDesign,
    placementArtwork,
    setPlacementArtwork,
    activePlacementCode,
    setActivePlacementCode,
    designHistory,
    setDesignHistory,
    generationPhase,
    canGenerateAnother,
    canRevise,
  } = artwork;
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
  const studioCheckout = useStudioCheckout({
    session,
    studioPass,
    email,
    design,
    quote,
    cartQuote: cart.quote,
    designReadiness: checkoutReadiness,
    cartReadiness: cartCheckoutReadiness,
    onStudioPassChange: setStudioPass,
    onCartClear: cart.clear,
    onCartReplace: cart.replace,
    onSource: consumeSource,
    onFlowChange: setFlow,
    onModeChange: setWorkbenchMode,
    onAnnouncement: setAnnouncement,
  });
  clearCheckoutResults.current = studioCheckout.clearResults;
  const { source: checkoutSource, checkout, order } = studioCheckout;
  const setAction = (key: ActionKey, value: boolean) =>
    setBusy((current) => ({ ...current, [key]: value }));
  const clearError = (surface: Surface) => {
    if (surface === 'mockup') {
      studioMockup.clearError();
      return;
    }
    if (surface === 'quote') {
      studioQuote.clearError();
      return;
    }
    if (surface === 'generation') {
      artwork.clearError();
      return;
    }
    if (surface === 'checkout' || surface === 'order') {
      studioCheckout.clearError(surface);
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
      const restored = await restoreStudioSession({ onSource: consumeSource });
      setCategories(restored.categories);
      setProducts(restored.products);
      setCapabilities(restored.capabilities);
      setSession(restored.session);
      setStudioPass(restored.session.studioPass ?? null);
      setSelectedCategoryState(restored.selectedCategory);
      setPrompt(restored.prompt);
      setReferenceAssets(restored.references);
      setCreationPath(restored.creationPath);

      if (restored.selection) {
        const { product, variant, placements, orientation } = restored.selection;
        setSelectedProductId(product.id);
        setSelectedVariantIdState(variant.id);
        setQuantityState(restored.selection.quantity);
        setSelectedPlacements(placements);
        setMugLayoutState(restored.selection.mugLayout);
        setSelectedOrientationState(orientation);
        productSelections.current.set(product.id, {
          variantId: variant.id,
          placements,
          orientation,
        });
      }

      setDesign(restored.design);
      setPlacementArtwork(restored.placementArtwork);
      setDesignHistory([]);
      setActiveMockupViewIndex(restored.mockupViewIndex);
      setQuote(restored.quote);
      setQuoteStale(false);
      if (restored.mockup) {
        setMockup(restored.mockup);
        if (restored.mockupCacheKey) {
          cacheMockup(restored.mockupCacheKey, restored.mockup);
        }
      }
      setRecoveryMessage(restored.recoveryMessage);
      setFlow(restored.flow);
      setWorkbenchMode(restored.mode);
      setAnnouncement(restored.announcement);
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
    studioQuote.invalidate();
    if (mockup) setMockupStale(true);
    if (quote) setFlow('quote_stale');
    else setFlow(design ? 'drafted' : 'configuring');
    studioCheckout.clearResults();
  };
  const setQuantity = (value: number) => {
    const nextQuantity = normalizeStudioItemQuantity(value);
    if (nextQuantity === quantity) return;
    studioQuote.invalidate();
    setQuantityState(nextQuantity);
    if (quote) {
      setFlow('quote_stale');
    }
    studioCheckout.clearResults();
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

  const artworkContext =
    selectedProduct && selectedVariant
      ? {
          product: selectedProduct,
          variant: selectedVariant,
          selectedPlacements,
          mugLayout,
          orientation: selectedOrientation,
        }
      : null;
  const uploadArtwork = async (file: File, removeBackground = false) => {
    if (artworkContext) await artwork.uploadArtwork(file, removeBackground, artworkContext);
  };
  const addReferenceImages = (files: File[]) =>
    artwork.addReferenceImages(files, selectedPlacements);
  const removeReferenceAsset = (assetId: string | null) => artwork.removeReferenceAsset(assetId);
  const refineIdea = () => artwork.refineIdea(selectedProduct, selectedPlacements);
  const generate = async () => {
    if (artworkContext) await artwork.generate(artworkContext);
  };
  const reviseDraft = async () => {
    if (artworkContext) await artwork.reviseDraft(artworkContext);
  };
  const undoDraft = async () => {
    if (artworkContext) await artwork.undoDraft(artworkContext);
  };
  const cancelGeneration = artwork.cancelGeneration;
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
    await studioQuote.request({
      product: selectedProduct,
      variant: selectedVariant,
      selectedPlacements,
      design,
      placementArtwork,
      quantity,
      mugLayout,
      orientation: selectedOrientation,
      automatic: options.automatic,
    });
  };
  useEffect(() => {
    if (!artworkQuoteEligible || !design?.id || !selectedProduct || !selectedVariant) {
      studioQuote.clear();
      studioCheckout.clearCheckout();
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
  const resetCurrentDesign = () => {
    studioQuote.clear();
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
    studioCheckout.clearCheckout();
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
    if (workbenchMode === 'generating' || artwork.busy.generating || artwork.busy.revising) return;
    if (step === 'product') setWorkbenchMode('product');
    if (step === 'make' && selectedProduct) setWorkbenchMode(design ? 'review' : 'configure');
    if (step === 'order' && cart.items.length) setWorkbenchMode('cart');
    else if (step === 'order' && artworkReady) {
      studioCheckout.setSource('design');
      setWorkbenchMode('checkout');
    }
  };
  const startFresh = () => {
    const confirmed = window.confirm(
      'Start fresh? This clears the product, prompt, artwork, cart, and prices saved in this browser.'
    );
    if (!confirmed) return;
    startingFresh.current = true;
    artwork.cancelGeneration();
    studioQuote.cancel();
    clearStudioResumeState();
    cart.clear();
    studioCheckout.clearPendingCartCheckout();
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
    busy: {
      ...busy,
      ...artwork.busy,
      mockup: mockupBusy,
      quoting: quoteBusy,
      ...studioCheckout.busy,
    },
    errors: {
      ...errors,
      generation: artwork.error,
      mockup: mockupError,
      quote: quoteError,
      ...studioCheckout.errors,
    },
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
    buyStudioPass: studioCheckout.buyStudioPass,
    createCheckout: studioCheckout.createCheckout,
    buyAgain: studioCheckout.buyAgain,
    addCurrentDesignToCart,
    boot,
    navigate,
    acceptConfirmedOrder: studioCheckout.acceptConfirmedOrder,
    startFresh,
    continueFromConfigure: () => setWorkbenchMode(design ? 'review' : 'describe'),
    showProduct: () => setWorkbenchMode('product'),
    showConfigure: () => setWorkbenchMode('configure'),
    showDescribe: () => setWorkbenchMode('describe'),
    showReview: () => setWorkbenchMode('review'),
    showCart: () => setWorkbenchMode('cart'),
    showCheckout: () => {
      studioCheckout.setSource('design');
      setWorkbenchMode('checkout');
    },
    showCartCheckout: () => {
      studioCheckout.setSource('cart');
      setWorkbenchMode('checkout');
    },
    showCheckoutBack: () => setWorkbenchMode(checkoutSource === 'cart' ? 'cart' : 'review'),
    dismissRecovery: () => setRecoveryMessage(''),
    dismissFallback: () => setFallback(null),
    clearError,
  };
}
