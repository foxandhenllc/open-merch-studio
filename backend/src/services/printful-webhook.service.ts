import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { OrderStatus, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { logOperationalEvent } from '../utils/operational-logger.js';
import { safelyDeliverCustomerEmail } from './customer-email-delivery.service.js';
import { getOrderSummary } from './order.service.js';

type PrintfulShipmentEventType = 'shipment_sent' | 'shipment_delivered';

export type ParsedPrintfulShipmentEvent = {
  type: PrintfulShipmentEventType;
  occurredAt: Date;
  storeId: string;
  shipment: {
    id: string;
    status: string;
    trackingNumber?: string;
    trackingUrl?: string;
    reshipment: boolean;
    shippedAt?: Date;
    deliveredAt?: Date;
  };
  order: {
    externalId: string;
  };
};

export class PrintfulWebhookInputError extends Error {}

const objectValue = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const dateValue = (value: unknown): Date | undefined => {
  const string = stringValue(value);
  if (!string) return undefined;
  const date = new Date(string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const safeHttpUrl = (value: unknown): string | undefined => {
  const string = stringValue(value);
  if (!string) return undefined;
  try {
    const url = new URL(string);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export function verifyPrintfulWebhookSignature(
  rawBody: Buffer,
  publicKeyHeader: string | undefined,
  signatureHeader: string | undefined,
  expectedPublicKey: string | undefined,
  secretHex: string | undefined
): boolean {
  if (!publicKeyHeader || !signatureHeader || !expectedPublicKey || !secretHex) return false;
  if (!/^[a-f\d]+$/i.test(secretHex) || secretHex.length % 2 !== 0) return false;
  if (!/^[a-f\d]{64}$/i.test(signatureHeader)) return false;

  const receivedKey = Buffer.from(publicKeyHeader);
  const configuredKey = Buffer.from(expectedPublicKey);
  if (receivedKey.length !== configuredKey.length || !timingSafeEqual(receivedKey, configuredKey)) {
    return false;
  }

  const expectedSignature = createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(rawBody)
    .digest();
  const receivedSignature = Buffer.from(signatureHeader, 'hex');
  return (
    receivedSignature.length === expectedSignature.length &&
    timingSafeEqual(receivedSignature, expectedSignature)
  );
}

export function parsePrintfulShipmentEvent(rawBody: Buffer): ParsedPrintfulShipmentEvent | null {
  let body: Record<string, unknown>;
  try {
    body = objectValue(JSON.parse(rawBody.toString('utf8'))) ?? {};
  } catch {
    throw new PrintfulWebhookInputError('Printful webhook body is not valid JSON.');
  }
  const type = stringValue(body.type);
  if (type !== 'shipment_sent' && type !== 'shipment_delivered') return null;
  const data = objectValue(body.data);
  const shipment = objectValue(data?.shipment);
  const order = objectValue(data?.order);
  const occurredAt = dateValue(body.occurred_at);
  const storeId = stringValue(body.store_id);
  const shipmentId = stringValue(shipment?.id);
  const externalId = stringValue(order?.external_id);
  if (!data || !shipment || !order || !occurredAt || !storeId || !shipmentId || !externalId) {
    throw new PrintfulWebhookInputError('Printful shipment webhook is missing required fields.');
  }

  return {
    type,
    occurredAt,
    storeId,
    shipment: {
      id: shipmentId,
      status:
        stringValue(shipment.status) ?? (type === 'shipment_delivered' ? 'delivered' : 'shipped'),
      trackingNumber: stringValue(shipment.tracking_number),
      trackingUrl: safeHttpUrl(shipment.tracking_url),
      reshipment: shipment.reshipment === true,
      shippedAt: dateValue(shipment.shipped_at),
      deliveredAt: dateValue(shipment.delivered_at),
    },
    order: { externalId },
  };
}

// Printful increments the top-level `retries` field when redelivering an event,
// so hashing the raw body would defeat deduplication. These provider fields
// identify the same shipment transition across retries without storing payloads.
export const printfulEventIdempotencyHash = (event: ParsedPrintfulShipmentEvent): string =>
  createHash('sha256')
    .update(`${event.type}|${event.storeId}|${event.shipment.id}|${event.occurredAt.toISOString()}`)
    .digest('hex');
const keyFingerprint = (publicKey: string): string =>
  createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

export async function processPrintfulWebhook(
  rawBody: Buffer,
  publicKeyHeader: string | undefined
): Promise<'processed' | 'duplicate' | 'ignored'> {
  const event = parsePrintfulShipmentEvent(rawBody);
  if (!event) return 'ignored';
  if (!env.databaseUrl) throw new Error('Durable database is required for Printful webhooks.');
  if (env.printfulStoreId && event.storeId !== env.printfulStoreId) {
    throw new PrintfulWebhookInputError('Printful webhook store does not match this deployment.');
  }

  const hash = printfulEventIdempotencyHash(event);
  let eventRecord;
  try {
    eventRecord = await prisma.providerWebhookEvent.create({
      data: {
        provider: 'printful',
        eventHash: hash,
        eventType: event.type,
        publicKeyFingerprint: publicKeyHeader ? keyFingerprint(publicKeyHeader) : undefined,
        storeId: event.storeId,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const existing = await prisma.providerWebhookEvent.findUniqueOrThrow({
      where: { provider_eventHash: { provider: 'printful', eventHash: hash } },
    });
    if (existing.status === 'processed') {
      if (existing.orderId) {
        const order = await getOrderSummary(existing.orderId);
        if (order) {
          await safelyDeliverCustomerEmail(
            order,
            event.type === 'shipment_delivered' ? 'shipment_delivered' : 'shipment_sent',
            `printful:${hash}:${event.type}`
          );
        }
      }
      return 'duplicate';
    }
    eventRecord = await prisma.providerWebhookEvent.update({
      where: { id: existing.id },
      data: { status: 'processing', attempts: { increment: 1 }, lastError: null },
    });
  }

  const persistedOrder = await prisma.order.findUnique({
    where: { orderNumber: event.order.externalId },
    select: { id: true, status: true },
  });
  if (!persistedOrder) {
    await prisma.providerWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { status: 'failed', lastError: 'Order external ID was not found.' },
    });
    throw new Error('Printful shipment references an unknown order.');
  }

  const existingShipment = await prisma.shipment.findUnique({
    where: {
      provider_providerShipmentId: {
        provider: 'printful',
        providerShipmentId: event.shipment.id,
      },
    },
    select: { orderId: true, deliveredAt: true },
  });
  if (existingShipment && existingShipment.orderId !== persistedOrder.id) {
    await prisma.providerWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { status: 'failed', lastError: 'Shipment ID is already attached to another order.' },
    });
    throw new Error('Printful shipment conflicts with an existing order.');
  }

  const isDelivered =
    event.type === 'shipment_delivered' ||
    Boolean(event.shipment.deliveredAt) ||
    Boolean(existingShipment?.deliveredAt);
  const nextOrderStatus: OrderStatus = isDelivered ? OrderStatus.DELIVERED : OrderStatus.SHIPPED;
  const safeOrderStatuses: OrderStatus[] = isDelivered
    ? ['PAID', 'SUBMITTED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED']
    : ['PAID', 'SUBMITTED', 'IN_PRODUCTION', 'SHIPPED'];
  const note = isDelivered
    ? 'Printful reported a delivered shipment.'
    : 'Printful reported a shipped shipment.';

  await prisma.$transaction(async (tx) => {
    await tx.shipment.upsert({
      where: {
        provider_providerShipmentId: {
          provider: 'printful',
          providerShipmentId: event.shipment.id,
        },
      },
      create: {
        orderId: persistedOrder.id,
        providerShipmentId: event.shipment.id,
        status: isDelivered ? 'delivered' : event.shipment.status,
        trackingNumber: event.shipment.trackingNumber,
        trackingUrl: event.shipment.trackingUrl,
        reshipment: event.shipment.reshipment,
        shippedAt: event.shipment.shippedAt ?? (isDelivered ? undefined : event.occurredAt),
        deliveredAt: event.shipment.deliveredAt ?? (isDelivered ? event.occurredAt : undefined),
      },
      update: {
        orderId: persistedOrder.id,
        status: isDelivered ? 'delivered' : event.shipment.status,
        trackingNumber: event.shipment.trackingNumber,
        trackingUrl: event.shipment.trackingUrl,
        reshipment: event.shipment.reshipment,
        shippedAt: event.shipment.shippedAt,
        deliveredAt: event.shipment.deliveredAt ?? (isDelivered ? event.occurredAt : undefined),
      },
    });
    const changed = await tx.order.updateMany({
      where: { id: persistedOrder.id, status: { in: safeOrderStatuses } },
      data: { status: nextOrderStatus },
    });
    if (changed.count === 1 && persistedOrder.status !== nextOrderStatus) {
      await tx.orderTransition.create({
        data: { orderId: persistedOrder.id, status: nextOrderStatus.toLowerCase(), note },
      });
    }
    await tx.providerWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { orderId: persistedOrder.id, status: 'processed', processedAt: new Date() },
    });
  });

  const order = await getOrderSummary(persistedOrder.id);
  const shouldNotify = !(event.type === 'shipment_sent' && existingShipment?.deliveredAt);
  if (order && shouldNotify) {
    await safelyDeliverCustomerEmail(
      order,
      isDelivered ? 'shipment_delivered' : 'shipment_sent',
      `printful:${hash}:${event.type}`
    );
  }
  logOperationalEvent('info', 'printful_webhook_processed', {
    orderId: persistedOrder.id,
    outcome: event.type,
  });
  return 'processed';
}
