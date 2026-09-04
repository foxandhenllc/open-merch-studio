import type {
  CheckoutSession,
  CustomerOrderConfirmation,
  DesignDraft,
  QuoteBreakdown,
} from './types/catalog';
import type { SurfaceError } from './studio-view-model.types';

export type CheckoutRequest = {
  quote: QuoteBreakdown;
  quoteId?: string | null;
  sessionId?: string;
  studioPassId?: string;
  email?: string;
  designAssetId?: string;
  policyAccepted: true;
  policyVersion: string;
};

export type CheckoutOutcome =
  | { kind: 'redirect'; checkoutUrl: string }
  | { kind: 'inline-order'; order: CustomerOrderConfirmation }
  | { kind: 'lookup-order'; orderId: string; accessToken?: string }
  | { kind: 'pending' };

export function prepareCheckoutRequest(params: {
  quote: QuoteBreakdown;
  sessionId?: string;
  studioPassId?: string;
  email: string;
  design: DesignDraft | null;
  policyAccepted: true;
  policyVersion: string;
}): CheckoutRequest {
  return {
    quote: params.quote,
    quoteId: params.quote.id,
    sessionId: params.sessionId,
    studioPassId: params.studioPassId,
    email: params.email || undefined,
    designAssetId: params.design?.id ?? undefined,
    policyAccepted: params.policyAccepted,
    policyVersion: params.policyVersion,
  };
}

export function checkoutNotReadyError(blocker: string): SurfaceError {
  return {
    cause: 'checkout_not_ready',
    title: 'Checkout needs one more step',
    message: blocker,
    recovery: 'Your artwork and estimate are saved.',
    retryable: false,
  };
}

export function checkoutUnavailable(quoteId?: string | null): CheckoutSession {
  return {
    id: 'checkout-disabled',
    mode: 'stripe-ready',
    status: 'blocked',
    checkoutUrl: null,
    quoteId,
    message: 'Checkout opens soon. Your design and quote stay in this session.',
  };
}

export function classifyCheckoutResult(result: CheckoutSession): CheckoutOutcome {
  // An open hosted session always wins: an order identifier is not proof of payment or fulfillment.
  if (result.status === 'open' && result.checkoutUrl) {
    return { kind: 'redirect', checkoutUrl: result.checkoutUrl };
  }

  const inlineOrder = (result as CheckoutSession & { order?: CustomerOrderConfirmation }).order;
  if (inlineOrder) return { kind: 'inline-order', order: inlineOrder };
  if (result.orderId) {
    const accessToken =
      result.orderAccess?.orderId === result.orderId ? result.orderAccess.token : undefined;
    return {
      kind: 'lookup-order',
      orderId: result.orderId,
      ...(accessToken ? { accessToken } : {}),
    };
  }
  return { kind: 'pending' };
}

export function orderDetailsPendingError(error: unknown): SurfaceError {
  return {
    cause: 'details_pending',
    title: 'Order received; details are still loading',
    message: error instanceof Error ? error.message : 'Order details are pending.',
    recovery: 'Retry the order lookup. Do not submit payment again.',
    retryable: true,
  };
}
