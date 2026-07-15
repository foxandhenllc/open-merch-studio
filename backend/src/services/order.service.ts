import { env } from '../config/env.js';
import { Prisma } from '@prisma/client';
import { getProductBySlug, listProducts } from './catalog.service.js';
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
  getQuote,
  getRuntimeSettings,
  getStudioPassById,
  getStudioPassForSession,
  listOrders,
  saveQuote,
  runtimeId,
  runtimeNow,
  saveOrder,
} from './runtime-store.js';
import type {
  CheckoutConfirmation,
  CheckoutSession,
  AdminOrderDetail,
  AdminOrderListItem,
  MoneyLine,
  OperatorReviewStatus,
  OrderSummary,
  QuoteBreakdown,
} from '../types/catalog.js';
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
import { classifyOperationalError, logOperationalEvent } from '../utils/operational-logger.js';

type CheckoutInput = {
  quoteId?: string | null;
  sessionId?: string;
  studioPassId?: string;
  email?: string;
  designAssetId?: string;
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

const analyticsTrackedStripeEvents = new Set<string>();

export function stripeEventStatusIsTerminal(status?: string | null): boolean {
  return Boolean(status && !['processing', 'retrying'].includes(status));
}

export async function wasStripeEventProcessed(providerEventId: string): Promise<boolean> {
  if (analyticsTrackedStripeEvents.has(providerEventId)) return true;
  if (!env.databaseUrl) return false;
  try {
    const existing = await prisma.paymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'stripe',
          providerEventId,
        },
      },
      select: { status: true },
    });
    return stripeEventStatusIsTerminal(existing?.status);
  } catch {
    return false;
  }
}

export function markStripeEventTracked(providerEventId: string): void {
  analyticsTrackedStripeEvents.add(providerEventId);
}

const orderNumber = () =>
  `OMS-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const quoteInclude = {
  items: {
    include: {
      product: true,
      variant: true,
    },
  },
} satisfies Prisma.QuoteInclude;

type PersistedQuote = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

const orderInclude = {
  quote: {
    include: quoteInclude,
  },
  transitions: {
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;

type PersistedOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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
      // Preserve the visible result for rows created before dedicated recovery
      // statuses existed.
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

function runtimeFulfillmentStatus(
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

function jsonArray<T>(value: Prisma.JsonValue | null | undefined, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function jsonObject<T extends Record<string, unknown>>(
  value: Prisma.JsonValue | null | undefined,
  fallback: T
): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : fallback;
}

function estimateFlags(
  value: Prisma.JsonValue | null | undefined
): QuoteBreakdown['estimateFlags'] {
  const flags = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    shipping: Boolean((flags as Partial<QuoteBreakdown['estimateFlags']>).shipping ?? true),
    tax: Boolean((flags as Partial<QuoteBreakdown['estimateFlags']>).tax ?? true),
    paymentFee: Boolean((flags as Partial<QuoteBreakdown['estimateFlags']>).paymentFee ?? true),
  };
}

function mapPersistedQuote(quote: PersistedQuote): QuoteBreakdown {
  return {
    id: quote.id,
    currency: quote.currency,
    productCostCents: quote.productCostCents,
    shippingEstimateCents: quote.shippingEstimateCents,
    taxEstimateCents: quote.taxEstimateCents,
    aiDesignFeeCents: quote.aiDesignFeeCents,
    paymentFeeCents: quote.paymentFeeCents,
    targetMarginCents: quote.targetMarginCents,
    studioPassCreditCents: quote.studioPassCreditCents,
    totalCents: quote.totalCents,
    subtotalBeforeCreditsCents: quote.subtotalBeforeCreditsCents,
    estimateFlags: estimateFlags(quote.estimateFlags),
    costLines: jsonArray<MoneyLine>(quote.costLines, []),
    expiresAt: quote.expiresAt.toISOString(),
    items: quote.items.map((item) => ({
      ...(() => {
        const options = jsonObject<{
          orientation?: QuoteBreakdown['items'][number]['orientation'];
          placementTechniques?: Record<string, string>;
        }>(item.options, {});
        return {
          orientation: options.orientation,
          placementTechniques: options.placementTechniques ?? {},
        };
      })(),
      productId: item.productId,
      variantId: item.variantId,
      printfulVariantId: item.variant.printfulVariantId,
      title: item.product.title,
      variantName: item.variant.name,
      quantity: item.quantity,
      placementCodes: item.placementCodes,
      designAssetId: item.designAssetId ?? undefined,
      unitCostCents: item.unitCostCents,
      unitRetailCents: item.unitRetailCents,
    })),
  };
}

export async function getQuoteById(quoteId?: string | null): Promise<QuoteBreakdown | undefined> {
  const runtimeQuote = getQuote(quoteId);
  if (!quoteId || !env.databaseUrl) return runtimeQuote;
  const persisted = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: quoteInclude,
  });
  if (!persisted) return undefined;
  return saveQuote(mapPersistedQuote(persisted));
}

function mapPersistedOrder(order: PersistedOrder): OrderSummary {
  const quote = order.quote ? mapPersistedQuote(order.quote) : undefined;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    stripeSessionId: order.stripeSessionId ?? undefined,
    stripePaymentIntentId: order.stripePaymentIntentId ?? undefined,
    taxCents: order.taxCents,
    refundedCents: order.refundedCents,
    paidAt: order.paidAt?.toISOString(),
    status: restoreRuntimeOrderStatus(order.status, order.fulfillmentStatus),
    customerEmail: order.email ?? undefined,
    totalCents: order.totalCents,
    currency: order.currency,
    quote,
    designAssetId: quote?.items.find((item) => item.designAssetId)?.designAssetId,
    fulfillment: {
      provider: order.printfulOrderId ? 'printful' : 'printful-ready',
      status: runtimeFulfillmentStatus(order.fulfillmentStatus),
      message:
        order.failureReason ??
        (order.printfulOrderId
          ? `Printful draft order ${order.printfulOrderId} is attached for operator review.`
          : order.fulfillmentStatus === 'needs_review'
            ? 'Fulfillment requires operator review.'
            : 'Loaded from persistent checkout state.'),
    },
    timeline: order.transitions.map((transition) => ({
      at: transition.createdAt.toISOString(),
      status: transition.status,
      note: transition.note ?? '',
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

async function loadOrder(orderId: string): Promise<OrderSummary | undefined> {
  if (!env.databaseUrl) return getOrder(orderId);
  const persisted = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!persisted) return undefined;
  return saveOrder(mapPersistedOrder(persisted));
}

type CheckoutDesignState = {
  id: string;
  imageUrl?: string | null;
  generationStatus: string;
  policyStatus: string;
  readinessStatus: string;
};

async function loadDesignForCheckout(
  designAssetId: string
): Promise<CheckoutDesignState | undefined> {
  if (env.databaseUrl) {
    const asset = await prisma.designAsset.findUnique({ where: { id: designAssetId } });
    if (!asset) return undefined;
    return {
      id: asset.id,
      imageUrl: asset.transparentUrl ?? asset.imageUrl,
      generationStatus: asset.generationStatus,
      policyStatus: asset.policyStatus,
      readinessStatus: asset.readinessStatus,
    };
  }

  const draft = getDraft(designAssetId);
  if (!draft) return undefined;
  return {
    id: designAssetId,
    imageUrl: draft.imageUrl,
    generationStatus: draft.id ? 'complete' : 'failed',
    policyStatus: draft.policy.status,
    readinessStatus: draft.readiness.status,
  };
}

function checkoutDesignIssue(design: CheckoutDesignState | undefined): string | null {
  if (!design) return 'Selected artwork could not be verified for checkout.';
  if (!design.imageUrl) return 'Selected artwork is missing a generated or uploaded image.';
  if (design.generationStatus !== 'complete') {
    return 'Selected artwork has not completed generation successfully.';
  }
  if (design.policyStatus !== 'pass') {
    return 'Selected artwork needs policy review before checkout.';
  }
  if (design.readinessStatus !== 'pass') {
    return 'Selected artwork must pass print-readiness checks before checkout.';
  }
  return null;
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

async function persistOrder(order: OrderSummary, stripeSessionId?: string): Promise<boolean> {
  if (!env.databaseUrl || !order.quote?.id) return false;
  try {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {
        email: order.customerEmail,
        status: persistedOrderStatus(order.status),
        stripeSessionId,
        stripePaymentIntentId: order.stripePaymentIntentId,
        fulfillmentStatus: order.fulfillment.status,
        totalCents: order.totalCents,
        taxCents: order.taxCents,
        refundedCents: order.refundedCents,
        paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
        currency: order.currency,
      },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        quoteId: order.quote.id,
        email: order.customerEmail,
        status: persistedOrderStatus(order.status),
        stripeSessionId,
        stripePaymentIntentId: order.stripePaymentIntentId,
        fulfillmentStatus: order.fulfillment.status,
        totalCents: order.totalCents,
        taxCents: order.taxCents,
        refundedCents: order.refundedCents,
        paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
        currency: order.currency,
        items: {
          create: order.quote.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            designAssetId: item.designAssetId,
            quantity: item.quantity,
            placementCodes: item.placementCodes,
            unitRetailCents: item.unitRetailCents,
            printfulPayload: {},
          })),
        },
        transitions: {
          create: {
            status: order.status,
            note: 'Order persisted for checkout.',
          },
        },
      },
    });
    return true;
  } catch {
    return false;
  }
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

async function persistStudioPassPurchase(sessionId: string): Promise<void> {
  if (!env.databaseUrl) return;
  try {
    await prisma.studioSession.upsert({
      where: { id: sessionId },
      update: {},
      create: {
        id: sessionId,
        freeDraftLimit: env.freeDraftLimit,
      },
    });
    const existingPass = await prisma.studioPass.findFirst({
      where: { sessionId, status: 'purchased' },
    });
    if (!existingPass) {
      await prisma.studioPass.create({
        data: {
          sessionId,
          status: 'purchased',
          priceCents: env.studioPassPriceCents,
          creditCents: env.studioPassPriceCents,
        },
      });
    }
  } catch {
    // Runtime pass state remains the fallback source if persistence is unavailable.
  }
}

type PaymentCompletionOptions = {
  failureReason?: string | null;
  printfulOrderId?: string;
  fulfillmentAttemptId?: string;
  fulfillmentAttempt?: {
    providerOrderId?: string;
    status: string;
    errorMessage?: string;
    providerStatus?: string;
  };
  eventStatus?: string;
};

async function recordPaymentCompletion(
  order: OrderSummary,
  session: Stripe.Checkout.Session,
  providerEventId = session.id,
  options: PaymentCompletionOptions = {}
): Promise<boolean> {
  if (!env.databaseUrl) return true;
  const transitionRows = [
    { status: 'paid', note: 'Stripe checkout completed.' },
    ...(order.status === 'paid' ? [] : [{ status: order.status, note: order.fulfillment.message }]),
  ];
  const recipient = stripeRecipient(session);
  return prisma.$transaction(async (tx) => {
    const orderUpdate = await tx.order.updateMany({
      where: {
        id: order.id,
        status: { not: 'REFUNDED' },
        refundedCents: 0,
      },
      data: {
        email: session.customer_details?.email ?? undefined,
        status: persistedOrderStatus(order.status),
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
        totalCents: session.amount_total ?? undefined,
        taxCents: session.total_details?.amount_tax ?? 0,
        refundedCents: order.refundedCents ?? 0,
        paidAt: order.paidAt ? new Date(order.paidAt) : new Date(),
        fulfillmentStatus: order.fulfillment.status,
        recipient: recipient
          ? (JSON.parse(JSON.stringify(recipient)) as Prisma.InputJsonValue)
          : undefined,
        failureReason: options.failureReason,
        printfulOrderId: options.printfulOrderId,
        ...(order.status === 'failed' || order.status === 'needs_review'
          ? { operatorReviewStatus: 'unreviewed', operatorReviewedAt: null }
          : {}),
      },
    });
    const recorded = orderUpdate.count === 1;
    if (recorded) {
      await tx.orderTransition.createMany({
        data: transitionRows.map((transition) => ({ orderId: order.id, ...transition })),
      });
    } else {
      // Terminal refund truth wins, while immutable payment facts and any
      // provider draft reference still have to survive reconciliation. A
      // verified paid completion may supersede an earlier local expiry.
      await tx.order.update({
        where: { id: order.id },
        data: {
          email: session.customer_details?.email ?? undefined,
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
          totalCents: session.amount_total ?? undefined,
          taxCents: session.total_details?.amount_tax ?? 0,
          paidAt: order.paidAt ? new Date(order.paidAt) : new Date(),
          recipient: recipient
            ? (JSON.parse(JSON.stringify(recipient)) as Prisma.InputJsonValue)
            : undefined,
          printfulOrderId: options.printfulOrderId,
          operatorReviewStatus: 'unreviewed',
          operatorReviewedAt: null,
        },
      });
      if (options.printfulOrderId) {
        await tx.auditLog.create({
          data: {
            actor: 'stripe',
            action: 'printful.draft_attached_after_terminal_payment',
            target: order.id,
            metadata: { providerOrderId: options.printfulOrderId },
          },
        });
      }
    }
    await tx.paymentEvent.upsert({
      where: {
        provider_providerEventId: { provider: 'stripe', providerEventId },
      },
      update: {
        status: recorded ? (options.eventStatus ?? 'processed') : 'processed_after_terminal_order',
        payload: {
          id: session.id,
          payment_status: session.payment_status,
          kind: session.metadata?.kind,
          orderId: session.metadata?.orderId,
        },
      },
      create: {
        orderId: order.id,
        provider: 'stripe',
        providerEventId,
        eventType: 'checkout.session.completed',
        status: recorded ? (options.eventStatus ?? 'processed') : 'processed_after_terminal_order',
        payload: {
          id: session.id,
          payment_status: session.payment_status,
          kind: session.metadata?.kind,
          orderId: session.metadata?.orderId,
        },
      },
    });
    if (options.fulfillmentAttemptId && options.fulfillmentAttempt) {
      await tx.fulfillmentAttempt.update({
        where: { id: options.fulfillmentAttemptId },
        data: {
          providerOrderId: options.fulfillmentAttempt.providerOrderId,
          status: options.fulfillmentAttempt.status,
          errorMessage: options.fulfillmentAttempt.errorMessage,
          payload: options.fulfillmentAttempt.providerStatus
            ? { providerStatus: options.fulfillmentAttempt.providerStatus }
            : undefined,
        },
      });
    }
    return recorded;
  });
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

export async function validateQuoteForCheckout(
  quote: QuoteBreakdown,
  requireProviderMetadata = false
): Promise<string[]> {
  const issues: string[] = [];
  const products = await listProducts();
  for (const item of quote.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    if (!product) issues.push(`Product ${item.productId} is no longer sellable.`);
    if (!variant) issues.push(`Variant ${item.variantId} is no longer available.`);
    if (requireProviderMetadata && !item.printfulVariantId) {
      issues.push(`Provider variant metadata is missing for ${item.title}.`);
    }
    const unavailablePlacement = item.placementCodes.find(
      (placementCode) => !product?.placements.some((placement) => placement.code === placementCode)
    );
    if (unavailablePlacement) {
      issues.push(
        `Placement ${unavailablePlacement} is unavailable for ${product?.title ?? 'item'}.`
      );
    }
    const missingTechnique = item.placementCodes.find(
      (placementCode) => !item.placementTechniques[placementCode]
    );
    if (requireProviderMetadata && missingTechnique) {
      issues.push(`Provider technique metadata is missing for ${item.title} ${missingTechnique}.`);
    }
  }
  return issues;
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

  const quoteIssues = await validateQuoteForCheckout(quote, settings.liveStripeEnabled);
  if (Date.now() > new Date(quote.expiresAt).getTime()) {
    quoteIssues.push('Quote expired. Create a fresh quote before checkout.');
  }
  const requiredDesignIds = new Set(
    quote.items.map((item) => item.designAssetId).filter(Boolean) as string[]
  );
  if (input.designAssetId) requiredDesignIds.add(input.designAssetId);
  if (!requiredDesignIds.size) {
    quoteIssues.push('Checkout requires generated or uploaded artwork.');
  }

  for (const designAssetId of requiredDesignIds) {
    const issue = checkoutDesignIssue(await loadDesignForCheckout(designAssetId));
    if (issue) quoteIssues.push(issue);
  }
  if (settings.liveStripeEnabled && !quoteIssues.length) {
    const durableIssue = await verifyDurableCheckoutState(quote, Array.from(requiredDesignIds));
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
    currency: quote.currency,
    quote,
    designAssetId: input.designAssetId ?? Array.from(requiredDesignIds)[0],
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
      message: 'Stripe Checkout session created. Complete payment in Stripe test mode.',
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

export function stripeRecipient(session: Stripe.Checkout.Session): {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  stateCode?: string;
  countryCode: string;
  zip: string;
  email?: string;
} | null {
  const shippingDetails = session.collected_information?.shipping_details;
  const customerAddress = session.customer_details?.address;
  const address = shippingDetails?.address ?? customerAddress;
  const address1 = address?.line1;
  const city = address?.city;
  const countryCode = address?.country;
  const zip = address?.postal_code;
  if (!address1 || !city || !countryCode || !zip) return null;

  return {
    name: shippingDetails?.name ?? session.customer_details?.name ?? 'Open Merch Customer',
    address1,
    address2: address?.line2 ?? undefined,
    city,
    stateCode: address?.state ?? undefined,
    countryCode,
    zip,
    email: session.customer_details?.email ?? undefined,
  };
}

async function getArtworkUrl(order: OrderSummary): Promise<string | null> {
  if (env.databaseUrl) {
    if (!order.designAssetId) return null;
    try {
      const asset = await prisma.designAsset.findUnique({
        where: { id: order.designAssetId },
        select: { id: true, transparentUrl: true, imageUrl: true },
      });
      const storedUrl = asset?.transparentUrl ?? asset?.imageUrl;
      if (storedUrl && /^https?:\/\//.test(storedUrl)) return storedUrl;
      if (asset?.id && storedUrl?.startsWith('data:')) {
        return `${env.backendUrl}/api/design/assets/${encodeURIComponent(asset.id)}.png`;
      }
      return null;
    } catch {
      return null;
    }
  }
  const draft = getDraft(order.designAssetId);
  if (!draft?.id || !draft.imageUrl) return null;
  if (/^https?:\/\//.test(draft.imageUrl)) return draft.imageUrl;
  if (draft.imageUrl.startsWith('data:')) {
    return `${env.backendUrl}/api/design/assets/${encodeURIComponent(draft.id)}.png`;
  }
  return null;
}

type StripeEventClaim = 'claimed' | 'duplicate' | 'busy';

export function stripeEventClaimDecision(
  status: string,
  updatedAt: Date,
  now = Date.now()
): 'duplicate' | 'busy' | 'reclaim' {
  if (!['processing', 'retrying'].includes(status)) return 'duplicate';
  return updatedAt.getTime() < now - 2 * 60 * 1000 ? 'reclaim' : 'busy';
}

export class StripeEventBusyError extends Error {
  constructor() {
    super('Stripe event reconciliation is already in progress.');
    this.name = 'StripeEventBusyError';
  }
}

async function claimStripeEvent(
  orderId: string,
  providerEventId: string,
  eventType: string,
  payload: Prisma.InputJsonValue
): Promise<StripeEventClaim> {
  if (!env.databaseUrl) return 'claimed';
  try {
    await prisma.paymentEvent.create({
      data: {
        orderId,
        provider: 'stripe',
        providerEventId,
        eventType,
        status: 'processing',
        payload,
      },
    });
    return 'claimed';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.paymentEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: 'stripe',
            providerEventId,
          },
        },
        select: { id: true, status: true, updatedAt: true },
      });
      if (!existing) return 'duplicate';
      const decision = stripeEventClaimDecision(existing.status, existing.updatedAt);
      if (decision === 'duplicate') return 'duplicate';
      if (decision === 'busy') return 'busy';
      const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
      const reclaimed = await prisma.paymentEvent.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
          updatedAt: { lt: staleBefore },
        },
        data: { status: existing.status === 'processing' ? 'retrying' : 'processing' },
      });
      return reclaimed.count === 1 ? 'claimed' : 'busy';
    }
    throw error;
  }
}

async function persistCheckoutExpired(
  order: OrderSummary,
  stripeSessionId: string,
  providerEventId: string
): Promise<boolean> {
  if (!env.databaseUrl) return true;
  const latest = order.timeline.at(-1);
  return prisma.$transaction(async (tx) => {
    const update = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'PENDING_PAYMENT',
        stripeSessionId,
        refundedCents: 0,
      },
      data: {
        status: persistedOrderStatus(order.status),
        fulfillmentStatus: order.fulfillment.status,
      },
    });
    if (update.count === 1 && latest) {
      await tx.orderTransition.create({
        data: { orderId: order.id, status: latest.status, note: latest.note },
      });
    }
    await tx.paymentEvent.update({
      where: {
        provider_providerEventId: { provider: 'stripe', providerEventId },
      },
      data: { status: update.count === 1 ? 'expired' : 'ignored_nonpending_expiry' },
    });
    return update.count === 1;
  });
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
  if (!env.databaseUrl) return;
  await prisma.auditLog.create({
    data: {
      actor: 'stripe',
      action: 'stripe.payment_orphaned',
      target: orderId,
      metadata: { stripeEventId, stripeSessionId },
    },
  });
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
  const artworkUrl = await getArtworkUrl(next);
  const quote = next.quote;
  if (!recipient || !artworkUrl || !quote) {
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
  if (!order && env.databaseUrl) {
    const persisted = await prisma.order.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      include: orderInclude,
    });
    if (persisted) order = saveOrder(mapPersistedOrder(persisted));
  }
  if (!order) {
    logOperationalEvent('error', 'stripe_refund_orphaned', {
      stripeEventId: providerEventId,
      failureCode: 'missing_order_for_refund',
    });
    if (env.databaseUrl) {
      await prisma.auditLog.create({
        data: {
          actor: 'stripe',
          action: 'stripe.refund_orphaned',
          target: paymentIntentId,
          metadata: { stripeEventId: providerEventId },
        },
      });
    }
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
  if (env.databaseUrl) {
    const refundApplied = await prisma.$transaction(async (tx) => {
      const orderUpdate = fullyRefunded
        ? await tx.order.updateMany({
            where: {
              id: order.id,
              refundedCents: { lte: refund.refundedCents },
              OR: [
                { status: { not: 'REFUNDED' } },
                { refundedCents: { lt: refund.refundedCents } },
              ],
            },
            data: {
              status: 'REFUNDED',
              refundedCents: refund.refundedCents,
              fulfillmentStatus: 'needs_review',
              failureReason: message,
              operatorReviewStatus: 'unreviewed',
              operatorReviewedAt: null,
            },
          })
        : refund.state === 'partial'
          ? await tx.order.updateMany({
              where: {
                id: order.id,
                status: { not: 'REFUNDED' },
                refundedCents: { lt: refund.refundedCents },
              },
              data: {
                status: 'NEEDS_REVIEW',
                refundedCents: refund.refundedCents,
                fulfillmentStatus: 'needs_review',
                failureReason: message,
                operatorReviewStatus: 'unreviewed',
                operatorReviewedAt: null,
              },
            })
          : { count: 0 };
      if (orderUpdate.count === 1) {
        await tx.orderTransition.create({
          data: { orderId: order.id, status: next.status, note: message },
        });
      }
      await tx.paymentEvent.update({
        where: {
          provider_providerEventId: { provider: 'stripe', providerEventId },
        },
        data: {
          status:
            orderUpdate.count === 1
              ? fullyRefunded
                ? 'refunded'
                : 'partially_refunded'
              : refund.state === 'unrefunded'
                ? 'refund_amount_unverified'
                : 'ignored_stale_refund',
        },
      });
      return orderUpdate.count === 1;
    });
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
): Promise<CheckoutConfirmation> {
  let order: OrderSummary | undefined;
  if (env.databaseUrl) {
    const persisted = await prisma.order.findFirst({
      where: { stripeSessionId },
      include: orderInclude,
    });
    if (persisted) order = saveOrder(mapPersistedOrder(persisted));
  } else order = listOrders().find((candidate) => candidate.stripeSessionId === stripeSessionId);
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

export async function listOrderSummaries(limit = 50): Promise<OrderSummary[]> {
  const inMemoryOrders = listOrders();
  if (!env.databaseUrl) return inMemoryOrders;
  const persisted = await prisma.order.findMany({
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return persisted.map((order) => saveOrder(mapPersistedOrder(order)));
}

const adminOrderInclude = {
  quote: { include: quoteInclude },
  transitions: { orderBy: { createdAt: 'asc' } },
  paymentEvents: { orderBy: { createdAt: 'asc' } },
  fulfillmentAttempts: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type AdminPersistedOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

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

function operatorReviewStatus(value: string): OperatorReviewStatus {
  return value === 'acknowledged' || value === 'resolved' ? value : 'unreviewed';
}

function adminListItemFromPersisted(order: AdminPersistedOrder): AdminOrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: restoreRuntimeOrderStatus(order.status, order.fulfillmentStatus),
    fulfillmentStatus: runtimeFulfillmentStatus(order.fulfillmentStatus),
    customerEmail: order.email ?? undefined,
    totalCents: order.totalCents,
    taxCents: order.taxCents,
    refundedCents: order.refundedCents,
    currency: order.currency,
    paidAt: order.paidAt?.toISOString(),
    createdAt: order.createdAt.toISOString(),
    printfulOrderId: order.printfulOrderId ?? undefined,
    failureReason: order.failureReason ?? undefined,
    operatorReviewStatus: operatorReviewStatus(order.operatorReviewStatus),
    operatorReviewedAt: order.operatorReviewedAt?.toISOString(),
  };
}

function adminListItemFromRuntime(order: OrderSummary): AdminOrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillmentStatus: order.fulfillment.status,
    customerEmail: order.customerEmail,
    totalCents: order.totalCents,
    taxCents: order.taxCents,
    refundedCents: order.refundedCents,
    currency: order.currency,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    failureReason:
      order.status === 'failed' || order.status === 'needs_review'
        ? order.fulfillment.message
        : undefined,
    operatorReviewStatus: 'unreviewed',
  };
}

export function filterAdminOrderItems(
  items: AdminOrderListItem[],
  filters: AdminOrderFilters
): AdminOrderListItem[] {
  const limited = items.filter((item) => {
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
    )
      return false;
    return true;
  });
  return limited.slice(0, Math.min(Math.max(filters.limit ?? 50, 1), 100));
}

export async function listAdminOrderRecords(
  filters: AdminOrderFilters = {}
): Promise<AdminOrderListItem[]> {
  if (!env.databaseUrl) {
    return filterAdminOrderItems(listOrders().map(adminListItemFromRuntime), filters);
  }
  const limit = Math.min(Math.max((filters.limit ?? 50) * 3, 50), 300);
  const persisted = await prisma.order.findMany({
    include: adminOrderInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return filterAdminOrderItems(persisted.map(adminListItemFromPersisted), filters);
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | undefined> {
  if (!env.databaseUrl) {
    const order = getOrder(orderId);
    if (!order) return undefined;
    return {
      summary: adminListItemFromRuntime(order),
      order,
      paymentEvents: [],
      fulfillmentAttempts: [],
      auditTrail: [],
    };
  }
  const [order, auditRows] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, include: adminOrderInclude }),
    prisma.auditLog.findMany({
      where: { target: orderId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);
  if (!order) return undefined;
  const runtimeOrder = saveOrder(mapPersistedOrder(order));
  return {
    summary: adminListItemFromPersisted(order),
    order: runtimeOrder,
    paymentEvents: order.paymentEvents.map((event) => ({
      id: event.id,
      providerEventId: event.providerEventId ?? undefined,
      eventType: event.eventType,
      status: event.status,
      createdAt: event.createdAt.toISOString(),
    })),
    fulfillmentAttempts: order.fulfillmentAttempts.map((attempt) => ({
      id: attempt.id,
      providerOrderId: attempt.providerOrderId ?? undefined,
      status: attempt.status,
      errorMessage: attempt.errorMessage ?? undefined,
      createdAt: attempt.createdAt.toISOString(),
    })),
    auditTrail: auditRows.map((entry) => {
      const metadata = jsonObject<{ note?: unknown }>(entry.metadata, {});
      return {
        id: entry.id,
        action: entry.action,
        note: typeof metadata.note === 'string' ? metadata.note : undefined,
        createdAt: entry.createdAt.toISOString(),
      };
    }),
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
  const persisted = await prisma.order.findUnique({
    where: { id: orderId },
    include: adminOrderInclude,
  });
  if (!persisted) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
  if (persisted.printfulOrderId) {
    logOperationalEvent('info', 'printful_draft_retry_noop', {
      requestId,
      orderId,
      providerOrderId: persisted.printfulOrderId,
      outcome: 'already_attached',
    });
    const detail = await getAdminOrderDetail(orderId);
    if (!detail) throw new OrderRecoveryError('Order not found.', 404, 'order_not_found');
    return detail;
  }
  const retryBlocker = printfulRetryBlocker(persisted);
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

  const session = await retrieveStripeCheckoutSession(persisted.stripeSessionId!);
  if (!session || session.payment_status !== 'paid' || session.metadata?.orderId !== persisted.id) {
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
  const order = mapPersistedOrder(persisted);
  const recipient = stripeRecipient(session);
  const artworkUrl = await getArtworkUrl(order);
  if (!order.quote || !recipient || !artworkUrl) {
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
