import { Router } from 'express';
import { asyncHandler } from '../middleware.js';
import {
  publicCollections,
  publicCollection,
  publicCollectionArtwork,
} from '../admin/collection-publications.service.js';
const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noimageindex');
  next();
});
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await publicCollections() });
  })
);
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await publicCollection(req.params.id) });
  })
);
router.get(
  '/:id/versions/:version/items/:itemId/artwork/:code',
  asyncHandler(async (req, res) => {
    const file = await publicCollectionArtwork(
      req.params.id,
      req.params.version,
      req.params.itemId,
      req.params.code
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);
export default router;
