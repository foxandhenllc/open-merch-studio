import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  catalogRuntime,
  createQuote,
  getProductBySlug,
  listCategories,
  listProducts,
} from '../services/catalog.service.js';
import type { QuoteLineInput } from '../types/catalog.js';
import { getQuoteById } from '../services/order.service.js';
import { env } from '../config/env.js';
import { MAX_QUOTE_ITEM_QUANTITY, validateQuoteItemQuantity } from '../services/pricing.service.js';

export const getCatalogHealth = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'open-merch-studio-api',
      catalog: catalogRuntime,
      capabilities: {
        ai:
          env.openaiApiKey && env.enableLiveOpenAi
            ? 'live'
            : env.openaiApiKey
              ? 'available'
              : 'demo',
        checkout:
          env.stripeSecretKey?.startsWith('sk_test_') && env.enableLiveStripe
            ? 'test'
            : env.stripeSecretKey &&
                env.enableLiveStripe &&
                env.checkoutEnabled &&
                env.allowLivePayments &&
                env.checkoutAccessMode !== 'closed'
              ? 'live'
              : env.stripeSecretKey
                ? 'available'
                : 'demo',
        fulfillment:
          env.printfulApiKey &&
          env.enableLivePrintful &&
          env.fulfillmentEnabled &&
          env.allowLiveFulfillment
            ? 'live'
            : env.printfulApiKey
              ? 'available'
              : 'demo',
      },
    },
  });
});

export const getCatalogCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listCategories();
  res.json({ success: true, data: categories, count: categories.length });
});

export const getCatalogProducts = asyncHandler(async (req: Request, res: Response) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const products = await listProducts({ category, q });
  res.json({ success: true, data: products, count: products.length });
});

export const getCatalogProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await getProductBySlug(req.params.slug);
  if (!product) {
    throw new HttpError('Product not found', 404);
  }
  res.json({ success: true, data: product });
});

export const postQuote = asyncHandler(async (req: Request, res: Response) => {
  const items = req.body?.items as QuoteLineInput[] | undefined;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError('Quote requires at least one item.', 400);
  }
  try {
    items.forEach((item) => validateQuoteItemQuantity(item.quantity));
  } catch {
    throw new HttpError(
      `Each quantity must be a whole number from 1 to ${MAX_QUOTE_ITEM_QUANTITY}.`,
      400
    );
  }
  const quote = await createQuote(items, {
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    studioPassId: String(req.body?.studioPassId ?? '') || undefined,
  });
  res.status(201).json({ success: true, data: quote });
});

export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await getQuoteById(String(req.params.id ?? ''));
  if (!quote) throw new HttpError('Saved price estimate is no longer available.', 404);
  res.json({ success: true, data: quote });
});
