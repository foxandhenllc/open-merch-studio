import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import { createDesignDraft } from '../services/design.service.js';

export const postDesignDraft = asyncHandler(async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    throw new HttpError('Prompt is required.', 400);
  }
  const draft = await createDesignDraft(prompt);
  res.status(201).json({ success: true, data: draft });
});
