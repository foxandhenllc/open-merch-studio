import type Stripe from 'stripe';
import type { AdminOrderListItem, OperatorReviewStatus, OrderSummary } from '../types/catalog.js';

export type StripeRefundState = {
  state: 'unrefunded' | 'partial' | 'full' | 'unavailable';
  refundedCents: number;
};

export function stripeChargeRefundState(
  charge: Pick<Stripe.Charge, 'amount' | 'amount_refunded' | 'refunded'>
): StripeRefundState {
  const refundedCents = Math.max(0, charge.amount_refunded ?? 0);
  if (charge.refunded || (charge.amount > 0 && refundedCents >= charge.amount)) {
    return { state: 'full', refundedCents };
  }
  if (refundedCents > 0) return { state: 'partial', refundedCents };
  return { state: 'unrefunded', refundedCents: 0 };
}

export function stripeEventStatusIsTerminal(status?: string | null): boolean {
  return Boolean(status && !['processing', 'retrying'].includes(status));
}

export const persistedOrderStatus = (status: OrderSummary['status']) => {
  if (status === 'checkout_pending') return 'PENDING_PAYMENT';
  if (status === 'paid') return 'PAID';
  if (status === 'fulfillment_validating') return 'FULFILLMENT_VALIDATING';
  if (status === 'needs_review') return 'NEEDS_REVIEW';
  if (status === 'failed') return 'FAILED';
  if (status === 'submitted') return 'SUBMITTED';
  if (status === 'in_production') return 'IN_PRODUCTION';
  if (status === 'shipped') return 'SHIPPED';
  if (status === 'delivered') return 'DELIVERED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'refunded') return 'REFUNDED';
  if (status === 'quoted') return 'QUOTED';
  return 'DRAFT';
};

export function restoreRuntimeOrderStatus(
  status: string,
  fulfillmentStatus?: string | null
): OrderSummary['status'] {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'checkout_pending';
    case 'PAID':
      if (fulfillmentStatus === 'failed') return 'failed';
      if (fulfillmentStatus === 'needs_review') return 'needs_review';
      return 'paid';
    case 'FULFILLMENT_VALIDATING':
      return 'fulfillment_validating';
    case 'NEEDS_REVIEW':
      return 'needs_review';
    case 'FAILED':
      return 'failed';
    case 'SUBMITTED':
      return 'submitted';
    case 'IN_PRODUCTION':
      return 'in_production';
    case 'SHIPPED':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    case 'REFUNDED':
      return 'refunded';
    case 'QUOTED':
      return 'quoted';
    case 'DRAFT':
    default:
      return 'draft';
  }
}

export function runtimeFulfillmentStatus(
  status: string | null | undefined
): OrderSummary['fulfillment']['status'] {
  switch (status) {
    case 'validated':
    case 'submitted':
    case 'failed':
    case 'needs_review':
      return status;
    default:
      return 'not_submitted';
  }
}

export function stripeEventClaimDecision(
  status: string,
  updatedAt: Date,
  now = Date.now()
): 'duplicate' | 'busy' | 'reclaim' {
  if (!['processing', 'retrying'].includes(status)) return 'duplicate';
  return updatedAt.getTime() < now - 2 * 60 * 1000 ? 'reclaim' : 'busy';
}

export type AdminOrderFilters = {
  status?: OrderSummary['status'];
  fulfillmentStatus?: OrderSummary['fulfillment']['status'];
  attention?: 'failed' | 'needs_review' | 'missing_printful';
  reviewStatus?: OperatorReviewStatus;
  limit?: number;
};

export type PrintfulRetryEligibility = {
  paidAt?: Date | string | null;
  stripeSessionId?: string | null;
  refundedCents?: number | null;
  status: string;
};

export function printfulRetryBlocker(
  order: PrintfulRetryEligibility
): { message: string; errorCode: string } | null {
  if (!order.paidAt || !order.stripeSessionId) {
    return {
      message: 'Only a durably paid Stripe order can be retried.',
      errorCode: 'paid_order_required',
    };
  }
  if ((order.refundedCents ?? 0) > 0) {
    return {
      message: 'Refunded payments require operator review and cannot be submitted to Printful.',
      errorCode: 'payment_refunded',
    };
  }
  if (!['PAID', 'FAILED', 'NEEDS_REVIEW'].includes(order.status)) {
    return {
      message: 'This order state cannot be submitted to Printful.',
      errorCode: 'order_not_fulfillable',
    };
  }
  return null;
}

export function normalizeOperatorReviewStatus(value: string): OperatorReviewStatus {
  return value === 'acknowledged' || value === 'resolved' ? value : 'unreviewed';
}

export function filterAdminOrderItems(
  items: AdminOrderListItem[],
  filters: AdminOrderFilters
): AdminOrderListItem[] {
  const filtered = items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.fulfillmentStatus && item.fulfillmentStatus !== filters.fulfillmentStatus)
      return false;
    if (filters.reviewStatus && item.operatorReviewStatus !== filters.reviewStatus) return false;
    if (filters.attention === 'failed' && item.status !== 'failed') return false;
    if (filters.attention === 'needs_review' && item.status !== 'needs_review') return false;
    if (
      filters.attention === 'missing_printful' &&
      (!item.paidAt ||
        item.printfulOrderId ||
        item.status === 'refunded' ||
        item.status === 'cancelled')
    ) {
      return false;
    }
    return true;
  });
  return filtered.slice(0, Math.min(Math.max(filters.limit ?? 50, 1), 100));
}
