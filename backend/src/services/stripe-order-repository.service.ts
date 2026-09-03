import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import type { OrderSummary } from '../types/catalog.js';
import {
  persistedOrderStatus,
  stripeEventClaimDecision,
  stripeEventStatusIsTerminal,
} from './order-state.service.js';

const analyticsTrackedStripeEvents = new Set<string>();

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

export async function persistStudioPassPurchase(sessionId: string): Promise<void> {
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

export type PaymentCompletionOptions = {
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

export async function recordPaymentCompletion(
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

export type StripeEventClaim = 'claimed' | 'duplicate' | 'busy';

export async function claimStripeEvent(
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

export async function persistCheckoutExpired(
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

export async function persistOrphanedPaymentAudit(
  orderId: string,
  stripeEventId: string,
  stripeSessionId: string
): Promise<void> {
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

export async function persistOrphanedRefundAudit(
  paymentIntentId: string,
  stripeEventId: string
): Promise<void> {
  if (!env.databaseUrl) return;
  await prisma.auditLog.create({
    data: {
      actor: 'stripe',
      action: 'stripe.refund_orphaned',
      target: paymentIntentId,
      metadata: { stripeEventId },
    },
  });
}

export async function persistStripeRefund(
  order: OrderSummary,
  providerEventId: string,
  refund: { state: 'unrefunded' | 'partial' | 'full' | 'unavailable'; refundedCents: number },
  message: string
): Promise<boolean> {
  if (!env.databaseUrl) return true;
  const fullyRefunded = refund.state === 'full';
  return prisma.$transaction(async (tx) => {
    const orderUpdate = fullyRefunded
      ? await tx.order.updateMany({
          where: {
            id: order.id,
            refundedCents: { lte: refund.refundedCents },
            OR: [{ status: { not: 'REFUNDED' } }, { refundedCents: { lt: refund.refundedCents } }],
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
        data: {
          orderId: order.id,
          status: fullyRefunded ? 'refunded' : 'needs_review',
          note: message,
        },
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
