import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware.js';
import { syncFixtureCatalog, syncPrintfulCatalog } from '../services/printful.service.js';
import { env } from '../config/env.js';
import {
  buildAdminReport,
  buildLaunchReadiness,
  getRuntimeSettings,
  updateRuntimeSettings,
} from '../services/runtime-store.js';
import {
  getAdminOrderDetail,
  listAdminOrderRecords,
  OrderRecoveryError,
  retryPrintfulDraftOrder,
  reviewAdminOrder,
} from '../services/order.service.js';
import type { AdminOrderFilters } from '../services/order.service.js';
import type { OperatorReviewStatus, OrderSummary } from '../types/catalog.js';
import { HttpError } from '../middleware.js';
import { revokeCustomerOrderAccess } from '../services/customer-order-access.service.js';
import { logOperationalEvent } from '../utils/operational-logger.js';

const orderStatuses = new Set<OrderSummary['status']>([
  'draft',
  'quoted',
  'checkout_pending',
  'paid',
  'fulfillment_validating',
  'submitted',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'failed',
  'needs_review',
]);
const fulfillmentStatuses = new Set<string>([
  'not_submitted',
  'validated',
  'submitted',
  'failed',
  'needs_review',
] as const);
const attentionFilters = new Set<string>(['failed', 'needs_review', 'missing_printful']);
const reviewStatuses = new Set<OperatorReviewStatus>(['unreviewed', 'acknowledged', 'resolved']);

const scalar = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() || undefined : undefined;

function queryScalar(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = scalar(value);
  if (!parsed) throw new HttpError(`${label} must be a single value.`, 400, 'invalid_query');
  return parsed;
}

function validOrderId(value: unknown): string {
  const orderId = scalar(value);
  if (!orderId || !/^[A-Za-z0-9_-]{1,100}$/.test(orderId)) {
    throw new HttpError('A valid order ID is required.', 400, 'invalid_order_id');
  }
  return orderId;
}

function recoveryHttpError(error: unknown): never {
  if (error instanceof OrderRecoveryError) {
    throw new HttpError(error.message, error.statusCode, error.errorCode);
  }
  throw error;
}

export const postCatalogSync = asyncHandler(async (_req: Request, res: Response) => {
  if (!env.printfulApiKey) {
    const result = await syncFixtureCatalog();
    res.status(202).json({ success: true, data: result });
    return;
  }
  const result = await syncPrintfulCatalog();
  res.status(202).json({ success: true, data: result });
});

export const getAdminSettings = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: getRuntimeSettings() });
});

export const patchAdminSettings = asyncHandler(async (req: Request, res: Response) => {
  const allowedKeys = new Set(Object.keys(getRuntimeSettings()));
  const patch = Object.fromEntries(
    Object.entries(req.body ?? {}).filter(([key]) => allowedKeys.has(key))
  );
  const result = updateRuntimeSettings(patch);
  res.json({ success: true, data: result });
});

export const getAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = queryScalar(req.query.status, 'Order status');
  const fulfillmentStatus = queryScalar(req.query.fulfillmentStatus, 'Fulfillment status');
  const attention = queryScalar(req.query.attention, 'Attention filter');
  const reviewStatus = queryScalar(req.query.reviewStatus, 'Review status');
  const limitValue = queryScalar(req.query.limit, 'Order limit');
  if (status && !orderStatuses.has(status as OrderSummary['status'])) {
    throw new HttpError('Invalid order status filter.', 400, 'invalid_order_status');
  }
  if (fulfillmentStatus && !fulfillmentStatuses.has(fulfillmentStatus)) {
    throw new HttpError('Invalid fulfillment status filter.', 400, 'invalid_fulfillment_status');
  }
  if (attention && !attentionFilters.has(attention)) {
    throw new HttpError('Invalid attention filter.', 400, 'invalid_attention_filter');
  }
  if (reviewStatus && !reviewStatuses.has(reviewStatus as OperatorReviewStatus)) {
    throw new HttpError('Invalid review status filter.', 400, 'invalid_review_status');
  }
  if (limitValue && !/^\d{1,3}$/.test(limitValue)) {
    throw new HttpError('Invalid order limit.', 400, 'invalid_order_limit');
  }
  const filters: AdminOrderFilters = {
    status: status as AdminOrderFilters['status'],
    fulfillmentStatus: fulfillmentStatus as AdminOrderFilters['fulfillmentStatus'],
    attention: attention as AdminOrderFilters['attention'],
    reviewStatus: reviewStatus as AdminOrderFilters['reviewStatus'],
    limit: limitValue ? Number(limitValue) : undefined,
  };
  const orders = await listAdminOrderRecords(filters);
  res.json({ success: true, data: orders, count: orders.length });
});

export const getAdminOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = validOrderId(req.params.orderId);
  const detail = await getAdminOrderDetail(orderId);
  if (!detail) throw new HttpError('Order not found.', 404, 'order_not_found');
  res.json({ success: true, data: detail });
});

export const postAdminOrderRetry = asyncHandler(async (req: Request, res: Response) => {
  const orderId = validOrderId(req.params.orderId);
  try {
    const detail = await retryPrintfulDraftOrder(orderId, String(res.locals.requestId ?? ''));
    res.json({ success: true, data: detail });
  } catch (error) {
    recoveryHttpError(error);
  }
});

export const postAdminOrderReview = asyncHandler(async (req: Request, res: Response) => {
  const orderId = validOrderId(req.params.orderId);
  const status = scalar(req.body?.status);
  if (status !== 'acknowledged' && status !== 'resolved') {
    throw new HttpError(
      'Review status must be acknowledged or resolved.',
      400,
      'invalid_review_status'
    );
  }
  const note = scalar(req.body?.note);
  const noteHasControlCharacters = [...(note ?? '')].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  });
  if (note && (note.length > 500 || noteHasControlCharacters)) {
    throw new HttpError('Review note is invalid or too long.', 400, 'invalid_review_note');
  }
  if (status === 'resolved' && !note) {
    throw new HttpError(
      'A resolution note is required before an operator issue can be marked resolved.',
      400,
      'resolution_note_required'
    );
  }
  try {
    const detail = await reviewAdminOrder(
      orderId,
      status,
      note,
      String(res.locals.requestId ?? '')
    );
    res.json({ success: true, data: detail });
  } catch (error) {
    recoveryHttpError(error);
  }
});

export const postAdminOrderAccessRevoke = asyncHandler(async (req: Request, res: Response) => {
  const orderId = validOrderId(req.params.orderId);
  const detail = await getAdminOrderDetail(orderId);
  if (!detail) throw new HttpError('Order not found.', 404, 'order_not_found');
  const revoked = await revokeCustomerOrderAccess(orderId);
  logOperationalEvent('info', 'customer_order_access_revoked', {
    orderId,
    requestId: String(res.locals.requestId ?? ''),
    outcome: revoked > 0 ? 'revoked' : 'no_active_grant',
  });
  res.json({ success: true, data: { orderId, revoked } });
});

export const getAdminReport = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: buildAdminReport() });
});

export const getLaunchReadiness = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: buildLaunchReadiness() });
});
