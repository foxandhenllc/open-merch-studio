import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  checkReadiness,
  createDesignDraft,
  createDesignIdea,
  createDesignMockup,
  reviseDesignDraft,
  getDesignAssetImage,
} from '../services/design.service.js';
import { getAllowanceState, getOrCreateSession } from '../services/runtime-store.js';

export const postStudioSession = asyncHandler(async (req: Request, res: Response) => {
  const session = getOrCreateSession(String(req.body?.sessionId ?? '') || undefined);
  res.status(201).json({ success: true, data: session });
});

export const getDesignAllowance = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.query.sessionId ?? req.params.sessionId ?? '');
  if (!sessionId) {
    throw new HttpError('Session ID is required.', 400);
  }
  res.json({ success: true, data: getAllowanceState(sessionId) });
});

export const postDesignIdea = asyncHandler(async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    throw new HttpError('Prompt is required.', 400);
  }
  const idea = await createDesignIdea({
    prompt,
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    productId: String(req.body?.productId ?? '') || undefined,
    placementCodes: Array.isArray(req.body?.placementCodes) ? req.body.placementCodes : [],
  });
  res.status(201).json({ success: true, data: idea });
});

export const postDesignDraft = asyncHandler(async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    throw new HttpError('Prompt is required.', 400);
  }
  const draft = await createDesignDraft(prompt, {
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    productId: String(req.body?.productId ?? '') || undefined,
    variantId: String(req.body?.variantId ?? '') || undefined,
    placementCodes: Array.isArray(req.body?.placementCodes) ? req.body.placementCodes : [],
    qualityTier: req.body?.qualityTier === 'final' ? 'final' : 'rough',
  });
  res.status(201).json({ success: true, data: draft });
});

export const postDesignRevision = asyncHandler(async (req: Request, res: Response) => {
  const draftId = String(req.params.id ?? '').trim();
  const instructions = String(req.body?.instructions ?? '').trim();
  if (!draftId || !instructions) {
    throw new HttpError('Draft ID and revision instructions are required.', 400);
  }
  const draft = await reviseDesignDraft({
    draftId,
    instructions,
    sessionId: String(req.body?.sessionId ?? '') || undefined,
  });
  res.status(201).json({ success: true, data: draft });
});

export const postReadiness = asyncHandler(async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const readiness = checkReadiness({
    prompt,
    placementCodes: Array.isArray(req.body?.placementCodes) ? req.body.placementCodes : [],
  });
  res.json({ success: true, data: readiness });
});

export const postDesignMockup = asyncHandler(async (req: Request, res: Response) => {
  const productId = String(req.body?.productId ?? '').trim();
  const variantId = String(req.body?.variantId ?? '').trim();
  const placementCodes = Array.isArray(req.body?.placementCodes) ? req.body.placementCodes : [];
  if (!productId || !variantId || !placementCodes.length) {
    throw new HttpError('Product, variant, and placement are required for mockup.', 400);
  }
  const mockup = createDesignMockup({
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    productId,
    variantId,
    placementCodes,
    designAssetId: String(req.body?.designAssetId ?? '') || undefined,
  });
  res.status(201).json({ success: true, data: mockup });
});

export const getDesignAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await getDesignAssetImage(String(req.params.assetId ?? ''));
  if (!asset) {
    throw new HttpError('Design asset not found.', 404);
  }
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(asset.buffer);
});
