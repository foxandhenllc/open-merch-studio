import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import type { AdminOrderDetail, OrderSummary } from '../types/catalog.js';
import { resolveDesignAssetProviderUrl } from '../utils/design-asset-url.js';
import { classifyOperationalError, logOperationalEvent } from '../utils/operational-logger.js';
import { OrderRecoveryError } from './order-recovery-error.js';
import { printfulAttemptClaimDecision, printfulRetryBlocker } from './order-state.service.js';
import { getAdminOrderDetail, loadFulfillmentRetryRecord } from './order-repository.service.js';
import { classifyPrintfulFailure, submitPrintfulDraftOrder } from './printful.service.js';
import { getDraft } from './runtime-store.js';
import {
  retrieveStripeCheckoutSession,
  retrieveStripeSessionRefundState,
} from './stripe.service.js';
import { stripeRecipient } from './stripe-order-repository.service.js';

export async function resolvePrintfulArtworkUrls(
  order: OrderSummary
): Promise<Record<string, string> | null> {
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

export async function fulfillmentOrderIsEligible(
  orderId: string,
  stripeSessionId: string
): Promise<boolean> {
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

export async function startFulfillmentAttempt(orderId: string): Promise<string | undefined> {
  if (!env.databaseUrl) return undefined;
  const activeAttempt = await prisma.fulfillmentAttempt.findFirst({
    where: { orderId, provider: 'printful', status: 'processing' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  });
  if (activeAttempt && printfulAttemptClaimDecision(activeAttempt.createdAt) === 'busy') {
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

async function blockFulfillmentAttempt(attemptId: string): Promise<void> {
  await prisma.fulfillmentAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'blocked',
      errorMessage: 'The order became ineligible before provider submission.',
    },
  });
}

async function persistRetryFailure(
  orderId: string,
  attemptId: string,
  failure: { code: string; message: string }
): Promise<void> {
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
}

async function persistRetrySuccess(params: {
  orderId: string;
  attemptId: string;
  printfulOrder: { providerOrderId: string; status: string };
  paymentState: Awaited<ReturnType<typeof retrieveStripeSessionRefundState>>;
  message: string;
}): Promise<boolean> {
  const { orderId, attemptId, printfulOrder, paymentState, message } = params;
  return prisma.$transaction(async (tx) => {
    let updateCount = 0;
    if (paymentState.state === 'full') {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'REFUNDED',
          refundedCents: paymentState.refundedCents,
          printfulOrderId: printfulOrder.providerOrderId,
          fulfillmentStatus: 'needs_review',
          failureReason: message,
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
          refundedCents: paymentState.refundedCents,
          printfulOrderId: printfulOrder.providerOrderId,
          fulfillmentStatus: 'needs_review',
          failureReason: paymentState.state === 'unrefunded' ? null : message,
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
          status: paymentState.state === 'full' ? 'refunded' : 'needs_review',
          note: message,
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
          paymentState: paymentState.state,
        },
      },
    });
    return updateCount === 1;
  });
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
  const refundState = await retrieveStripeSessionRefundState(session);
  if (refundState.state !== 'unrefunded') {
    throw new OrderRecoveryError(
      'Stripe refund state is not clear; Printful retry remains blocked for operator review.',
      409,
      refundState.state === 'unavailable' ? 'stripe_payment_not_verified' : 'payment_refunded'
    );
  }
  const order = retryRecord.order;
  const recipient = stripeRecipient(session);
  const artworkUrlsByAssetId = await resolvePrintfulArtworkUrls(order);
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
    await blockFulfillmentAttempt(attemptId);
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
    await persistRetryFailure(orderId, attemptId, failure);
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

  const postSubmissionRefundState = await retrieveStripeSessionRefundState(session);
  const paymentReviewMessage =
    postSubmissionRefundState.state === 'full'
      ? `Payment was refunded while Printful draft ${printfulOrder.providerOrderId} was being created; the draft must not be confirmed.`
      : postSubmissionRefundState.state === 'partial'
        ? `Payment was partially refunded while Printful draft ${printfulOrder.providerOrderId} was being created; operator review is required.`
        : postSubmissionRefundState.state === 'unavailable'
          ? `Printful draft ${printfulOrder.providerOrderId} was created, but Stripe payment/refund state could not be reverified.`
          : `Printful draft order ${printfulOrder.providerOrderId} created for review.`;
  const orderUpdated = await persistRetrySuccess({
    orderId,
    attemptId,
    printfulOrder,
    paymentState: postSubmissionRefundState,
    message: paymentReviewMessage,
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
