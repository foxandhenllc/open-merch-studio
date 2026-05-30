import type {
  AdminReport,
  CatalogCategory,
  CatalogProduct,
  CheckoutSession,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  OrderSummary,
  QuoteBreakdown,
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
  getLocalOrder,
  localAdminReport,
  localCategories,
  localProductsForCategory,
} from './local-fixtures';
import { publicConfig } from '../config';

const API_BASE = import.meta.env.VITE_API_URL || '';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload.data;
}

function withFallback<T>(requestPromise: Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  return requestPromise.catch((error) => {
    if (!publicConfig.enableLocalFallbacks) {
      throw error;
    }
    return fallback();
  });
}

export const api = {
  categories: () =>
    withFallback(request<CatalogCategory[]>('/api/catalog/categories'), () => localCategories),
  products: (category?: string) => {
    const search = category ? `?category=${encodeURIComponent(category)}` : '';
    return withFallback(
      request<CatalogProduct[]>(`/api/catalog/products${search}`),
      () => localProductsForCategory(category)
    );
  },
  quote: (body: {
    sessionId?: string;
    studioPassId?: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      placementCodes: string[];
      designAssetId?: string;
    }>;
  }) =>
    withFallback(
      request<QuoteBreakdown>('/api/catalog/quotes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalQuote(body.items, body.studioPassId)
    ),
  session: (sessionId?: string) =>
    withFallback(
      request<StudioSession>('/api/design/sessions', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
      () => createLocalSession()
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
  designDraft: (body: {
    prompt: string;
    sessionId?: string;
    productId?: string;
    variantId?: string;
    placementCodes?: string[];
    qualityTier?: 'rough' | 'final';
  }) =>
    withFallback(
      request<DesignDraft>('/api/design/drafts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalDesignDraft(body.prompt, body.sessionId)
    ),
  reviseDraft: (body: { draftId: string; instructions: string; sessionId?: string }) =>
    withFallback(
      request<DesignDraft>(`/api/design/drafts/${encodeURIComponent(body.draftId)}/revisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      () => createLocalDesignDraft(`${body.instructions}`, body.sessionId)
    ),
  mockup: (body: {
    sessionId?: string;
    productId: string;
    variantId: string;
    placementCodes: string[];
    designAssetId?: string;
    imageUrl?: string;
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
  order: (orderId: string) =>
    withFallback(request<OrderSummary>(`/api/orders/${encodeURIComponent(orderId)}`), () => {
      const order = getLocalOrder();
      if (!order) throw new Error('Order not found.');
      return order;
    }),
  adminReport: (): Promise<AdminReport> =>
    withFallback(request<AdminReport>('/api/admin/report'), () => localAdminReport),
};
