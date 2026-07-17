import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  createCheckoutSession,
  createStudioPassCheckout,
  getOrderByCheckoutSession,
  getOrderSummary,
  handleStripeChargeRefunded,
  handleStripeCheckoutCompleted,
  markStripeEventTracked,
  handleStripeCheckoutExpired,
  submitFixtureFulfillment,
  wasStripeEventProcessed,
} from '../services/order.service.js';
import { constructStripeWebhookEvent } from '../services/stripe.service.js';
import {
  toCustomerCheckoutConfirmation,
  toCustomerOrderConfirmation,
} from '../services/customer-order.service.js';
import { trackServerEvent } from '../utils/analytics.js';
import { logOperationalEvent } from '../utils/operational-logger.js';
import { env } from '../config/env.js';

export const postStudioPassCheckout = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.body?.sessionId ?? '').trim();
  if (!sessionId) {
    throw new HttpError('Session ID is required for Studio Pass checkout.', 400);
  }
  const checkout = await createStudioPassCheckout(
    sessionId,
    String(req.body?.email ?? '') || undefined
  );
  res.status(201).json({ success: true, data: checkout });
});

export const postCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  const checkout = await createCheckoutSession({
    quoteId: String(req.body?.quoteId ?? '') || undefined,
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    studioPassId: String(req.body?.studioPassId ?? '') || undefined,
    email: String(req.body?.email ?? '') || undefined,
    designAssetId: String(req.body?.designAssetId ?? '') || undefined,
    policyAccepted: req.body?.policyAccepted === true,
    policyVersion: typeof req.body?.policyVersion === 'string' ? req.body.policyVersion : '',
  });
  logOperationalEvent(
    checkout.status === 'blocked' ? 'warning' : 'info',
    'checkout_session_result',
    {
      requestId: String(res.locals.requestId ?? ''),
      orderId: checkout.orderId,
      stripeSessionId: checkout.mode === 'stripe' ? checkout.id : undefined,
      outcome: checkout.status,
    }
  );
  const status = checkout.status === 'blocked' ? 200 : 201;
  res.status(status).json({ success: true, data: checkout });
});

export const postFixtureFulfillment = asyncHandler(async (req: Request, res: Response) => {
  const order = await submitFixtureFulfillment(String(req.params.orderId ?? ''));
  res.status(202).json({ success: true, data: order });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderSummary(String(req.params.orderId ?? ''));
  if (!order) {
    throw new HttpError('Order not found.', 404);
  }
  res.json({
    success: true,
    data: toCustomerOrderConfirmation(order, env.supportEmail),
  });
});

export const getCheckoutOrder = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId ?? '').trim();
  if (!sessionId.startsWith('cs_')) {
    throw new HttpError('A valid Stripe Checkout Session ID is required.', 400);
  }
  const confirmation = toCustomerCheckoutConfirmation(
    await getOrderByCheckoutSession(sessionId),
    env.supportEmail
  );
  res.status(confirmation.state === 'processing' ? 202 : 200).json({
    success: true,
    data: confirmation,
  });
});

export const postStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  let event: ReturnType<typeof constructStripeWebhookEvent>;
  try {
    event = constructStripeWebhookEvent(
      req.body as Buffer,
      req.header('stripe-signature') ?? undefined
    );
  } catch {
    throw new HttpError('Invalid Stripe webhook signature.', 400);
  }
  logOperationalEvent('info', 'stripe_webhook_received', {
    requestId: String(res.locals.requestId ?? ''),
    stripeEventId: event.id,
    outcome: event.type,
  });
  if (event.type === 'checkout.session.completed') {
    const alreadyProcessed = await wasStripeEventProcessed(event.id);
    const order = await handleStripeCheckoutCompleted(event.data.object, event.id);
    if (order && !alreadyProcessed) {
      await trackServerEvent(
        'purchase_completed',
        { currency: order.currency.toLowerCase(), value: order.totalCents / 100 },
        req.headers
      );
      markStripeEventTracked(event.id);
    }
  } else if (event.type === 'checkout.session.expired') {
    await handleStripeCheckoutExpired(event.data.object, event.id);
  } else if (event.type === 'charge.refunded') {
    await handleStripeChargeRefunded(event.data.object, event.id);
  }
  logOperationalEvent('info', 'stripe_webhook_processed', {
    requestId: String(res.locals.requestId ?? ''),
    stripeEventId: event.id,
    outcome: event.type,
  });
  res.json({ received: true });
});
