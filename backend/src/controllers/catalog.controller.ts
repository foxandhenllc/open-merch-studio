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

export const getCatalogHealth = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'open-merch-studio-api',
      catalog: catalogRuntime,
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
  const quote = await createQuote(items, {
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    studioPassId: String(req.body?.studioPassId ?? '') || undefined,
  });
  res.status(201).json({ success: true, data: quote });
});
