import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type DataSource, type Sourced } from '@services/api';
import { canUseCustomerCheckout, publicConfig } from './config';
import type {
  AdminReport,
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  CheckoutSession,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  OrderSummary,
  PlacementOption,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';
import type { StepState, StudioStep } from '@components/StepRail.types';

export type FlowState =
  | 'booting'
  | 'boot_failed'
  | 'configuring'
  | 'refining'
  | 'generating'
  | 'drafted'
  | 'previewing'
  | 'quoted'
  | 'quote_stale'
  | 'quote_expired'
  | 'ordering'
  | 'redirecting'
  | 'confirmed';
export type ActionKey =
  | 'catalog'
  | 'refining'
  | 'generating'
  | 'revising'
  | 'mockup'
  | 'quoting'
  | 'pass'
  | 'checkout';
export type Surface = 'boot' | 'catalog' | 'generation' | 'mockup' | 'quote' | 'checkout' | 'order';
export type SurfaceError = {
  cause: string;
  title: string;
  message: string;
  recovery: string;
  retryable: boolean;
};

const firstVariant = (product: CatalogProduct): CatalogVariant | null =>
  product.variants.find((variant) => variant.isAvailable) ?? product.variants[0] ?? null;
const firstPlacement = (product: CatalogProduct): PlacementOption | null =>
  product.placements.find((placement) => placement.isDefault) ?? product.placements[0] ?? null;
const emptyBusy: Record<ActionKey, boolean> = {
  catalog: false,
  refining: false,
  generating: false,
  revising: false,
  mockup: false,
  quoting: false,
  pass: false,
  checkout: false,
};

function mapError(error: unknown, surface: Surface): SurfaceError {
  const message = error instanceof Error ? error.message : 'The request could not be completed.';
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  const normalized = `${code || ''} ${message}`.toLowerCase();
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
      recovery: 'Retry with the same prompt. A failed request does not consume a draft credit.',
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
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [session, setSession] = useState<StudioSession | null>(null);
  const [studioPass, setStudioPass] = useState<StudioPass | null>(null);
  const [adminReport, setAdminReport] = useState<AdminReport | null>(null);
  const [selectedCategory, setSelectedCategoryState] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantIdState] = useState('');
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [revision, setRevision] = useState('Make it bolder and easier to read at small sizes');
  const [email, setEmail] = useState('');
  const [idea, setIdea] = useState<DesignIdea | null>(null);
  const [design, setDesign] = useState<DesignDraft | null>(null);
  const [mockup, setMockup] = useState<DesignMockup | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [busy, setBusy] = useState(emptyBusy);
  const [errors, setErrors] = useState<Partial<Record<Surface, SurfaceError>>>({});
  const [fallback, setFallback] = useState<{ visible: boolean; reason: string } | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('live');
  const [mockupStale, setMockupStale] = useState(false);
  const [quoteStale, setQuoteStale] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('Queued');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const generationController = useRef<AbortController | null>(null);
  const mockupRequestId = useRef(0);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );
  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedProduct, selectedVariantId]
  );
  const quoteExpired = Boolean(quote && new Date(quote.expiresAt).getTime() <= Date.now());

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
    setErrors((current) => ({ ...current, [surface]: mapError(error, surface) }));

  const boot = useCallback(async () => {
    setFlow('booting');
    clearError('boot');
    try {
      const [categoryResult, productResult, sessionResult, reportResult] = await Promise.all([
        api.categories(),
        api.products(),
        api.session(),
        publicConfig.isProductionMode ? Promise.resolve(null) : api.adminReport(),
      ]);
      setCategories(consumeSource(categoryResult));
      setProducts(consumeSource(productResult));
      const nextSession = consumeSource(sessionResult);
      setSession(nextSession);
      setStudioPass(nextSession.studioPass ?? null);
      if (reportResult) setAdminReport(reportResult.data);
      setFlow('configuring');
    } catch (error) {
      fail('boot', error);
      setFlow('boot_failed');
    }
  }, [consumeSource]);

  useEffect(() => {
    void boot();
  }, [boot]);
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
      setProducts(consumeSource(await api.products(category || undefined)));
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
  }) => {
    if (!params.draft.id || params.draft.readiness.status === 'blocked') return;
    const requestId = ++mockupRequestId.current;
    setAction('mockup', true);
    setFlow('previewing');
    setOperationStartedAt(Date.now());
    clearError('mockup');
    try {
      const result = consumeSource(
        await api.mockup({
          sessionId: session?.id,
          productId: params.product.id,
          variantId: params.variant.id,
          placementCodes: params.placements,
          designAssetId: params.draft.id,
          imageUrl: params.draft.imageUrl,
        })
      );
      if (requestId !== mockupRequestId.current) return;
      setMockup(result);
      setMockupStale(false);
      if (result.status === 'failed') {
        fail(
          'mockup',
          new Error(result.errorMessage || 'The fulfillment provider could not build this mockup.')
        );
        setFlow(quote ? 'quote_stale' : 'drafted');
      } else {
        setFlow(quote ? 'quote_stale' : 'drafted');
        setAnnouncement('Product mockup ready. You can refine the design or calculate the price.');
      }
    } catch (error) {
      if (requestId !== mockupRequestId.current) return;
      fail('mockup', error);
      setFlow(quote ? 'quote_stale' : 'drafted');
    } finally {
      if (requestId === mockupRequestId.current) {
        setAction('mockup', false);
        setOperationStartedAt(null);
      }
    }
  };
  const markStale = () => {
    if (mockup) setMockupStale(true);
    if (quote) setQuoteStale(true);
    if (quote) setFlow('quote_stale');
    else setFlow(design ? 'drafted' : 'configuring');
    setCheckout(null);
    setOrder(null);
  };
  const selectProduct = (product: CatalogProduct) => {
    const variant = firstVariant(product);
    const placement = firstPlacement(product);
    setSelectedProductId(product.id);
    setSelectedVariantIdState(variant?.id ?? '');
    setSelectedPlacements(placement ? [placement.code] : []);
    markStale();
    if (design && variant && placement) {
      setAnnouncement(`${product.title} selected. Updating the product mockup.`);
      void requestMockup({ product, variant, placements: [placement.code], draft: design });
    } else {
      setAnnouncement(`${product.title} selected. Next: describe your design.`);
    }
  };
  const setSelectedVariantId = (id: string) => {
    setSelectedVariantIdState(id);
    markStale();
    const variant = selectedProduct?.variants.find((candidate) => candidate.id === id);
    if (design && selectedProduct && variant) {
      void requestMockup({
        product: selectedProduct,
        variant,
        placements: selectedPlacements,
        draft: design,
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
    setSelectedPlacements(next);
    markStale();
    if (design && selectedProduct && selectedVariant) {
      void requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: next,
        draft: design,
      });
    }
  };

  const refineIdea = async () => {
    if (!prompt.trim()) return;
    setFlow('refining');
    setAction('refining', true);
    clearError('generation');
    try {
      setIdea(
        consumeSource(
          await api.designIdea({
            prompt,
            sessionId: session?.id,
            productId: selectedProduct?.id,
            placementCodes: selectedPlacements,
          })
        )
      );
      setFlow('configuring');
      setAnnouncement('Prompt refined. Review it, then generate your draft.');
    } catch (error) {
      fail('generation', error);
      setFlow('configuring');
    } finally {
      setAction('refining', false);
    }
  };
  const generate = async () => {
    if (!selectedProduct || !selectedVariant || !prompt.trim()) return;
    const controller = new AbortController();
    generationController.current = controller;
    setAction('generating', true);
    setFlow('generating');
    setGenerationPhase('Queued');
    setOperationStartedAt(Date.now());
    clearError('generation');
    const phaseOne = window.setTimeout(() => setGenerationPhase('Generating artwork'), 1000);
    const phaseTwo = window.setTimeout(() => setGenerationPhase('Preparing the print file'), 10000);
    try {
      const [result] = await Promise.all([
        api.designDraft(
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
      const draft = consumeSource(result);
      if (draft.policy.status === 'blocked')
        throw new ApiError(
          draft.policy.reasons[0] || 'The prompt was blocked by content policy.',
          400,
          'policy_blocked'
        );
      setDesign(draft);
      setMockup(null);
      setQuote(null);
      setMockupStale(false);
      setQuoteStale(false);
      setFlow('drafted');
      setAnnouncement('Artwork ready. Building your product mockup now.');
      setAction('generating', false);
      setOperationStartedAt(null);
      await requestMockup({
        product: selectedProduct,
        variant: selectedVariant,
        placements: selectedPlacements,
        draft,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setFlow('configuring');
        setAnnouncement(
          'Generation cancelled. Your prompt is unchanged and no draft credit was used.'
        );
      } else {
        fail('generation', error);
        setFlow('configuring');
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
    setAction('revising', true);
    clearError('generation');
    try {
      const revised = consumeSource(
        await api.reviseDraft({
          draftId: design.id,
          instructions: revision,
          sessionId: session?.id,
        })
      );
      setDesign(revised);
      setMockup(null);
      setMockupStale(false);
      setQuoteStale(Boolean(quote));
      setFlow('drafted');
      setAnnouncement('Edit applied. Rebuilding your product mockup.');
      if (selectedProduct && selectedVariant) {
        await requestMockup({
          product: selectedProduct,
          variant: selectedVariant,
          placements: selectedPlacements,
          draft: revised,
        });
      }
    } catch (error) {
      fail('generation', error);
    } finally {
      setAction('revising', false);
    }
  };
  const createMockup = async () => {
    if (!selectedProduct || !selectedVariant || !design) return;
    await requestMockup({
      product: selectedProduct,
      variant: selectedVariant,
      placements: selectedPlacements,
      draft: design,
    });
  };
  const createQuote = async () => {
    if (!selectedProduct || !selectedVariant) return;
    setAction('quoting', true);
    clearError('quote');
    try {
      const result = consumeSource(
        await api.quote({
          sessionId: session?.id,
          studioPassId: studioPass?.id,
          items: [
            {
              productId: selectedProduct.id,
              variantId: selectedVariant.id,
              quantity: 1,
              placementCodes: selectedPlacements,
              designAssetId: design?.id ?? undefined,
            },
          ],
        })
      );
      setQuote(result);
      setQuoteStale(false);
      setFlow('quoted');
      setAnnouncement(
        `Price updated: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: result.currency }).format(result.totalCents / 100)}.`
      );
    } catch (error) {
      fail('quote', error);
    } finally {
      setAction('quoting', false);
    }
  };
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
        'Studio Pass activated for this session. Refresh the price to apply its credit.'
      );
    } catch (error) {
      fail('checkout', error);
    } finally {
      setAction('pass', false);
    }
  };
  const createCheckout = async () => {
    if (!quote) return;
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
        })
      );
      setCheckout(result);
      if (result.status === 'open' && result.checkoutUrl) {
        setFlow('redirecting');
        setAnnouncement('Checkout ready. Redirecting to secure payment.');
        window.location.assign(result.checkoutUrl);
        return;
      }
      const inlineOrder = (result as CheckoutSession & { order?: OrderSummary }).order;
      if (inlineOrder) {
        setOrder(inlineOrder);
        setFlow('confirmed');
        setAnnouncement(`Order ${inlineOrder.orderNumber} confirmed.`);
      } else if (result.orderId) {
        try {
          const nextOrder = consumeSource(await api.order(result.orderId));
          setOrder(nextOrder);
          setFlow('confirmed');
          setAnnouncement(`Order ${nextOrder.orderNumber} confirmed.`);
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

  const stepStates = useMemo<Record<StudioStep, StepState>>(
    () => ({
      product: selectedProduct ? 'done' : 'active',
      make:
        flow === 'generating' ||
        flow === 'refining' ||
        flow === 'previewing' ||
        mockup?.status === 'failed' ||
        (!design && selectedProduct)
          ? 'active'
          : design && mockup?.status === 'complete' && !mockupStale
            ? 'done'
            : design
              ? 'active'
              : 'todo',
      price:
        quoteStale || flow === 'quote_stale' || flow === 'quote_expired'
          ? 'stale'
          : quote
            ? flow === 'quoted'
              ? 'active'
              : 'done'
            : design
              ? 'todo'
              : 'todo',
      order: order || flow === 'confirmed' ? 'active' : quote ? 'todo' : 'todo',
    }),
    [selectedProduct, design, mockup, quote, order, flow, mockupStale, quoteStale]
  );
  const navigate = (step: StudioStep) =>
    document.getElementById(`step-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return {
    flow,
    categories,
    products,
    session,
    studioPass,
    adminReport,
    selectedCategory,
    selectedProduct,
    selectedVariant,
    selectedProductId,
    selectedVariantId,
    selectedPlacements,
    prompt,
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
    online,
    quoteExpired,
    stepStates,
    setPrompt,
    setRevision,
    setEmail,
    setSelectedCategory,
    selectProduct,
    setSelectedVariantId,
    togglePlacement,
    refineIdea,
    generate,
    cancelGeneration,
    reviseDraft,
    createMockup,
    createQuote,
    buyStudioPass,
    createCheckout,
    boot,
    navigate,
    dismissFallback: () => setFallback(null),
    clearError,
  };
}
