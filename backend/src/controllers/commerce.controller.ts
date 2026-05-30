import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  createCheckoutSession,
  createStudioPassCheckout,
  getOrderSummary,
  handleStripeCheckoutCompleted,
  submitFixtureFulfillment,
} from '../services/order.service.js';
import { constructStripeWebhookEvent } from '../services/stripe.service.js';

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
  });
  const status = checkout.status === 'blocked' ? 200 : 201;
  res.status(status).json({ success: true, data: checkout });
});

export const postFixtureFulfillment = asyncHandler(async (req: Request, res: Response) => {
  const order = await submitFixtureFulfillment(String(req.params.orderId ?? ''));
  res.status(202).json({ success: true, data: order });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = getOrderSummary(String(req.params.orderId ?? ''));
  if (!order) {
    throw new HttpError('Order not found.', 404);
  }
  res.json({ success: true, data: order });
});

export const postStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const event = constructStripeWebhookEvent(
    req.body as Buffer,
    req.header('stripe-signature') ?? undefined
  );
  if (event.type === 'checkout.session.completed') {
    await handleStripeCheckoutCompleted(event.data.object);
  }
  res.json({ received: true });
});
