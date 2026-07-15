import type {
  CatalogCategory,
  CatalogProduct,
  CheckoutSession,
  CheckoutConfirmation,
  CustomerOrderConfirmation,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  QuoteBreakdown,
  StudioCapabilities,
  StudioSession,
} from '@app-types/catalog';
import {
  createLocalCheckout,
  createLocalDesignDraft,
  createLocalDesignIdea,
  createLocalMockup,
  createLocalQuote,
  createLocalSession,
  createLocalStudioPass,
  getLocalCustomerOrder,
  localCategories,
  localProductsForCategory,
} from './local-fixtures';
import { publicConfig } from '../config';

const API_BASE = import.meta.env.VITE_API_URL || '';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
  errorCode?: string;
};

export type DataSource = 'live' | 'fixture';

export type Sourced<T> = {
  data: T;
  source: DataSource;
  fallbackReason?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
    signal: signal ?? init?.signal,
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.error || `Request failed: ${response.status}`,
      response.status,
      payload.errorCode
    );
  }
  return payload.data;
}

async function withFallback<T>(
  requestPromise: Promise<T>,
  fallback: () => T | Promise<T>
): Promise<Sourced<T>> {
  try {
    return { data: await requestPromise, source: 'live' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (!publicConfig.enableLocalFallbacks) throw error;
    return {
      data: await fallback(),
      source: 'fixture',
      fallbackReason: error instanceof Error ? error.message : 'Studio server unreachable.',
    };
  }
}

export const api = {
  capabilities: () =>
    withFallback(
      request<{ capabilities: StudioCapabilities }>('/api/health').then(
        (result) => result.capabilities
      ),
      () => ({ ai: 'demo', checkout: 'demo', fulfillment: 'demo' }) as StudioCapabilities
    ),
  categories: () =>
    withFallback(request<CatalogCategory[]>('/api/catalog/categories'), () => localCategories),
  products: (category?: string) => {
    const search = category ? `?category=${encodeURIComponent(category)}` : '';
    return withFallback(request<CatalogProduct[]>(`/api/catalog/products${search}`), () =>
      localProductsForCategory(category)
    );
  },
  quote: (
    body: {
      sessionId?: string;
      studioPassId?: string;
      items: Array<{
        productId: string;
        variantId: string;
        quantity: number;
        placementCodes: string[];
        orientation?: 'portrait' | 'landscape' | 'square';
        designAssetId?: string;
      }>;
    },
    signal?: AbortSignal
  ) =>
    withFallback(
      request<QuoteBreakdown>(
        '/api/catalog/quotes',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        signal
      ),
      () => createLocalQuote(body.items, body.studioPassId)
    ),
  quoteById: (quoteId: string) =>
    withFallback(
      request<QuoteBreakdown>(`/api/catalog/quotes/${encodeURIComponent(quoteId)}`),
      () => {
        throw new Error('Saved demo estimates are not available after a refresh.');
      }
    ),
  session: (sessionId?: string) =>
    withFallback(
      request<StudioSession>('/api/design/sessions', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
      () => createLocalSession(sessionId)
    ),
  designIdea: (body: {
    prompt: string;
    sessionId?: string;
    productId?: string;
    placementCodes?: string[];
  }) =>
    withFallback(
      request<DesignIdea>('/api/design/ideas', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalDesignIdea(body.prompt, body.sessionId)
    ),
  designDraft: (
    body: {
      prompt: string;
      sessionId?: string;
      productId?: string;
      variantId?: string;
      placementCodes?: string[];
      qualityTier?: 'rough' | 'final';
    },
    signal?: AbortSignal
  ) =>
    withFallback(
      request<DesignDraft>(
        '/api/design/drafts',
        { method: 'POST', body: JSON.stringify(body) },
        signal
      ),
      () => createLocalDesignDraft(body.prompt, body.sessionId)
    ),
  designDraftById: (draftId: string, sessionId?: string) => {
    const search = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return withFallback(
      request<DesignDraft>(`/api/design/drafts/${encodeURIComponent(draftId)}${search}`),
      () => {
        throw new Error('Saved demo artwork is not available after a refresh.');
      }
    );
  },
  reviseDraft: (body: { draftId: string; instructions: string; sessionId?: string }) =>
    withFallback(
      request<DesignDraft>(`/api/design/drafts/${encodeURIComponent(body.draftId)}/revisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalDesignDraft(body.instructions, body.sessionId)
    ),
  mockup: (body: {
    sessionId?: string;
    productId: string;
    variantId: string;
    placementCodes: string[];
    designAssetId?: string;
    imageUrl?: string;
    orientation?: 'portrait' | 'landscape' | 'square';
  }) =>
    withFallback(
      request<DesignMockup>('/api/design/mockups', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalMockup(body)
    ),
  studioPassCheckout: (sessionId: string) =>
    withFallback(
      request<CheckoutSession>('/api/studio-passes/checkout', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
      () => createLocalStudioPass(sessionId)
    ),
  checkout: (body: {
    quote: QuoteBreakdown;
    quoteId?: string | null;
    sessionId?: string;
    studioPassId?: string;
    email?: string;
    designAssetId?: string;
  }) =>
    withFallback(
      request<CheckoutSession>('/api/checkout/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalCheckout(body.quote, body.email)
    ),
  checkoutOrder: (sessionId: string) =>
    withFallback(
      request<CheckoutConfirmation>(
        `/api/checkout/sessions/${encodeURIComponent(sessionId)}/order`
      ),
      () => {
        const order = getLocalCustomerOrder(publicConfig.supportEmail);
        return order
          ? { state: 'paid' as const, message: 'Fixture payment received.', order }
          : { state: 'processing' as const, message: 'Checkout confirmation is still processing.' };
      }
    ),
  order: (orderId: string) =>
    withFallback(
      request<CustomerOrderConfirmation>(`/api/orders/${encodeURIComponent(orderId)}`),
      () => {
        const order = getLocalCustomerOrder(publicConfig.supportEmail);
        if (!order) throw new Error('Order details are still pending.');
        return order;
      }
    ),
};
