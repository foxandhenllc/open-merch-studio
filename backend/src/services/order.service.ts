import { env } from '../config/env.js';
import { getProductBySlug } from './catalog.service.js';
import {
  buildPrintfulOrderPayload,
  classifyPrintfulFailure,
  mapPrintfulOrderStatus,
  submitPrintfulDraftOrder,
} from './printful.service.js';
import {
  createStudioPass,
  getDraft,
  getOrder,
  getRuntimeSettings,
  getStudioPassById,
  getStudioPassForSession,
  runtimeId,
  runtimeNow,
  saveOrder,
} from './runtime-store.js';
import type {
  CheckoutSession,
  AdminOrderDetail,
  OperatorReviewStatus,
  OrderSummary,
  QuoteBreakdown,
} from '../types/catalog.js';
import type { InternalCheckoutConfirmation } from './customer-order.service.js';
import {
  canCreateStripeCheckout,
  createMerchCheckoutSession,
  createStudioPassStripeSession,
  liveStripeBlocker,
  retrieveStripeCharge,
  retrieveStripeCheckoutSession,
  retrieveStripePaymentIntent,
} from './stripe.service.js';
import type Stripe from 'stripe';
import { prisma } from '../config/database.js';
import { resolveDesignAssetProviderUrl } from '../utils/design-asset-url.js';
import { classifyOperationalError, logOperationalEvent } from '../utils/operational-logger.js';
import {
  checkoutPolicyAcceptanceIssue,
  CURRENT_CHECKOUT_POLICY_VERSION,
} from '../config/policies.js';
import {
  checkoutDesignAssetIds,
  checkoutDesignIssue,
  validateQuoteForCheckout,
} from './checkout-validation.service.js';
import type { CheckoutDesignState } from './checkout-validation.service.js';
import { printfulRetryBlocker, stripeChargeRefundState } from './order-state.service.js';
import type { StripeRefundState } from './order-state.service.js';
import {
  getAdminOrderDetail,
  getQuoteById,
  loadFulfillmentRetryRecord,
  loadOrder,
  loadOrderByCheckoutSession,
  loadOrderByPaymentIntent,
  persistOrder,
} from './order-repository.service.js';
import {
  claimStripeEvent,
  persistCheckoutExpired,
  persistOrphanedPaymentAudit,
  persistOrphanedRefundAudit,
  persistStripeRefund,
  persistStudioPassPurchase,
  recordPaymentCompletion,
  stripeRecipient,
} from './stripe-order-repository.service.js';

export {
  filterAdminOrderItems,
  persistedOrderStatus,
  printfulRetryBlocker,
  restoreRuntimeOrderStatus,
  stripeChargeRefundState,
  stripeEventClaimDecision,
  stripeEventStatusIsTerminal,
} from './order-state.service.js';
export type {
  AdminOrderFilters,
  PrintfulRetryEligibility,
  StripeRefundState,
} from './order-state.service.js';
export { validateQuoteForCheckout } from './checkout-validation.service.js';
export {
  getAdminOrderDetail,
  getQuoteById,
  listAdminOrderRecords,
  listOrderSummaries,
} from './order-repository.service.js';
export {
  markStripeEventTracked,
  stripeRecipient,
  wasStripeEventProcessed,
} from './stripe-order-repository.service.js';

type CheckoutInput = {
  quoteId?: string | null;
  sessionId?: string;
  studioPassId?: string;
  email?: string;
  designAssetId?: string;
  policyAccepted: boolean;
  policyVersion: string;
};

export class OrderRecoveryError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode = 409, errorCode = 'order_recovery_blocked') {
    super(message);
    this.name = 'OrderRecoveryError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

async function stripeSessionRefundState(
  session: Stripe.Checkout.Session
): Promise<StripeRefundState> {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  const paymentIntent = paymentIntentId ? await retrieveStripePaymentIntent(paymentIntentId) : null;
  const latestCharge = paymentIntent?.latest_charge;
  const charge =
    typeof latestCharge === 'string' ? await retrieveStripeCharge(latestCharge) : latestCharge;
  return charge ? stripeChargeRefundState(charge) : { state: 'unavailable', refundedCents: 0 };
}

const orderNumber = () =>
  `OMS-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

async function loadDesignForCheckout(
  designAssetId: string
): Promise<CheckoutDesignState | undefined> {
  if (env.databaseUrl) {
    const asset = await prisma.designAsset.findUnique({ where: { id: designAssetId } });
    if (!asset) return undefined;
    return {
      id: asset.id,
      purpose: asset.purpose,
      imageUrl: asset.transparentUrl ?? asset.imageUrl,
      generationStatus: asset.generationStatus,
      policyStatus: asset.policyStatus,
      readinessStatus: asset.readinessStatus,
      readinessReport: asset.readinessReport as CheckoutDesignState['readinessReport'],
    };
  }

  const draft = getDraft(designAssetId);
  if (!draft) return undefined;
  return {
    id: designAssetId,
    purpose: draft.purpose,
    imageUrl: draft.imageUrl,
    generationStatus: draft.id ? 'complete' : 'failed',
    policyStatus: draft.policy.status,
    readinessStatus: draft.readiness.status,
    readinessReport: draft.readiness,
  };
}

function transition(
  order: OrderSummary,
  status: OrderSummary['status'],
  note: string
): OrderSummary {
  return {
    ...order,
    status,
    timeline: [...order.timeline, { at: runtimeNow(), status, note }],
  };
}

async function verifyDurableCheckoutState(
  quote: QuoteBreakdown,
  designAssetIds: string[]
): Promise<string | null> {
  if (!env.databaseUrl || !quote.id) {
    return 'Provider checkout requires a durably stored quote and PostgreSQL connection.';
  }
  try {
    const [savedQuote, designs] = await Promise.all([
      prisma.quote.findUnique({ where: { id: quote.id }, select: { id: true } }),
      prisma.designAsset.findMany({
        where: { id: { in: designAssetIds } },
        select: { id: true, transparentUrl: true, imageUrl: true },
      }),
    ]);
    if (!savedQuote) return 'The saved quote could not be retrieved from PostgreSQL.';
    if (
      designs.length !== designAssetIds.length ||
      designs.some((asset) => !asset.transparentUrl && !asset.imageUrl)
    ) {
      return 'The checkout artwork is not durably stored and retrievable.';
    }
    return null;
  } catch {
    return 'PostgreSQL could not verify the quote and artwork for checkout.';
  }
}

async function paymentCompletionResult(
  order: OrderSummary,
  recorded: boolean
): Promise<OrderSummary> {
  if (recorded) return saveOrder(order);
  return (await loadOrder(order.id)) ?? order;
}

async function fulfillmentOrderIsEligible(orderId: string, stripeSessionId: string) {
  if (!env.databaseUrl) return true;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, refundedCents: true, stripeSessionId: true },
  });
  return Boolean(
    order &&
    order.stripeSessionId === stripeSessionId &&
    order.refundedCents === 0 &&
    !['REFUNDED', 'CANCELLED'].includes(order.status)
  );
}

async function startFulfillmentAttempt(orderId: string): Promise<string | undefined> {
  if (!env.databaseUrl) return undefined;
  const activeAttempt = await prisma.fulfillmentAttempt.findFirst({
    where: { orderId, provider: 'printful', status: 'processing' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  });
  if (activeAttempt && activeAttempt.createdAt.getTime() > Date.now() - 2 * 60 * 1000) {
    throw new OrderRecoveryError(
      'A Printful draft attempt is already in progress.',
      409,
      'fulfillment_attempt_in_progress'
    );
  }
  if (activeAttempt) {
    await prisma.fulfillmentAttempt.updateMany({
      where: { orderId, provider: 'printful', status: 'processing' },
      data: {
        status: 'superseded',
        errorMessage: 'A later reconciliation attempt superseded this incomplete attempt.',
      },
    });
  }
  const attempt = await prisma.fulfillmentAttempt.create({
    data: { orderId, provider: 'printful', status: 'processing', payload: {} },
    select: { id: true },
  });
  return attempt.id;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
  const settings = getRuntimeSettings();
  const quote = await getQuoteById(input.quoteId);
  if (!quote) {
    return {
      id: runtimeId('checkout'),
      mode: settings.liveStripeEnabled ? 'stripe-ready' : 'fixture',
      status: 'blocked',
      checkoutUrl: null,
      quoteId: input.quoteId,
      message: 'Create a fresh quote before checkout.',
    };
  }
  const stripeBlocker = settings.liveStripeEnabled ? liveStripeBlocker(input.email) : null;

  const quoteIssues: string[] = [];
  const policyIssue = checkoutPolicyAcceptanceIssue(input);
  if (policyIssue) quoteIssues.push(policyIssue);
  quoteIssues.push(...(await validateQuoteForCheckout(quote, settings.liveStripeEnabled)));
  if (Date.now() > new Date(quote.expiresAt).getTime()) {
    quoteIssues.push('Quote expired. Create a fresh quote before checkout.');
  }
  const requiredDesignIds = checkoutDesignAssetIds(quote, input.designAssetId);
  if (!requiredDesignIds.length) {
    quoteIssues.push('Checkout requires generated or uploaded artwork.');
  }

  for (const designAssetId of requiredDesignIds) {
    const issue = checkoutDesignIssue(await loadDesignForCheckout(designAssetId));
    if (issue) quoteIssues.push(issue);
  }
  if (settings.liveStripeEnabled && !quoteIssues.length) {
    const durableIssue = await verifyDurableCheckoutState(quote, requiredDesignIds);
    if (durableIssue) quoteIssues.push(durableIssue);
  }

  if (!settings.checkoutEnabled || quoteIssues.length || stripeBlocker) {
    return {
      id: runtimeId('checkout'),
      mode: settings.liveStripeEnabled ? 'stripe-ready' : 'fixture',
      status: 'blocked',
      checkoutUrl: null,
      quoteId: quote.id,
      message:
        quoteIssues[0] ?? stripeBlocker ?? 'Checkout is paused until launch review is complete.',
    };
  }

  const order: OrderSummary = {
    id: runtimeId('order'),
    orderNumber: orderNumber(),
    status: 'checkout_pending',
    customerEmail: input.email,
    totalCents: quote.totalCents,
    taxCents: 0,
    policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
    policyAcceptedAt: runtimeNow(),
    currency: quote.currency,
    quote,
    designAssetId: input.designAssetId ?? requiredDesignIds[0],
    fulfillment: {
      provider: settings.livePrintfulEnabled ? 'printful-ready' : 'fixture',
      status: 'validated',
      message: settings.livePrintfulEnabled
        ? 'Ready for Printful submission after payment confirmation.'
        : 'Fixture fulfillment will simulate submission after checkout.',
    },
    timeline: [
      {
        at: runtimeNow(),
        status: 'checkout_pending',
        note: 'Checkout session created.',
      },
    ],
    createdAt: runtimeNow(),
  };
  saveOrder(order);
  const persisted = await persistOrder(order);
  if (settings.liveStripeEnabled && !persisted) {
    return {
      id: runtimeId('checkout'),
      mode: 'stripe-ready',
      status: 'blocked',
      checkoutUrl: null,
      quoteId: quote.id,
      message: 'Provider checkout was blocked because the order could not be stored durably.',
    };
  }

  const pass =
    getStudioPassById(input.studioPassId) ??
    (input.sessionId ? getStudioPassForSession(input.sessionId) : undefined);
  if (pass && quote.studioPassCreditCents > 0) {
    pass.status = 'applied';
    pass.appliedOrderId = order.id;
  }

  if (settings.liveStripeEnabled && canCreateStripeCheckout(input.email)) {
    const session = await createMerchCheckoutSession({
      orderId: order.id,
      quote,
      customerEmail: input.email,
    });
    saveOrder({ ...order, stripeSessionId: session.id });
    if (!(await persistOrder({ ...order, stripeSessionId: session.id }, session.id))) {
      throw new Error('Stripe session was created, but its durable order link could not be saved.');
    }
    return {
      id: session.id,
      mode: 'stripe',
      status: 'open',
      checkoutUrl: session.url,
      quoteId: quote.id,
      studioPassId: pass?.id,
      orderId: order.id,
      message: 'Stripe Checkout session created. Complete payment securely with Stripe.',
    };
  }

  return {
    id: runtimeId('checkout'),
    mode: settings.liveStripeEnabled && env.enableLiveStripe ? 'stripe-ready' : 'fixture',
    status: settings.liveStripeEnabled && env.enableLiveStripe ? 'open' : 'paid',
    checkoutUrl: settings.liveStripeEnabled && env.enableLiveStripe ? null : `/order/${order.id}`,
    quoteId: quote.id,
    studioPassId: pass?.id,
    orderId: order.id,
    message:
      settings.liveStripeEnabled && env.enableLiveStripe
        ? 'Stripe Checkout is configured but final live URL creation requires private Stripe setup.'
        : 'Fixture checkout completed. No real charge was created.',
  };
}

export async function createStudioPassCheckout(
  sessionId: string,
  email?: string
): Promise<CheckoutSession> {
  if (!env.studioPassEnabled) {
    return {
      id: runtimeId('checkout'),
      mode: 'stripe-ready',
      status: 'blocked',
      checkoutUrl: null,
      message: 'Studio Pass checkout is not available.',
    };
  }
  const settings = getRuntimeSettings();
  const stripeBlocker = settings.liveStripeEnabled ? liveStripeBlocker(email) : null;
  if (settings.liveStripeEnabled && stripeBlocker) {
    return {
      id: runtimeId('checkout'),
      mode: 'stripe-ready',
      status: 'blocked',
      checkoutUrl: null,
      message: stripeBlocker,
    };
  }

  if (settings.liveStripeEnabled && canCreateStripeCheckout(email)) {
    const stripeSession = await createStudioPassStripeSession({
      sessionId,
      amountCents: settings.studioPassPriceCents,
      customerEmail: email,
    });
    return {
      id: stripeSession.id,
      mode: 'stripe',
      status: 'open',
      checkoutUrl: stripeSession.url,
      message: 'Stripe Checkout session created for the Studio Pass.',
    };
  }

  const pass = createStudioPass(sessionId, 'simulated');
  return {
    id: runtimeId('checkout'),
    mode: 'fixture',
    status: 'paid',
    checkoutUrl: '#studio-pass-ready',
    studioPassId: pass.id,
    message: '$5 Studio Pass simulated and ready for this session.',
  };
}

async function getArtworkUrls(order: OrderSummary): Promise<Record<string, string> | null> {
  const assetIds = Array.from(
    new Set(
      (order.quote?.items ?? [])
        .flatMap((item) => [
          item.designAssetId,
          ...item.placements.map((placement) => placement.designAssetId),
        ])
        .filter((assetId): assetId is string => Boolean(assetId))
    )
  );
  if (!assetIds.length && order.designAssetId) assetIds.push(order.designAssetId);
  if (!assetIds.length) return null;
  if (env.databaseUrl) {
    try {
      const assets = await prisma.designAsset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, transparentUrl: true, imageUrl: true },
      });
      const resolved = Object.fromEntries(
        assets.flatMap((asset) => {
          const storedUrl = asset.transparentUrl ?? asset.imageUrl;
          const url = storedUrl
            ? resolveDesignAssetProviderUrl({
                assetId: asset.id,
                storedUrl,
                backendUrl: env.backendUrl,
              })
            : null;
          return url ? [[asset.id, url]] : [];
        })
      );
      return Object.keys(resolved).length === assetIds.length ? resolved : null;
    } catch {
      return null;
    }
  }
  const resolved = Object.fromEntries(
    assetIds.flatMap((assetId) => {
      const draft = getDraft(assetId);
      const url = draft?.imageUrl
        ? resolveDesignAssetProviderUrl({
            assetId,
            storedUrl: draft.imageUrl,
            backendUrl: env.backendUrl,
          })
        : null;
      return url ? [[assetId, url]] : [];
    })
  );
  return Object.keys(resolved).length === assetIds.length ? resolved : null;
}

export class StripeEventBusyError extends Error {
  constructor() {
    super('Stripe event reconciliation is already in progress.');
    this.name = 'StripeEventBusyError';
  }
}

async function recordOrphanedPayment(
  orderId: string,
  stripeEventId: string,
  stripeSessionId: string
): Promise<void> {
  logOperationalEvent('error', 'stripe_payment_orphaned', {
    orderId,
    stripeEventId,
    stripeSessionId,
    failureCode: 'missing_durable_order',
  });
  await persistOrphanedPaymentAudit(orderId, stripeEventId, stripeSessionId);
}

export async function handleStripeCheckoutCompleted(
  session: Stripe.Checkout.Session,
  providerEventId = session.id
): Promise<OrderSummary | undefined> {
  if (session.payment_status !== 'paid') return undefined;
  const kind = session.metadata?.kind;
  if (kind === 'studio_pass') {
    const sessionId = session.metadata?.sessionId;
    if (sessionId) {
      createStudioPass(sessionId, 'purchased');
      await persistStudioPassPurchase(sessionId);
    }
    return undefined;
  }

  if (kind !== 'merch_order') {
    logOperationalEvent('warning', 'stripe_payment_ignored', {
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      outcome: 'unknown_checkout_kind',
    });
    return undefined;
  }
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    logOperationalEvent('error', 'stripe_payment_orphaned', {
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      failureCode: 'missing_order_metadata',
    });
    throw new Error('Paid Stripe session is missing its durable order reference.');
  }
  const order = await loadOrder(orderId);
  if (!order) {
    await recordOrphanedPayment(orderId, providerEventId, session.id);
    throw new Error('Paid Stripe session references a missing durable order.');
  }
  if (order.stripeSessionId && order.stripeSessionId !== session.id) {
    await recordOrphanedPayment(orderId, providerEventId, session.id);
    throw new Error('Paid Stripe session does not match the durable order checkout session.');
  }
  const claim = await claimStripeEvent(orderId, providerEventId, 'checkout.session.completed', {
    id: session.id,
    payment_status: session.payment_status,
    kind,
    orderId,
  });
  if (claim === 'busy') throw new StripeEventBusyError();
  if (claim === 'duplicate') {
    logOperationalEvent('info', 'stripe_webhook_duplicate', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
    });
    return order;
  }
  if (
    order.status !== 'checkout_pending' &&
    order.status !== 'cancelled' &&
    order.stripeSessionId === session.id
  ) {
    const recorded = await recordPaymentCompletion(order, session, providerEventId, {
      eventStatus: 'duplicate',
    });
    logOperationalEvent('info', 'stripe_payment_already_reconciled', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      outcome: order.status,
    });
    return paymentCompletionResult(order, recorded);
  }

  let next = transition(order, 'paid', 'Stripe checkout completed.');
  next = {
    ...next,
    customerEmail: session.customer_details?.email ?? order.customerEmail,
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id,
    totalCents: session.amount_total ?? order.totalCents,
    taxCents: session.total_details?.amount_tax ?? 0,
    paidAt: new Date().toISOString(),
  };

  if (!env.fulfillmentEnabled || !env.enableLivePrintful || !env.allowLiveFulfillment) {
    const message =
      'Payment is complete. Real Printful fulfillment is waiting for operator approval.';
    next = {
      ...next,
      status: 'needs_review',
      fulfillment: {
        ...next.fulfillment,
        status: 'needs_review',
        message,
      },
    };
    next = transition(next, 'needs_review', message);
    const recorded = await recordPaymentCompletion(next, session, providerEventId, {
      failureReason: message,
      eventStatus: 'processed',
    });
    logOperationalEvent('warning', 'payment_reconciled_needs_review', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      outcome: 'fulfillment_gated',
    });
    return paymentCompletionResult(next, recorded);
  }

  const refundState = await stripeSessionRefundState(session);
  if (refundState.state !== 'unrefunded') {
    const message =
      refundState.state === 'full'
        ? 'Payment was refunded before fulfillment and no Printful submission was attempted.'
        : refundState.state === 'partial'
          ? 'Payment was partially refunded before fulfillment; operator review is required.'
          : 'Stripe payment/refund state could not be verified; fulfillment remains paused for review.';
    next = {
      ...next,
      status: refundState.state === 'full' ? 'refunded' : 'needs_review',
      refundedCents: refundState.refundedCents,
      fulfillment: {
        ...next.fulfillment,
        status: 'needs_review',
        message,
      },
    };
    next = transition(next, next.status, message);
    const recorded = await recordPaymentCompletion(next, session, providerEventId, {
      failureReason: message,
      eventStatus:
        refundState.state === 'unavailable'
          ? 'processed_with_payment_verification_required'
          : 'processed_with_refund',
    });
    logOperationalEvent('warning', 'payment_reconciled_needs_review', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      outcome: `payment_${refundState.state}`,
    });
    return paymentCompletionResult(next, recorded);
  }

  const recipient = stripeRecipient(session);
  const artworkUrlsByAssetId = await getArtworkUrls(next);
  const artworkUrl = next.designAssetId
    ? (artworkUrlsByAssetId?.[next.designAssetId] ?? null)
    : (Object.values(artworkUrlsByAssetId ?? {})[0] ?? null);
  const quote = next.quote;
  if (!recipient || !artworkUrl || !artworkUrlsByAssetId || !quote) {
    next = {
      ...next,
      status: 'needs_review',
      fulfillment: {
        ...next.fulfillment,
        status: 'needs_review',
        message:
          'Payment is complete, but fulfillment needs review because recipient or artwork data is incomplete.',
      },
    };
    const recorded = await recordPaymentCompletion(next, session, providerEventId, {
      failureReason: next.fulfillment.message,
      eventStatus: 'processed',
    });
    logOperationalEvent('error', 'payment_reconciled_needs_review', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      outcome: 'missing_fulfillment_data',
      failureCode: 'missing_recipient_artwork_or_quote',
    });
    return paymentCompletionResult(next, recorded);
  }

  next = transition(next, 'fulfillment_validating', 'Preparing Printful draft order.');
  if (!(await fulfillmentOrderIsEligible(next.id, session.id))) {
    const message =
      'Payment is verified, but the order changed before fulfillment could begin; operator review is required.';
    const reviewNext = transition(
      {
        ...next,
        status: 'needs_review',
        fulfillment: { ...next.fulfillment, status: 'needs_review', message },
      },
      'needs_review',
      message
    );
    const recorded = await recordPaymentCompletion(reviewNext, session, providerEventId, {
      failureReason: message,
      eventStatus: 'processed_after_terminal_order',
    });
    return paymentCompletionResult(reviewNext, recorded);
  }
  const fulfillmentAttemptId = await startFulfillmentAttempt(next.id);
  logOperationalEvent('info', 'printful_draft_started', {
    orderId,
    stripeEventId: providerEventId,
    stripeSessionId: session.id,
  });
  let printfulOrder: Awaited<ReturnType<typeof submitPrintfulDraftOrder>>;
  try {
    printfulOrder = await submitPrintfulDraftOrder({
      quote,
      orderNumber: next.orderNumber,
      recipient,
      artworkUrl,
      artworkUrlsByAssetId,
    });
  } catch (error) {
    const failure = classifyPrintfulFailure(error);
    next = {
      ...next,
      status: 'failed',
      fulfillment: {
        provider: 'printful-ready',
        status: 'failed',
        message: failure.message,
      },
    };
    next = transition(next, 'failed', failure.message);
    const recorded = await recordPaymentCompletion(next, session, providerEventId, {
      failureReason: `[${failure.code}] ${failure.message}`,
      fulfillmentAttemptId,
      fulfillmentAttempt: {
        status: 'failed',
        errorMessage: `[${failure.code}] ${failure.message}`,
      },
      eventStatus: 'processed_with_fulfillment_failure',
    });
    logOperationalEvent('error', 'printful_draft_failed', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      ...classifyOperationalError(error),
      failureCode: failure.code,
      statusCode: failure.statusCode,
    });
    return paymentCompletionResult(next, recorded);
  }

  const postSubmissionRefundState = await stripeSessionRefundState(session);
  if (postSubmissionRefundState.state !== 'unrefunded') {
    const message =
      postSubmissionRefundState.state === 'full'
        ? `Payment was refunded while Printful draft ${printfulOrder.providerOrderId} was being created; the draft must not be confirmed.`
        : postSubmissionRefundState.state === 'partial'
          ? `Payment was partially refunded while Printful draft ${printfulOrder.providerOrderId} was being created; operator review is required.`
          : `Printful draft ${printfulOrder.providerOrderId} was created, but Stripe payment/refund state could not be reverified.`;
    next = {
      ...next,
      status: postSubmissionRefundState.state === 'full' ? 'refunded' : 'needs_review',
      refundedCents: postSubmissionRefundState.refundedCents,
      fulfillment: {
        provider: 'printful',
        status: 'needs_review',
        message,
      },
    };
    next = transition(next, next.status, message);
    const recorded = await recordPaymentCompletion(next, session, providerEventId, {
      failureReason: message,
      printfulOrderId: printfulOrder.providerOrderId,
      fulfillmentAttemptId,
      fulfillmentAttempt: {
        providerOrderId: printfulOrder.providerOrderId,
        status: 'succeeded',
        providerStatus: printfulOrder.status,
      },
      eventStatus:
        postSubmissionRefundState.state === 'unavailable'
          ? 'processed_with_payment_verification_required'
          : 'processed_with_refund',
    });
    logOperationalEvent('warning', 'printful_draft_created_payment_review', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      providerOrderId: printfulOrder.providerOrderId,
      outcome: `payment_${postSubmissionRefundState.state}`,
    });
    return paymentCompletionResult(next, recorded);
  }

  const mappedStatus = printfulOrder.confirmed
    ? mapPrintfulOrderStatus(printfulOrder.status)
    : { orderStatus: 'needs_review' as const, fulfillmentStatus: 'needs_review' as const };
  next = {
    ...next,
    fulfillment: {
      provider: 'printful',
      status: mappedStatus.fulfillmentStatus,
      message: printfulOrder.confirmed
        ? `Printful order ${printfulOrder.providerOrderId} confirmed.`
        : `Printful draft order ${printfulOrder.providerOrderId} created for review.`,
    },
  };
  next = transition(next, mappedStatus.orderStatus, next.fulfillment.message);
  const recorded = await recordPaymentCompletion(next, session, providerEventId, {
    failureReason: null,
    printfulOrderId: printfulOrder.providerOrderId,
    fulfillmentAttemptId,
    fulfillmentAttempt: {
      providerOrderId: printfulOrder.providerOrderId,
      status: 'succeeded',
      providerStatus: printfulOrder.status,
    },
    eventStatus: 'processed',
  });
  logOperationalEvent('info', 'printful_draft_created', {
    orderId,
    stripeEventId: providerEventId,
    stripeSessionId: session.id,
    providerOrderId: printfulOrder.providerOrderId,
    outcome: 'draft_for_review',
  });
  return paymentCompletionResult(next, recorded);
}

export async function handleStripeCheckoutExpired(
  session: Stripe.Checkout.Session,
  providerEventId = session.id
): Promise<OrderSummary | undefined> {
  const orderId = session.metadata?.orderId;
  if (!orderId) return undefined;
  const order = await loadOrder(orderId);
  if (!order) return undefined;
  const claim = await claimStripeEvent(orderId, providerEventId, 'checkout.session.expired', {
    id: session.id,
    orderId,
  });
  if (claim === 'busy') throw new StripeEventBusyError();
  if (claim === 'duplicate') return order;
  if (!env.databaseUrl && order.status !== 'checkout_pending') return order;
  const next = transition(order, 'cancelled', 'Stripe Checkout expired before payment.');
  const expired = await persistCheckoutExpired(next, session.id, providerEventId);
  if (!expired) {
    const current = (await loadOrder(orderId)) ?? order;
    logOperationalEvent('info', 'checkout_expiry_ignored', {
      orderId,
      stripeEventId: providerEventId,
      stripeSessionId: session.id,
      outcome: current.status,
    });
    return current;
  }
  saveOrder(next);
  logOperationalEvent('info', 'checkout_expired', {
    orderId,
    stripeEventId: providerEventId,
    stripeSessionId: session.id,
    outcome: 'cancelled',
  });
  return next;
}

export async function handleStripeChargeRefunded(
  charge: Stripe.Charge,
  providerEventId = charge.id
): Promise<OrderSummary | undefined> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return undefined;
  const paymentIntent = await retrieveStripePaymentIntent(paymentIntentId);
  const orderId = paymentIntent?.metadata?.orderId;
  let order = orderId ? await loadOrder(orderId) : undefined;
  if (!order) order = await loadOrderByPaymentIntent(paymentIntentId);
  if (!order) {
    logOperationalEvent('error', 'stripe_refund_orphaned', {
      stripeEventId: providerEventId,
      failureCode: 'missing_order_for_refund',
    });
    await persistOrphanedRefundAudit(paymentIntentId, providerEventId);
    throw new Error('Stripe refund references a missing durable order.');
  }
  const claim = await claimStripeEvent(order.id, providerEventId, 'charge.refunded', {
    id: charge.id,
    payment_intent: paymentIntentId,
    amount_refunded: charge.amount_refunded,
  });
  if (claim === 'busy') throw new StripeEventBusyError();
  if (claim === 'duplicate') return order;
  const refund = stripeChargeRefundState(charge);
  const fullyRefunded = refund.state === 'full';
  const message = fullyRefunded
    ? 'Stripe reported the charge as fully refunded.'
    : refund.state === 'partial'
      ? `Stripe reported a partial refund of ${refund.refundedCents} cents; operator review is required.`
      : 'Stripe sent a refund event without a refunded amount; operator review is required.';
  let next: OrderSummary = {
    ...order,
    refundedCents: refund.refundedCents,
    status: fullyRefunded ? 'refunded' : 'needs_review',
    fulfillment: {
      ...order.fulfillment,
      status: 'needs_review',
      message,
    },
  };
  next = transition(next, next.status, message);
  const refundApplied = await persistStripeRefund(order, providerEventId, refund, message);
  if (!refundApplied) {
    const current = await loadOrder(order.id);
    logOperationalEvent('info', 'payment_refund_ignored', {
      orderId: order.id,
      stripeEventId: providerEventId,
      stripeSessionId: order.stripeSessionId,
      outcome: 'stale_or_nonmonotonic_refund',
    });
    return current ?? order;
  }
  saveOrder(next);
  logOperationalEvent('info', 'payment_refunded', {
    orderId: order.id,
    stripeEventId: providerEventId,
    stripeSessionId: order.stripeSessionId,
    outcome: refund.state,
  });
  return next;
}

export async function submitFixtureFulfillment(orderId: string): Promise<OrderSummary> {
  const order = getOrder(orderId);
  if (!order) throw new Error('Order not found.');
  let next = transition(order, 'paid', 'Fixture checkout marked paid.');
  next = transition(next, 'fulfillment_validating', 'Order payload validated in fixture mode.');

  if (order.quote?.items[0]) {
    const product =
      (await getProductBySlug(
        order.quote.items[0].title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      )) ?? null;
    void product;
  }

  next = {
    ...next,
    fulfillment: {
      ...next.fulfillment,
      status: 'submitted',
      message: 'Fixture fulfillment submitted. Real Printful submission remains disabled.',
    },
  };
  next = transition(next, 'submitted', 'Fixture fulfillment submitted.');
  return saveOrder(next);
}

export async function getOrderSummary(orderId: string): Promise<OrderSummary | undefined> {
  return loadOrder(orderId);
}

export async function getOrderByCheckoutSession(
  stripeSessionId: string
): Promise<InternalCheckoutConfirmation> {
  const order = await loadOrderByCheckoutSession(stripeSessionId);
  if (order && order.status !== 'checkout_pending') {
    return {
      state:
        order.status === 'paid'
          ? 'paid'
          : order.status === 'needs_review'
            ? 'needs_review'
            : 'failed',
      message: order.status === 'paid' ? 'Payment received.' : order.fulfillment.message,
      order,
    };
  }
  const session = await retrieveStripeCheckoutSession(stripeSessionId);
  if (session?.payment_status === 'paid') {
    const recovered = await handleStripeCheckoutCompleted(session, `recovery:${session.id}`);
    if (recovered) {
      return {
        state:
          recovered.status === 'paid'
            ? 'paid'
            : recovered.status === 'needs_review'
              ? 'needs_review'
              : 'failed',
        message: 'Payment was recovered from Stripe while webhook reconciliation completed.',
        order: recovered,
      };
    }
  }
  return {
    state: 'processing',
    message: 'Payment confirmation is still processing. Do not submit another payment.',
    order,
  };
}

export async function reviewAdminOrder(
  orderId: string,
  status: Exclude<OperatorReviewStatus, 'unreviewed'>,
  note?: string,
  requestId?: string
): Promise<AdminOrderDetail> {
  if (!env.databaseUrl) {
    throw new OrderRecoveryError(
      'Operator review requires durable PostgreSQL order storage.',
      409,
      'durable_order_required'
    );
  }
  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!existing) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        operatorReviewStatus: status,
        operatorReviewedAt: new Date(),
        transitions: {
          create: {
            status: `operator_${status}`,
            note: `Operator review ${status}.`,
          },
        },
      },
    }),
    prisma.auditLog.create({
      data: {
        actor: 'admin',
        action: `order.review_${status}`,
        target: orderId,
        metadata: note ? { note } : {},
      },
    }),
  ]);
  logOperationalEvent('info', 'order_review_updated', {
    requestId,
    orderId,
    outcome: status,
  });
  const detail = await getAdminOrderDetail(orderId);
  if (!detail) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
  return detail;
}

export async function retryPrintfulDraftOrder(
  orderId: string,
  requestId?: string
): Promise<AdminOrderDetail> {
  if (!env.databaseUrl) {
    throw new OrderRecoveryError(
      'Printful retry requires durable PostgreSQL order storage.',
      409,
      'durable_order_required'
    );
  }
  const retryRecord = await loadFulfillmentRetryRecord(orderId);
  if (!retryRecord) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
  if (retryRecord.printfulOrderId) {
    logOperationalEvent('info', 'printful_draft_retry_noop', {
      requestId,
      orderId,
      providerOrderId: retryRecord.printfulOrderId,
      outcome: 'already_attached',
    });
    const detail = await getAdminOrderDetail(orderId);
    if (!detail) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
    return detail;
  }
  const retryBlocker = printfulRetryBlocker(retryRecord);
  if (retryBlocker) {
    throw new OrderRecoveryError(retryBlocker.message, 409, retryBlocker.errorCode);
  }
  if (
    !env.fulfillmentEnabled ||
    !env.enableLivePrintful ||
    !env.allowLiveFulfillment ||
    env.printfulAutoConfirmOrders
  ) {
    throw new OrderRecoveryError(
      'Printful draft retry is blocked by the production fulfillment gates.',
      409,
      'fulfillment_gate_closed'
    );
  }

  const session = await retrieveStripeCheckoutSession(retryRecord.stripeSessionId!);
  if (
    !session ||
    session.payment_status !== 'paid' ||
    session.metadata?.orderId !== retryRecord.id
  ) {
    throw new OrderRecoveryError(
      'Stripe could not verify the paid order for fulfillment retry.',
      409,
      'stripe_payment_not_verified'
    );
  }
  const refundState = await stripeSessionRefundState(session);
  if (refundState.state !== 'unrefunded') {
    throw new OrderRecoveryError(
      'Stripe refund state is not clear; Printful retry remains blocked for operator review.',
      409,
      refundState.state === 'unavailable' ? 'stripe_payment_not_verified' : 'payment_refunded'
    );
  }
  const order = retryRecord.order;
  const recipient = stripeRecipient(session);
  const artworkUrlsByAssetId = await getArtworkUrls(order);
  const artworkUrl = order.designAssetId
    ? (artworkUrlsByAssetId?.[order.designAssetId] ?? null)
    : (Object.values(artworkUrlsByAssetId ?? {})[0] ?? null);
  if (!order.quote || !recipient || !artworkUrl || !artworkUrlsByAssetId) {
    throw new OrderRecoveryError(
      'The durable quote, shipping recipient, or artwork is unavailable.',
      409,
      'fulfillment_data_incomplete'
    );
  }

  const attemptId = await startFulfillmentAttempt(orderId);
  if (!attemptId) {
    throw new OrderRecoveryError(
      'Printful retry could not create a durable fulfillment attempt.',
      500,
      'fulfillment_attempt_not_stored'
    );
  }
  if (!(await fulfillmentOrderIsEligible(orderId, session.id))) {
    await prisma.fulfillmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'blocked',
        errorMessage: 'The order became ineligible before provider submission.',
      },
    });
    throw new OrderRecoveryError(
      'The order became ineligible for fulfillment before the provider request.',
      409,
      'order_not_fulfillable'
    );
  }
  logOperationalEvent('info', 'printful_draft_retry_started', {
    requestId,
    orderId,
    stripeSessionId: session.id,
  });
  let printfulOrder: Awaited<ReturnType<typeof submitPrintfulDraftOrder>>;
  try {
    printfulOrder = await submitPrintfulDraftOrder({
      quote: order.quote,
      orderNumber: order.orderNumber,
      recipient,
      artworkUrl,
      artworkUrlsByAssetId,
    });
  } catch (error) {
    const failure = classifyPrintfulFailure(error);
    await prisma.$transaction(async (tx) => {
      const orderUpdate = await tx.order.updateMany({
        where: {
          id: orderId,
          status: { in: ['PAID', 'FAILED', 'NEEDS_REVIEW'] },
          refundedCents: 0,
        },
        data: {
          status: 'FAILED',
          fulfillmentStatus: 'failed',
          failureReason: `[${failure.code}] ${failure.message}`,
          operatorReviewStatus: 'unreviewed',
          operatorReviewedAt: null,
        },
      });
      if (orderUpdate.count === 1) {
        await tx.orderTransition.create({
          data: { orderId, status: 'failed', note: failure.message },
        });
      }
      await tx.fulfillmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'failed',
          errorMessage: `[${failure.code}] ${failure.message}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: 'admin',
          action:
            orderUpdate.count === 1
              ? 'printful.draft_retry_failed'
              : 'printful.draft_retry_failed_after_terminal_payment',
          target: orderId,
          metadata: { failureCode: failure.code },
        },
      });
    });
    logOperationalEvent('error', 'printful_draft_retry_failed', {
      requestId,
      orderId,
      stripeSessionId: session.id,
      ...classifyOperationalError(error),
      failureCode: failure.code,
      statusCode: failure.statusCode,
    });
    throw new OrderRecoveryError(failure.message, 502, failure.code);
  }

  const postSubmissionRefundState = await stripeSessionRefundState(session);
  const paymentReviewMessage =
    postSubmissionRefundState.state === 'full'
      ? `Payment was refunded while Printful draft ${printfulOrder.providerOrderId} was being created; the draft must not be confirmed.`
      : postSubmissionRefundState.state === 'partial'
        ? `Payment was partially refunded while Printful draft ${printfulOrder.providerOrderId} was being created; operator review is required.`
        : postSubmissionRefundState.state === 'unavailable'
          ? `Printful draft ${printfulOrder.providerOrderId} was created, but Stripe payment/refund state could not be reverified.`
          : `Printful draft order ${printfulOrder.providerOrderId} created for review.`;
  const orderUpdated = await prisma.$transaction(async (tx) => {
    let updateCount = 0;
    if (postSubmissionRefundState.state === 'full') {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'REFUNDED',
          refundedCents: postSubmissionRefundState.refundedCents,
          printfulOrderId: printfulOrder.providerOrderId,
          fulfillmentStatus: 'needs_review',
          failureReason: paymentReviewMessage,
          operatorReviewStatus: 'unreviewed',
          operatorReviewedAt: null,
        },
      });
      updateCount = 1;
    } else {
      const update = await tx.order.updateMany({
        where: {
          id: orderId,
          status: { in: ['PAID', 'FAILED', 'NEEDS_REVIEW'] },
          refundedCents: 0,
        },
        data: {
          status: 'NEEDS_REVIEW',
          refundedCents: postSubmissionRefundState.refundedCents,
          printfulOrderId: printfulOrder.providerOrderId,
          fulfillmentStatus: 'needs_review',
          failureReason:
            postSubmissionRefundState.state === 'unrefunded' ? null : paymentReviewMessage,
          operatorReviewStatus: 'unreviewed',
          operatorReviewedAt: null,
        },
      });
      updateCount = update.count;
      if (updateCount === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: { printfulOrderId: printfulOrder.providerOrderId },
        });
      }
    }
    if (updateCount === 1) {
      await tx.orderTransition.create({
        data: {
          orderId,
          status: postSubmissionRefundState.state === 'full' ? 'refunded' : 'needs_review',
          note: paymentReviewMessage,
        },
      });
    }
    await tx.fulfillmentAttempt.update({
      where: { id: attemptId },
      data: {
        providerOrderId: printfulOrder.providerOrderId,
        status: 'succeeded',
        payload: { providerStatus: printfulOrder.status },
      },
    });
    await tx.auditLog.create({
      data: {
        actor: 'admin',
        action:
          updateCount === 1
            ? 'printful.draft_retry_succeeded'
            : 'printful.draft_retry_succeeded_after_terminal_payment',
        target: orderId,
        metadata: {
          providerOrderId: printfulOrder.providerOrderId,
          paymentState: postSubmissionRefundState.state,
        },
      },
    });
    return updateCount === 1;
  });
  logOperationalEvent('info', 'printful_draft_retry_succeeded', {
    requestId,
    orderId,
    stripeSessionId: session.id,
    providerOrderId: printfulOrder.providerOrderId,
    outcome: orderUpdated
      ? `draft_for_review_${postSubmissionRefundState.state}`
      : 'draft_attached_after_terminal_payment',
  });
  const detail = await getAdminOrderDetail(orderId);
  if (!detail) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
  return detail;
}

export function buildFixturePayloadForQuote(quote: QuoteBreakdown, artworkUrl: string) {
  return buildPrintfulOrderPayload({
    quote,
    artworkUrl,
    recipient: {
      name: 'Fixture Customer',
      address1: '100 Demo Way',
      city: 'Demo City',
      stateCode: 'NY',
      countryCode: 'US',
      zip: '10001',
      email: 'fixture@example.com',
    },
  });
}
