import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  parsePrintfulShipmentEvent,
  PrintfulWebhookInputError,
  processPrintfulWebhook,
  verifyPrintfulWebhookSignature,
} from '../services/printful-webhook.service.js';

export const postPrintfulWebhook = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) throw new HttpError('Raw Printful webhook body is required.', 400);
  if (!env.printfulWebhookPublicKey || !env.printfulWebhookSecret) {
    throw new HttpError('Printful webhook receiver is not configured.', 503);
  }
  const publicKey = req.header('x-pf-webhook-public-key') ?? undefined;
  const signature = req.header('x-pf-webhook-signature') ?? undefined;
  if (
    !verifyPrintfulWebhookSignature(
      rawBody,
      publicKey,
      signature,
      env.printfulWebhookPublicKey,
      env.printfulWebhookSecret
    )
  ) {
    throw new HttpError('Invalid Printful webhook signature.', 400);
  }
  try {
    // Parse once here so malformed signed payloads receive a stable client error.
    parsePrintfulShipmentEvent(rawBody);
    const outcome = await processPrintfulWebhook(rawBody, publicKey);
    res.json({ received: true, outcome });
  } catch (error) {
    if (error instanceof PrintfulWebhookInputError) throw new HttpError(error.message, 400);
    throw error;
  }
});
