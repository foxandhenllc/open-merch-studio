import { queryOperationOrders } from './order-operations-query.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import {
  listAdminOrderRecords,
  getAdminOrderDetail,
} from '../services/order-repository.service.js';
import { reviewAdminOrder, retryPrintfulDraftOrder } from '../services/order.service.js';
import { printfulRetryBlocker } from '../services/order-state.service.js';
import type { AdminOrderListItem } from '../types/catalog.js';
import type { OperationDetail, OperationOrder } from './order-operations.types.js';

const fixtureReviews = new Map<string, OperationDetail['reviews']>();
const summary = (order: AdminOrderListItem): OperationOrder => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  fulfillmentStatus: order.fulfillmentStatus,
  totalCents: order.totalCents,
  currency: order.currency,
  paidAt: order.paidAt,
  createdAt: order.createdAt,
  reviewStatus:
    !env.databaseUrl && fixtureReviews.has(order.id)
      ? (fixtureReviews.get(order.id)!.at(-1)!.status as OperationOrder['reviewStatus'])
      : order.operatorReviewStatus,
});
export async function searchOperationOrders(input: unknown) {
  return queryOperationOrders(
    input,
    (id) =>
      (fixtureReviews.get(id)?.at(-1)?.status as OperationOrder['reviewStatus']) ?? 'unreviewed'
  );
}
export async function operationOrders() {
  return (await listAdminOrderRecords({ limit: 100 })).map(summary);
}
export async function operationDetail(id: string): Promise<OperationDetail> {
  const detail = await getAdminOrderDetail(id);
  if (!detail) throw new HttpError('Order not found.', 404);
  const quote = detail.order.quote;
  return {
    summary: summary(detail.summary),
    mode: env.databaseUrl ? 'database' : 'fixture',
    items:
      quote?.items.map((item) => ({
        title: item.title,
        variantName: item.variantName,
        quantity: item.quantity,
      })) ?? [],
    prints: quote?.collection
      ? quote.items.flatMap((item) =>
          item.placements
            .filter((area) => area.designAssetId)
            .map((area) => ({
              assetId: area.designAssetId!,
              title: item.title,
              placementCode: area.code,
            }))
        )
      : [],
    reviews: !env.databaseUrl
      ? (fixtureReviews.get(id) ?? [])
      : detail.auditTrail
          .filter((event) => /^order\.review_(acknowledged|resolved)$/.test(event.action))
          .map((event) => ({
            status: event.action.replace('order.review_', ''),
            note: event.note,
            createdAt: event.createdAt,
          })),
    retryAvailable: Boolean(
      env.databaseUrl &&
      env.enableLivePrintful &&
      env.fulfillmentEnabled &&
      env.allowLiveFulfillment &&
      !env.printfulAutoConfirmOrders &&
      !detail.summary.printfulOrderId &&
      !printfulRetryBlocker({ ...detail.order, status: detail.order.status.toUpperCase() })
    ),
  };
}
export async function recordOperationReview(id: string, status: unknown, note: unknown) {
  if (status !== 'acknowledged' && status !== 'resolved')
    throw new HttpError('Choose a review action.', 400);
  if (
    typeof note !== 'string' ||
    note.length > 500 ||
    [...note].some(
      (character) => character.charCodeAt(0) < 32 && ![9, 10, 13].includes(character.charCodeAt(0))
    ) ||
    (status === 'resolved' && !note.trim())
  )
    throw new HttpError('Add a resolution note of at most 500 characters.', 400);
  await operationDetail(id);
  if (env.databaseUrl) await reviewAdminOrder(id, status, note.trim() || undefined);
  else
    fixtureReviews.set(id, [
      ...(fixtureReviews.get(id) ?? []),
      { status, note: note.trim() || undefined, createdAt: new Date().toISOString() },
    ]);
  return operationDetail(id);
}
export async function retryOperation(id: string) {
  const detail = await operationDetail(id);
  if (!detail.retryAvailable)
    throw new HttpError(
      'This order is not eligible for draft preparation retry. Review its payment and provider status first.',
      409
    );
  try {
    await retryPrintfulDraftOrder(id);
  } catch {
    throw new HttpError(
      'Draft preparation did not complete. Refresh the order and review provider status before trying again.',
      409
    );
  }
  return operationDetail(id);
}
