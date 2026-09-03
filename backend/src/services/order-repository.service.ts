import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import type {
  AdminOrderDetail,
  AdminOrderListItem,
  MoneyLine,
  OrderSummary,
  QuoteBreakdown,
} from '../types/catalog.js';
import {
  filterAdminOrderItems,
  normalizeOperatorReviewStatus,
  persistedOrderStatus,
  restoreRuntimeOrderStatus,
  runtimeFulfillmentStatus,
  type AdminOrderFilters,
  type PrintfulRetryEligibility,
} from './order-state.service.js';
import { getOrder, getQuote, listOrders, saveOrder, saveQuote } from './runtime-store.js';

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
  quote: { include: quoteInclude },
  transitions: { orderBy: { createdAt: 'asc' } },
  shipments: { orderBy: { shippedAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type PersistedOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const adminOrderInclude = {
  ...orderInclude,
  paymentEvents: { orderBy: { createdAt: 'asc' } },
  fulfillmentAttempts: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type AdminPersistedOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

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
    placementCostCents: quote.costLines
      ? jsonArray<MoneyLine>(quote.costLines, [])
          .filter((line) => line.code === 'additional-print-areas')
          .reduce((total, line) => total + line.amountCents, 0)
      : 0,
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
          placements?: QuoteBreakdown['items'][number]['placements'];
          placementCostCents?: number;
          pricingSource?: QuoteBreakdown['items'][number]['pricingSource'];
        }>(item.options, {});
        return {
          orientation: options.orientation,
          placementTechniques: options.placementTechniques ?? {},
          placements:
            options.placements ??
            item.placementCodes.map((code) => ({
              code,
              designAssetId: item.designAssetId ?? undefined,
              technique: options.placementTechniques?.[code] ?? 'default',
              additionalCostCents: 0,
            })),
          placementCostCents: options.placementCostCents ?? 0,
          pricingSource: options.pricingSource ?? 'catalog-snapshot',
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
    policyVersion: order.policyVersion ?? undefined,
    policyAcceptedAt: order.policyAcceptedAt?.toISOString(),
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
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      status: shipment.status,
      trackingNumber: shipment.trackingNumber ?? undefined,
      trackingUrl: shipment.trackingUrl ?? undefined,
      reshipment: shipment.reshipment,
      shippedAt: shipment.shippedAt?.toISOString(),
      deliveredAt: shipment.deliveredAt?.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
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

export async function loadOrder(orderId: string): Promise<OrderSummary | undefined> {
  if (!env.databaseUrl) return getOrder(orderId);
  const persisted = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!persisted) return undefined;
  return saveOrder(mapPersistedOrder(persisted));
}

export async function loadOrderByCheckoutSession(
  stripeSessionId: string
): Promise<OrderSummary | undefined> {
  if (!env.databaseUrl) {
    return listOrders().find((candidate) => candidate.stripeSessionId === stripeSessionId);
  }
  const persisted = await prisma.order.findFirst({
    where: { stripeSessionId },
    include: orderInclude,
  });
  return persisted ? saveOrder(mapPersistedOrder(persisted)) : undefined;
}

export async function loadOrderByPaymentIntent(
  stripePaymentIntentId: string
): Promise<OrderSummary | undefined> {
  if (!env.databaseUrl) return undefined;
  const persisted = await prisma.order.findUnique({
    where: { stripePaymentIntentId },
    include: orderInclude,
  });
  return persisted ? saveOrder(mapPersistedOrder(persisted)) : undefined;
}

export async function persistOrder(
  order: OrderSummary,
  stripeSessionId?: string
): Promise<boolean> {
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
        policyVersion: order.policyVersion,
        policyAcceptedAt: order.policyAcceptedAt ? new Date(order.policyAcceptedAt) : undefined,
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
        policyVersion: order.policyVersion,
        policyAcceptedAt: order.policyAcceptedAt ? new Date(order.policyAcceptedAt) : undefined,
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
        transitions: { create: { status: order.status, note: 'Order persisted for checkout.' } },
      },
    });
    return true;
  } catch {
    return false;
  }
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
    operatorReviewStatus: normalizeOperatorReviewStatus(order.operatorReviewStatus),
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

export type FulfillmentRetryRecord = PrintfulRetryEligibility & {
  id: string;
  stripeSessionId: string | null;
  printfulOrderId: string | null;
  order: OrderSummary;
};

export async function loadFulfillmentRetryRecord(
  orderId: string
): Promise<FulfillmentRetryRecord | undefined> {
  if (!env.databaseUrl) return undefined;
  const persisted = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!persisted) return undefined;
  return {
    id: persisted.id,
    stripeSessionId: persisted.stripeSessionId,
    printfulOrderId: persisted.printfulOrderId,
    paidAt: persisted.paidAt,
    refundedCents: persisted.refundedCents,
    status: persisted.status,
    order: mapPersistedOrder(persisted),
  };
}
