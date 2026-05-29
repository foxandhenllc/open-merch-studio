import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import { syncPrintfulCatalog } from '../services/printful.service.js';
import { env } from '../config/env.js';

export const postCatalogSync = asyncHandler(async (_req: Request, res: Response) => {
  if (!env.printfulApiKey) {
    throw new HttpError(
      'PRINTFUL_API_KEY is not configured. Add it locally to run live catalog sync.',
      400
    );
  }
  const result = await syncPrintfulCatalog();
  res.status(202).json({ success: true, data: result });
});
