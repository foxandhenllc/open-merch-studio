import type { CatalogCategory, CatalogProduct, DesignDraft, QuoteBreakdown } from '@app-types/catalog';
import {
  createLocalDesignDraft,
  createLocalQuote,
  localCategories,
  localProductsForCategory,
} from './local-fixtures';

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

export const api = {
  categories: () =>
    request<CatalogCategory[]>('/api/catalog/categories').catch(() => localCategories),
  products: (category?: string) => {
    const search = category ? `?category=${encodeURIComponent(category)}` : '';
    return request<CatalogProduct[]>(`/api/catalog/products${search}`).catch(() =>
      localProductsForCategory(category)
    );
  },
  quote: (body: {
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      placementCodes: string[];
      designAssetId?: string;
    }>;
  }) =>
    request<QuoteBreakdown>('/api/catalog/quotes', {
      method: 'POST',
      body: JSON.stringify(body),
    }).catch(() => createLocalQuote(body.items)),
  designDraft: (prompt: string) =>
    request<DesignDraft>('/api/design/drafts', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }).catch(() => createLocalDesignDraft(prompt)),
};
