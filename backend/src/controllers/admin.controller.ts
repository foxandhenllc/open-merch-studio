import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware.js';
import { syncFixtureCatalog, syncPrintfulCatalog } from '../services/printful.service.js';
import { env } from '../config/env.js';
import {
  buildAdminReport,
  buildLaunchReadiness,
  getRuntimeSettings,
  listOrders,
  updateRuntimeSettings,
} from '../services/runtime-store.js';

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

export const getAdminOrders = asyncHandler(async (_req: Request, res: Response) => {
  const orders = listOrders();
  res.json({ success: true, data: orders, count: orders.length });
});

export const getAdminReport = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: buildAdminReport() });
});

export const getLaunchReadiness = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: buildLaunchReadiness() });
});
