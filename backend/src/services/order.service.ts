import { env } from '../config/env.js';
import type { Prisma } from '@prisma/client';
import { getProductBySlug, listProducts } from './catalog.service.js';
import {
  buildPrintfulOrderPayload,
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
import type { CheckoutSession, MoneyLine, OrderSummary, QuoteBreakdown } from '../types/catalog.js';
import {
  canCreateStripeCheckout,
  createMerchCheckoutSession,
  createStudioPassStripeSession,
  liveStripeBlocker,
} from './stripe.service.js';
import type Stripe from 'stripe';
import { prisma } from '../config/database.js';

type CheckoutInput = {
  quoteId?: string | null;
  sessionId?: string;
  studioPassId?: string;
  email?: string;
  designAssetId?: string;
};

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

const prismaOrderStatus = (status: OrderSummary['status']) => {
  if (status === 'checkout_pending') return 'PENDING_PAYMENT';
  if (status === 'paid' || status === 'needs_review' || status === 'failed') return 'PAID';
  if (status === 'submitted' || status === 'in_production') return 'SUBMITTED';
  if (status === 'shipped' || status === 'delivered') return 'SHIPPED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'refunded') return 'REFUNDED';
  return 'DRAFT';
};

function runtimeOrderStatus(status: string): OrderSummary['status'] {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'checkout_pending';
    case 'PAID':
      return 'paid';
    case 'SUBMITTED':
      return 'submitted';
    case 'SHIPPED':
      return 'shipped';
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

async function loadQuoteForCheckout(quoteId?: string | null): Promise<QuoteBreakdown | undefined> {
  const runtimeQuote = getQuote(quoteId);
  if (runtimeQuote || !quoteId || !env.databaseUrl) return runtimeQuote;

  try {
    const persisted = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: quoteInclude,
    });
    if (!persisted) return undefined;
    return saveQuote(mapPersistedQuote(persisted));
  } catch {
    return undefined;
  }
}

function mapPersistedOrder(order: PersistedOrder): OrderSummary {
  const quote = order.quote ? mapPersistedQuote(order.quote) : undefined;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    stripeSessionId: order.stripeSessionId ?? undefined,
    status: runtimeOrderStatus(order.status),
    customerEmail: order.email ?? undefined,
    totalCents: order.totalCents,
    currency: order.currency,
    quote,
    designAssetId: quote?.items.find((item) => item.designAssetId)?.designAssetId,
    fulfillment: {
      provider: order.printfulOrderId ? 'printful' : 'printful-ready',
      status: runtimeFulfillmentStatus(order.fulfillmentStatus),
      message: order.printfulOrderId
        ? `Printful order ${order.printfulOrderId} is attached.`
        : 'Loaded from persistent checkout state.',
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
  const runtimeOrder = getOrder(orderId);
  if (runtimeOrder || !env.databaseUrl) return runtimeOrder;

  try {
    const persisted = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!persisted) return undefined;
    return saveOrder(mapPersistedOrder(persisted));
  } catch {
    return undefined;
  }
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
  const draft = getDraft(designAssetId);
  if (draft) {
    return {
      id: designAssetId,
      imageUrl: draft.imageUrl,
      generationStatus: draft.id ? 'complete' : 'failed',
      policyStatus: draft.policy.status,
      readinessStatus: draft.readiness.status,
    };
  }

  if (!env.databaseUrl) return undefined;
  try {
    const asset = await prisma.designAsset.findUnique({ where: { id: designAssetId } });
    if (!asset) return undefined;
    return {
      id: asset.id,
      imageUrl: asset.transparentUrl ?? asset.imageUrl,
      generationStatus: asset.generationStatus,
      policyStatus: asset.policyStatus,
      readinessStatus: asset.readinessStatus,
    };
  } catch {
    return undefined;
  }
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

async function persistOrder(order: OrderSummary, stripeSessionId?: string): Promise<void> {
  if (!env.databaseUrl || !order.quote?.id) return;
  try {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {
        email: order.customerEmail,
        status: prismaOrderStatus(order.status),
        stripeSessionId,
        fulfillmentStatus: order.fulfillment.status,
        totalCents: order.totalCents,
        currency: order.currency,
      },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        quoteId: order.quote.id,
        email: order.customerEmail,
        status: prismaOrderStatus(order.status),
        stripeSessionId,
        fulfillmentStatus: order.fulfillment.status,
        totalCents: order.totalCents,
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
  } catch {
    // Runtime order state remains the fallback source if persistence is unavailable.
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

async function recordPaymentCompletion(
  orderId: string,
  session: Stripe.Checkout.Session,
  fulfillmentStatus: string,
  providerEventId = session.id
): Promise<void> {
  if (!env.databaseUrl) return;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      email: session.customer_details?.email ?? undefined,
      status: 'PAID',
      stripeSessionId: session.id,
      fulfillmentStatus,
      transitions: {
        create: {
          status: 'paid',
          note: 'Stripe checkout completed.',
        },
      },
    },
  });
  await prisma.paymentEvent.upsert({
    where: {
      provider_providerEventId: {
        provider: 'stripe',
        providerEventId,
      },
    },
    update: {
      status: session.payment_status ?? 'paid',
      payload: {
        id: session.id,
        eventId: providerEventId,
        payment_status: session.payment_status,
        metadata: session.metadata,
      },
    },
    create: {
      orderId,
      provider: 'stripe',
      providerEventId,
      eventType: 'checkout.session.completed',
      status: session.payment_status ?? 'paid',
      payload: {
        id: session.id,
        eventId: providerEventId,
        payment_status: session.payment_status,
        metadata: session.metadata,
      },
    },
  });
}

export async function validateQuoteForCheckout(quote: QuoteBreakdown): Promise<string[]> {
  const issues: string[] = [];
  const products = await listProducts();
  for (const item of quote.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    if (!product) issues.push(`Product ${item.productId} is no longer sellable.`);
    if (!variant) issues.push(`Variant ${item.variantId} is no longer available.`);
    const unavailablePlacement = item.placementCodes.find(
      (placementCode) => !product?.placements.some((placement) => placement.code === placementCode)
    );
    if (unavailablePlacement) {
      issues.push(
        `Placement ${unavailablePlacement} is unavailable for ${product?.title ?? 'item'}.`
      );
    }
  }
  return issues;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
  const settings = getRuntimeSettings();
  const quote = await loadQuoteForCheckout(input.quoteId);
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
  const stripeBlocker = settings.liveStripeEnabled ? liveStripeBlocker() : null;

  const quoteIssues = await validateQuoteForCheckout(quote);
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
  await persistOrder(order);

  const pass =
    getStudioPassById(input.studioPassId) ??
    (input.sessionId ? getStudioPassForSession(input.sessionId) : undefined);
  if (pass && quote.studioPassCreditCents > 0) {
    pass.status = 'applied';
    pass.appliedOrderId = order.id;
  }

  if (settings.liveStripeEnabled && canCreateStripeCheckout()) {
    const session = await createMerchCheckoutSession({
      orderId: order.id,
      quote,
      customerEmail: input.email,
    });
    saveOrder({ ...order, stripeSessionId: session.id });
    await persistOrder(order, session.id);
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
  const settings = getRuntimeSettings();
  const stripeBlocker = settings.liveStripeEnabled ? liveStripeBlocker() : null;
  if (settings.liveStripeEnabled && stripeBlocker) {
    return {
      id: runtimeId('checkout'),
      mode: 'stripe-ready',
      status: 'blocked',
      checkoutUrl: null,
      message: stripeBlocker,
    };
  }

  if (settings.liveStripeEnabled && canCreateStripeCheckout()) {
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

function stripeRecipient(session: Stripe.Checkout.Session): {
  name: string;
  address1: string;
  city: string;
  stateCode?: string;
  countryCode: string;
  zip: string;
  email?: string;
} | null {
  const shippingDetails = (
    session as Stripe.Checkout.Session & {
      shipping_details?: {
        name?: string | null;
        address?: {
          line1?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          postal_code?: string | null;
        } | null;
      } | null;
    }
  ).shipping_details;
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
    city,
    stateCode: address?.state ?? undefined,
    countryCode,
    zip,
    email: session.customer_details?.email ?? undefined,
  };
}

function getArtworkUrl(order: OrderSummary): string | null {
  const draft = getDraft(order.designAssetId);
  if (!draft?.id || !draft.imageUrl) return null;
  if (/^https?:\/\//.test(draft.imageUrl)) return draft.imageUrl;
  if (draft.imageUrl.startsWith('data:')) {
    return `${env.backendUrl}/api/design/assets/${encodeURIComponent(draft.id)}.png`;
  }
  return null;
}

export async function handleStripeCheckoutCompleted(
  session: Stripe.Checkout.Session,
  providerEventId = session.id
): Promise<OrderSummary | undefined> {
  const kind = session.metadata?.kind;
  if (kind === 'studio_pass') {
    const sessionId = session.metadata?.sessionId;
    if (sessionId) {
      createStudioPass(sessionId, 'purchased');
      await persistStudioPassPurchase(sessionId);
    }
    return undefined;
  }

  if (kind !== 'merch_order') return undefined;
  const orderId = session.metadata?.orderId;
  if (!orderId) return undefined;
  const order = await loadOrder(orderId);
  if (!order) {
    await recordPaymentCompletion(orderId, session, 'needs_review', providerEventId).catch(
      () => undefined
    );
    return undefined;
  }

  let next = transition(order, 'paid', 'Stripe checkout completed.');
  next = {
    ...next,
    customerEmail: session.customer_details?.email ?? order.customerEmail,
  };

  if (!env.fulfillmentEnabled || !env.enableLivePrintful || !env.allowLiveFulfillment) {
    next = {
      ...next,
      fulfillment: {
        ...next.fulfillment,
        status: 'needs_review',
        message: 'Payment is complete. Real Printful fulfillment is waiting for operator approval.',
      },
    };
    await recordPaymentCompletion(next.id, session, next.fulfillment.status, providerEventId);
    return saveOrder(next);
  }

  const recipient = stripeRecipient(session);
  const artworkUrl = getArtworkUrl(next);
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
    await recordPaymentCompletion(next.id, session, next.fulfillment.status, providerEventId);
    return saveOrder(next);
  }

  try {
    next = transition(next, 'fulfillment_validating', 'Preparing Printful draft order.');
    const printfulOrder = await submitPrintfulDraftOrder({
      quote,
      orderNumber: next.orderNumber,
      recipient,
      artworkUrl,
    });
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
    await recordPaymentCompletion(next.id, session, next.fulfillment.status, providerEventId);
    if (env.databaseUrl) {
      await prisma.order.update({
        where: { id: next.id },
        data: {
          status: prismaOrderStatus(next.status),
          printfulOrderId: printfulOrder.providerOrderId,
          fulfillmentStatus: next.fulfillment.status,
          fulfillmentAttempts: {
            create: {
              provider: 'printful',
              providerOrderId: printfulOrder.providerOrderId,
              status: printfulOrder.status,
              payload: { confirmed: printfulOrder.confirmed },
            },
          },
        },
      });
    }
    return saveOrder(next);
  } catch (error) {
    next = {
      ...next,
      status: 'failed',
      fulfillment: {
        provider: 'printful-ready',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Printful fulfillment submission failed.',
      },
    };
    await recordPaymentCompletion(next.id, session, next.fulfillment.status, providerEventId);
    return saveOrder(next);
  }
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
): Promise<OrderSummary | undefined> {
  const runtimeOrder = listOrders().find(
    (candidate) => candidate.stripeSessionId === stripeSessionId
  );
  if (runtimeOrder || !env.databaseUrl) return runtimeOrder;

  try {
    const persisted = await prisma.order.findFirst({
      where: { stripeSessionId },
      include: orderInclude,
    });
    if (!persisted) return undefined;
    return saveOrder(mapPersistedOrder(persisted));
  } catch {
    return undefined;
  }
}

export async function listOrderSummaries(limit = 50): Promise<OrderSummary[]> {
  const inMemoryOrders = listOrders();
  if (inMemoryOrders.length || !env.databaseUrl) return inMemoryOrders;

  try {
    const persisted = await prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return persisted.map((order) => saveOrder(mapPersistedOrder(order)));
  } catch {
    return inMemoryOrders;
  }
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
