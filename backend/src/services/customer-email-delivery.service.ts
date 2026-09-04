import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import type { OrderSummary } from '../types/catalog.js';
import { logOperationalEvent } from '../utils/operational-logger.js';
import { toCustomerOrderConfirmation } from './customer-order.service.js';
import { renderCustomerEmail, type CustomerEmailKind } from './customer-email-template.service.js';
import {
  issueCustomerOrderAccess,
  revokeCustomerOrderAccessToken,
} from './customer-order-access.service.js';
import { customerOrderRevisitUrl } from './customer-order-revisit.service.js';

export type CustomerEmailDeliveryResult =
  | 'skipped'
  | 'queued'
  | 'sent'
  | 'duplicate'
  | 'failed'
  | 'ambiguous';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxErrorLength = 500;

const errorText = (value: unknown): string =>
  (value instanceof Error ? value.message : String(value)).slice(0, maxErrorLength);

async function findOrCreateDelivery(
  order: OrderSummary,
  kind: CustomerEmailKind,
  eventKey: string,
  recipientEmail: string
) {
  try {
    return await prisma.customerEmailDelivery.create({
      data: {
        orderId: order.id,
        eventKey,
        kind,
        recipientEmail,
        provider: env.emailProvider,
        status: 'pending',
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    return prisma.customerEmailDelivery.findUniqueOrThrow({ where: { eventKey } });
  }
}

async function markDelivery(
  id: string,
  status: string,
  values: { providerMessageId?: string; lastError?: string; sentAt?: Date } = {}
): Promise<void> {
  await prisma.customerEmailDelivery.update({
    where: { id },
    data: {
      status,
      providerMessageId: values.providerMessageId,
      lastError: values.lastError,
      sentAt: values.sentAt,
    },
  });
}

export async function deliverCustomerEmail(
  order: OrderSummary,
  kind: CustomerEmailKind,
  eventKey: string
): Promise<CustomerEmailDeliveryResult> {
  const recipientEmail = order.customerEmail?.trim().toLowerCase();
  if (!env.databaseUrl || !recipientEmail || !emailPattern.test(recipientEmail)) return 'skipped';

  const delivery = await findOrCreateDelivery(order, kind, eventKey, recipientEmail);
  if (
    delivery.status === 'sent' ||
    delivery.status === 'sending' ||
    delivery.status === 'ambiguous'
  ) {
    return 'duplicate';
  }

  if (!env.transactionalEmailsEnabled) {
    if (delivery.status !== 'queued') await markDelivery(delivery.id, 'queued');
    return 'queued';
  }

  if (env.emailProvider === 'fixture') {
    await prisma.customerEmailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'sent',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        sentAt: new Date(),
      },
    });
    return 'sent';
  }

  if (!env.resendApiKey || !env.emailFrom) {
    await markDelivery(delivery.id, 'failed', {
      lastError:
        'Transactional email is enabled but the Resend sender configuration is incomplete.',
    });
    return 'failed';
  }

  const claimed = await prisma.customerEmailDelivery.updateMany({
    where: { id: delivery.id, status: { in: ['pending', 'queued', 'failed'] } },
    data: {
      status: 'sending',
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
  if (claimed.count !== 1) return 'duplicate';

  // Issue the durable link only after this worker owns the exactly-once delivery claim. The raw
  // credential exists only in memory and is never written to the delivery ledger or logs.
  let emailAccess;
  let rendered;
  try {
    emailAccess =
      kind === 'order_received'
        ? await issueCustomerOrderAccess(order.id, 'email_order_received')
        : undefined;
    rendered = renderCustomerEmail(
      kind,
      toCustomerOrderConfirmation(order, env.supportEmail),
      emailAccess ? { orderUrl: customerOrderRevisitUrl(env.frontendUrl, emailAccess) } : undefined
    );
  } catch (error) {
    if (emailAccess) await revokeCustomerOrderAccessToken(order.id, emailAccess.token);
    await markDelivery(delivery.id, 'failed', { lastError: errorText(error) });
    return 'failed';
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': eventKey,
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [recipientEmail],
        reply_to: env.emailReplyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: unknown; message?: unknown };
    if (!response.ok) {
      if (emailAccess) {
        await revokeCustomerOrderAccessToken(order.id, emailAccess.token);
      }
      await markDelivery(delivery.id, 'failed', {
        lastError:
          `Resend HTTP ${response.status}: ${String(body.message ?? 'request rejected')}`.slice(
            0,
            maxErrorLength
          ),
      });
      return 'failed';
    }
    const providerMessageId = typeof body.id === 'string' ? body.id : undefined;
    await markDelivery(delivery.id, 'sent', { providerMessageId, sentAt: new Date() });
    return 'sent';
  } catch (error) {
    // The provider may have accepted the request before the network failed. Do not
    // automatically retry an ambiguous result; an operator can reconcile it safely.
    await markDelivery(delivery.id, 'ambiguous', { lastError: errorText(error) });
    return 'ambiguous';
  }
}

export async function safelyDeliverCustomerEmail(
  order: OrderSummary,
  kind: CustomerEmailKind,
  eventKey: string
): Promise<CustomerEmailDeliveryResult> {
  try {
    const result = await deliverCustomerEmail(order, kind, eventKey);
    logOperationalEvent(
      result === 'failed' || result === 'ambiguous' ? 'warning' : 'info',
      'customer_email_result',
      {
        orderId: order.id,
        outcome: `${kind}:${result}`,
      }
    );
    return result;
  } catch (error) {
    logOperationalEvent('error', 'customer_email_result', {
      orderId: order.id,
      outcome: `${kind}:failed`,
      failureCode: errorText(error),
    });
    return 'failed';
  }
}
