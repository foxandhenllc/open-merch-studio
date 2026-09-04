import type {
  DesignDraft,
  DesignIdea,
  DesignMockup,
  OrderSummary,
  QuoteBreakdown,
} from '../types/catalog.js';

/**
 * Ephemeral artifact storage used by fixture mode and as a best-effort cache in
 * live mode. Nothing in this module is a durable commerce record; production
 * orders and provider state are owned by their repository services.
 */
const artifacts = {
  ideas: new Map<string, DesignIdea>(),
  drafts: new Map<string, DesignDraft>(),
  mockups: new Map<string, DesignMockup>(),
  quotes: new Map<string, QuoteBreakdown>(),
  orders: new Map<string, OrderSummary>(),
};

export function saveRuntimeIdea(idea: DesignIdea): DesignIdea {
  artifacts.ideas.set(idea.id, idea);
  return { ...idea };
}

export function saveRuntimeDraft(draft: DesignDraft): DesignDraft {
  if (draft.id) artifacts.drafts.set(draft.id, draft);
  return { ...draft };
}

export function getRuntimeDraft(id?: string | null): DesignDraft | undefined {
  return id ? artifacts.drafts.get(id) : undefined;
}

export function saveRuntimeMockup(mockup: DesignMockup): DesignMockup {
  artifacts.mockups.set(mockup.id, mockup);
  return { ...mockup };
}

export function findReusableRuntimeMockup(params: {
  productId: string;
  variantId: string;
  designAssetId?: string;
  placementCodes: string[];
  orientation?: DesignMockup['orientation'];
}): DesignMockup | undefined {
  return Array.from(artifacts.mockups.values())
    .reverse()
    .find(
      (mockup) =>
        mockup.status === 'complete' &&
        mockup.productId === params.productId &&
        mockup.variantId === params.variantId &&
        mockup.designAssetId === params.designAssetId &&
        mockup.orientation === params.orientation &&
        mockup.placementCodes.join('|') === params.placementCodes.join('|')
    );
}

export function saveRuntimeQuote(
  quote: QuoteBreakdown,
  createId: (prefix: string) => string
): QuoteBreakdown {
  const id = quote.id || createId('quote');
  const saved = { ...quote, id };
  artifacts.quotes.set(id, saved);
  return { ...saved };
}

export function getRuntimeQuote(id?: string | null): QuoteBreakdown | undefined {
  return id ? artifacts.quotes.get(id) : undefined;
}

export function saveRuntimeOrder(order: OrderSummary): OrderSummary {
  artifacts.orders.set(order.id, order);
  return { ...order };
}

export function getRuntimeOrder(id: string): OrderSummary | undefined {
  return artifacts.orders.get(id);
}

export function listRuntimeOrders(): OrderSummary[] {
  return Array.from(artifacts.orders.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/** Supplies aggregate diagnostics without exposing mutable map instances. */
export function getRuntimeArtifactCounts(): { designDrafts: number; orders: number } {
  return {
    designDrafts: artifacts.drafts.size,
    orders: artifacts.orders.size,
  };
}
