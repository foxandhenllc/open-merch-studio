import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import { collectionArtwork } from './collection-artwork.service.js';

const router = Router();
function body(value: unknown, keys: string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new HttpError('Invalid artwork request.', 400, 'invalid_artwork_request');
}
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await collectionArtwork.list() });
  })
);
router.post(
  '/authorize',
  asyncHandler(async (req, res) => {
    body(req.body, ['filename', 'contentType', 'byteSize', 'rightsConfirmed']);
    res.status(201).json({ success: true, data: await collectionArtwork.authorize(req.body) });
  })
);
router.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    body(req.body, ['inlineDataUrl']);
    res.json({
      success: true,
      data: await collectionArtwork.complete(req.params.id, req.body.inlineDataUrl),
    });
  })
);
router.get(
  '/:id/:kind(preview|original)',
  asyncHandler(async (req, res) => {
    const response =
      req.params.kind === 'original'
        ? await collectionArtwork.originalResponse(req.params.id)
        : { file: await collectionArtwork.binary(req.params.id) };
    if (response.downloadUrl) {
      // Return the link explicitly: redirecting a fetch could forward its custom admin header.
      res.json({ success: true, data: { downloadUrl: response.downloadUrl } });
      return;
    }
    const asset = response.file!;
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', req.params.kind === 'original' ? 'attachment' : 'inline');
    res.send(asset.buffer);
  })
);
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await collectionArtwork.remove(req.params.id) });
  })
);
export default router;
