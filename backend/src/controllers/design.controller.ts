import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  checkReadiness,
  createDesignDraft,
  createDesignFromReferences,
  createDesignIdea,
  createDesignMockup,
  reviseDesignDraft,
  getDesignAssetImage,
  getDesignDraftById,
} from '../services/design.service.js';
import { getAllowanceState, getOrCreateDurableSession } from '../services/runtime-store.js';
import {
  authorizeArtworkUpload,
  completeArtworkUpload,
  deleteAbandonedSessionUploads,
  deleteArtworkUpload,
} from '../services/uploaded-artwork.service.js';

export const postStudioSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await getOrCreateDurableSession(String(req.body?.sessionId ?? '') || undefined);
  res.status(201).json({ success: true, data: session });
});

export const getDesignAllowance = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.query.sessionId ?? req.params.sessionId ?? '');
  if (!sessionId) {
    throw new HttpError('Session ID is required.', 400);
  }
  const session = await getOrCreateDurableSession(sessionId);
  res.json({ success: true, data: getAllowanceState(session.id) });
});

export const postUploadAuthorization = asyncHandler(async (req: Request, res: Response) => {
  const purpose = req.body?.purpose === 'reference' ? 'reference' : 'print';
  const authorization = await authorizeArtworkUpload({
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    filename: String(req.body?.filename ?? 'uploaded-artwork'),
    contentType: String(req.body?.contentType ?? ''),
    byteSize: Number(req.body?.byteSize ?? 0),
    purpose,
  });
  res.status(201).json({ success: true, data: authorization });
});

export const postUploadCompletion = asyncHandler(async (req: Request, res: Response) => {
  const draft = await completeArtworkUpload({
    assetId: String(req.params.assetId ?? ''),
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    rightsConfirmed: req.body?.rightsConfirmed === true,
    placementCodes: Array.isArray(req.body?.placementCodes) ? req.body.placementCodes : [],
    removeBackground: req.body?.removeBackground === true,
    inlineDataUrl: String(req.body?.inlineDataUrl ?? '') || undefined,
    filename: String(req.body?.filename ?? '') || undefined,
    contentType: String(req.body?.contentType ?? '') || undefined,
    purpose: req.body?.purpose === 'reference' ? 'reference' : 'print',
  });
  res.status(201).json({ success: true, data: draft });
});

export const deleteUpload = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.query.sessionId ?? '');
  if (!sessionId) throw new HttpError('Session ID is required.', 400);
  const deleted = await deleteArtworkUpload({
    assetId: String(req.params.assetId ?? ''),
    sessionId,
  });
  res.json({ success: true, data: { deleted } });
});

export const deleteSessionUploads = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId ?? '');
  if (!sessionId) throw new HttpError('Session ID is required.', 400);
  const deletedCount = await deleteAbandonedSessionUploads(sessionId);
  res.json({ success: true, data: { deletedCount } });
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

export const postReferenceDesignDraft = asyncHandler(async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const referenceAssetIds = Array.isArray(req.body?.referenceAssetIds)
    ? req.body.referenceAssetIds.map(String).filter(Boolean)
    : [];
  if (!prompt || !referenceAssetIds.length) {
    throw new HttpError('A prompt and at least one reference image are required.', 400);
  }
  const draft = await createDesignFromReferences({
    prompt,
    referenceAssetIds,
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    productId: String(req.body?.productId ?? '') || undefined,
    variantId: String(req.body?.variantId ?? '') || undefined,
    placementCodes: Array.isArray(req.body?.placementCodes) ? req.body.placementCodes : [],
  });
  res.status(201).json({ success: true, data: draft });
});

export const getDesignDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await getDesignDraftById(
    String(req.params.id ?? ''),
    String(req.query.sessionId ?? '') || undefined
  );
  if (!draft) throw new HttpError('Saved artwork is no longer available.', 404, 'draft_not_found');
  res.json({ success: true, data: draft });
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
  const placements = Array.isArray(req.body?.placements)
    ? req.body.placements
        .map((placement: unknown) => {
          if (!placement || typeof placement !== 'object') return null;
          const candidate = placement as Record<string, unknown>;
          const code = String(candidate.code ?? '').trim();
          if (!code) return null;
          const layout = ['center', 'left', 'right'].includes(String(candidate.layout))
            ? (candidate.layout as 'center' | 'left' | 'right')
            : undefined;
          return {
            code,
            designAssetId: String(candidate.designAssetId ?? '') || undefined,
            layout,
          };
        })
        .filter(Boolean)
    : undefined;
  const orientation = ['portrait', 'landscape', 'square'].includes(req.body?.orientation)
    ? req.body.orientation
    : undefined;
  if (!productId || !variantId || (!placementCodes.length && !placements?.length)) {
    throw new HttpError('Product, variant, and placement are required for mockup.', 400);
  }
  const mockup = await createDesignMockup({
    sessionId: String(req.body?.sessionId ?? '') || undefined,
    productId,
    variantId,
    placementCodes,
    placements,
    designAssetId: String(req.body?.designAssetId ?? '') || undefined,
    orientation,
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
