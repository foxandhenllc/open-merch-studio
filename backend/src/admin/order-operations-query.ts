import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { listOrders } from '../services/runtime-store.js';
import {
  normalizeOperatorReviewStatus,
  restoreRuntimeOrderStatus,
  runtimeFulfillmentStatus,
} from '../services/order-state.service.js';
import type { OperationOrder, OperationPage } from './order-operations.types.js';

const pageSize = 25;
const invalid = () => new HttpError('Use an order number and a valid order page.', 400);
export function parseOperationQuery(value: unknown) {
  const input = value as { search?: unknown; filter?: unknown; cursor?: unknown };
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !['search', 'filter', 'cursor'].includes(key)) ||
    typeof input.search !== 'string' ||
    input.search.length > 64 ||
    !/^[a-z0-9_ -]*$/i.test(input.search) ||
    !['all', 'attention'].includes(String(input.filter))
  )
    throw invalid();
  const search = input.search.trim().toUpperCase(),
    filter = input.filter as 'all' | 'attention';
  const scope = createHash('sha256').update(`${filter}|${search}`).digest('hex').slice(0, 16);
  let after: { createdAt: string; id: string } | undefined;
  if (input.cursor !== undefined) {
    if (
      typeof input.cursor !== 'string' ||
      input.cursor.length > 400 ||
      !/^[A-Za-z0-9_-]+$/.test(input.cursor)
    )
      throw invalid();
    try {
      const decoded = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
      if (
        decoded.scope !== scope ||
        typeof decoded.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(decoded.id) ||
        typeof decoded.createdAt !== 'string' ||
        new Date(decoded.createdAt).toISOString() !== decoded.createdAt
      )
        throw invalid();
      after = { id: decoded.id, createdAt: decoded.createdAt };
    } catch {
      throw invalid();
    }
  }
  return { search, filter, after, scope };
}
export const operationNeedsAttention = (order: OperationOrder) =>
  order.reviewStatus !== 'resolved' &&
  (['paid', 'failed', 'needs_review'].includes(order.status) ||
    ['failed', 'needs_review'].includes(order.fulfillmentStatus));

export async function queryOperationOrders(
  value: unknown,
  fixtureReview: (id: string) => OperationOrder['reviewStatus']
): Promise<OperationPage> {
  const input = parseOperationQuery(value);
  let rows: OperationOrder[];
  if (!env.databaseUrl) {
    rows = listOrders()
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentStatus: order.fulfillment.status,
        totalCents: order.totalCents,
        currency: order.currency,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        reviewStatus: fixtureReview(order.id),
      }))
      .filter(
        (order) =>
          order.orderNumber.toUpperCase().includes(input.search) &&
          (input.filter === 'all' || operationNeedsAttention(order)) &&
          (!input.after ||
            order.createdAt < input.after.createdAt ||
            (order.createdAt === input.after.createdAt && order.id < input.after.id))
      )
      .sort((a, b) =>
        a.createdAt === b.createdAt ? (a.id > b.id ? -1 : 1) : a.createdAt > b.createdAt ? -1 : 1
      )
      .slice(0, pageSize + 1);
  } else {
    const constraints: Prisma.OrderWhereInput[] = [];
    if (input.search)
      constraints.push({ orderNumber: { contains: input.search, mode: 'insensitive' } });
    if (input.filter === 'attention')
      constraints.push({
        operatorReviewStatus: { not: 'resolved' },
        OR: [
          { status: { in: ['PAID', 'FAILED', 'NEEDS_REVIEW'] } },
          { fulfillmentStatus: { in: ['failed', 'needs_review'] } },
        ],
      });
    if (input.after)
      constraints.push({
        OR: [
          { createdAt: { lt: new Date(input.after.createdAt) } },
          { createdAt: new Date(input.after.createdAt), id: { lt: input.after.id } },
        ],
      });
    const found = await prisma.order.findMany({
      where: { AND: constraints },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentStatus: true,
        totalCents: true,
        currency: true,
        paidAt: true,
        createdAt: true,
        operatorReviewStatus: true,
      },
    });
    rows = found.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: restoreRuntimeOrderStatus(order.status, order.fulfillmentStatus),
      fulfillmentStatus: runtimeFulfillmentStatus(order.fulfillmentStatus),
      totalCents: order.totalCents,
      currency: order.currency,
      paidAt: order.paidAt?.toISOString(),
      createdAt: order.createdAt.toISOString(),
      reviewStatus: normalizeOperatorReviewStatus(order.operatorReviewStatus),
    }));
  }
  const orders = rows.slice(0, pageSize),
    last = orders.at(-1);
  return {
    orders,
    ...(rows.length > pageSize && last
      ? {
          nextCursor: Buffer.from(
            JSON.stringify({ scope: input.scope, createdAt: last.createdAt, id: last.id })
          ).toString('base64url'),
        }
      : {}),
  };
}
