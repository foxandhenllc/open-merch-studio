import { collectionPurchases } from '../collections/purchase.service.js';
import { collectionCommerceMode } from '../collections/sales.service.js';
import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
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
router.post(
  '/:id/quotes',
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).sort().join() !== 'items,layoutRevision,requestId,sessionId,version'
    )
      throw new HttpError('Invalid collection quote request.', 400);
    if (collectionCommerceMode() === 'paused')
      throw new HttpError('Ordering is currently paused.', 403, 'checkout_paused');
    const data = await collectionPurchases.create({
      sessionId: body.sessionId,
      requestId: body.requestId,
      selection: {
        collectionId: req.params.id,
        version: body.version,
        layoutRevision: body.layoutRevision,
        items: body.items,
      },
    });
    res.status(201).json({ success: true, data });
  })
);
export default router;
