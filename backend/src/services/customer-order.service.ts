import type {
  CheckoutConfirmation,
  CustomerOrderConfirmation,
  CustomerOrderStatus,
  OrderSummary,
} from '../types/catalog.js';

export type InternalCheckoutConfirmation = {
  state: CheckoutConfirmation['state'];
  message: string;
  order?: OrderSummary;
};

const customerStatus = (status: OrderSummary['status']): CustomerOrderStatus => {
  switch (status) {
    case 'draft':
    case 'quoted':
      return 'preparing';
    case 'checkout_pending':
      return 'awaiting_payment';
    case 'paid':
    case 'submitted':
      return 'received';
    case 'fulfillment_validating':
    case 'needs_review':
      return 'under_review';
    case 'failed':
      return 'action_needed';
    case 'in_production':
      return 'in_production';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
  }
};

const customerMessage = (status: CustomerOrderStatus): string => {
  switch (status) {
    case 'preparing':
      return 'Your order details are being prepared.';
    case 'awaiting_payment':
      return 'Secure checkout is awaiting payment.';
    case 'received':
      return 'Payment was received. Your order will be reviewed before production.';
    case 'under_review':
      return 'Your order is receiving an additional review. We will contact you if anything is needed.';
    case 'action_needed':
      return 'Your order needs support review. Contact support with your order number for help.';
    case 'in_production':
      return 'Your item is being made.';
    case 'shipped':
      return 'Your order has shipped.';
    case 'delivered':
      return 'Your order was marked delivered.';
    case 'cancelled':
      return 'This order was cancelled.';
    case 'refunded':
      return 'A refund was recorded for this order.';
  }
};

const customerTimelineEvent = (
  event: OrderSummary['timeline'][number]
): CustomerOrderConfirmation['timeline'][number] | null => {
  const at = event.at;
  switch (event.status) {
    case 'checkout_pending':
      return { at, status: 'awaiting_payment', note: 'Secure checkout was started.' };
    case 'paid':
      return { at, status: 'received', note: 'Payment was received.' };
    case 'fulfillment_validating':
      return { at, status: 'under_review', note: 'Your order entered production review.' };
    case 'needs_review':
      return {
        at,
        status: 'under_review',
        note: 'Your order is receiving an additional review.',
      };
    case 'failed':
      return {
        at,
        status: 'action_needed',
        note: 'Your order needs support review.',
      };
    case 'submitted':
      return { at, status: 'received', note: 'Your order details were prepared for review.' };
    case 'in_production':
      return { at, status: 'in_production', note: 'Your item entered production.' };
    case 'shipped':
      return { at, status: 'shipped', note: 'Your order shipped.' };
    case 'delivered':
      return { at, status: 'delivered', note: 'Your order was marked delivered.' };
    case 'cancelled':
      return { at, status: 'cancelled', note: 'This order was cancelled.' };
    case 'refunded':
      return { at, status: 'refunded', note: 'A refund was recorded for this order.' };
    default:
      return null;
  }
};

export function customerSafeTimeline(
  order: Pick<OrderSummary, 'timeline' | 'status' | 'createdAt'>
): CustomerOrderConfirmation['timeline'] {
  const timeline: CustomerOrderConfirmation['timeline'] = [];
  for (const event of order.timeline) {
    const mapped = customerTimelineEvent(event);
    if (!mapped) continue;
    const previous = timeline.at(-1);
    if (previous?.status === mapped.status && previous.note === mapped.note) continue;
    timeline.push(mapped);
  }
  if (timeline.length) return timeline;
  const status = customerStatus(order.status);
  return [{ at: order.createdAt, status, note: customerMessage(status) }];
}

export function toCustomerOrderConfirmation(
  order: OrderSummary,
  supportEmail: string
): CustomerOrderConfirmation {
  const status = customerStatus(order.status);
  const message = customerMessage(status);
  return {
    orderNumber: order.orderNumber,
    status,
    message,
    totalCents: order.totalCents,
    taxCents: order.taxCents,
    refundedCents: order.refundedCents || undefined,
    paidAt: order.paidAt,
    currency: order.currency,
    items:
      order.quote?.items.map((item) => ({
        title: item.title,
        variantName: item.variantName,
        quantity: item.quantity,
      })) ?? [],
    fulfillment: {
      provider: order.fulfillment.provider === 'fixture' ? 'fixture' : 'production',
      status,
      message,
    },
    timeline: customerSafeTimeline(order),
    support: { email: supportEmail },
    createdAt: order.createdAt,
  };
}

const checkoutStateForOrder = (
  fallback: CheckoutConfirmation['state'],
  status?: OrderSummary['status']
): CheckoutConfirmation['state'] => {
  if (!status) return fallback;
  if (status === 'checkout_pending' || status === 'draft' || status === 'quoted')
    return 'processing';
  if (status === 'needs_review') return 'needs_review';
  if (status === 'failed' || status === 'cancelled' || status === 'refunded') return 'failed';
  return 'paid';
};

const checkoutMessage = (state: CheckoutConfirmation['state'], order?: OrderSummary): string => {
  if (state === 'processing') {
    return 'Payment confirmation is still processing. Do not submit another payment.';
  }
  if (state === 'paid') {
    return 'Payment received. Your order will be reviewed before production.';
  }
  if (state === 'needs_review') {
    return 'Payment received. Your order is under additional review. We will contact you if anything is needed.';
  }
  if (order?.status === 'cancelled') return 'Checkout closed without a completed payment.';
  if (order?.status === 'refunded') return 'A refund update is available for your order.';
  return 'Your order needs support review. Contact support with your order number for help.';
};

export function toCustomerCheckoutConfirmation(
  confirmation: InternalCheckoutConfirmation,
  supportEmail: string
): CheckoutConfirmation {
  const state = checkoutStateForOrder(confirmation.state, confirmation.order?.status);
  return {
    state,
    message: checkoutMessage(state, confirmation.order),
    order: confirmation.order
      ? toCustomerOrderConfirmation(confirmation.order, supportEmail)
      : undefined,
  };
}
