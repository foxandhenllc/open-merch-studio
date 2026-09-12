import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  operationOrders,
  searchOperationOrders,
  operationDetail,
  recordOperationReview,
  retryOperation,
} from './order-operations.service.js';
import { loadOrder } from '../services/order-repository.service.js';
import { collectionPurchases } from '../collections/purchase.service.js';

const router = Router();
router.param('id', (_req, _res, next, id) => {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return next(new HttpError('Order not found.', 404));
  next();
});
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await operationOrders() });
  })
);
router.post(
  '/search',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await searchOperationOrders(req.body) });
  })
);
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await operationDetail(req.params.id) });
  })
);
router.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    if (
      !req.body ||
      Array.isArray(req.body) ||
      Object.keys(req.body).sort().join() !== 'note,status'
    )
      throw new HttpError('Invalid review.', 400);
    res.json({
      success: true,
      data: await recordOperationReview(req.params.id, req.body.status, req.body.note),
    });
  })
);
router.post(
  '/:id/retry',
  asyncHandler(async (req, res) => {
    if (!req.body || Object.keys(req.body).join() !== 'confirmed' || req.body.confirmed !== true)
      throw new HttpError('Confirm draft preparation before retrying.', 400);
    res.json({ success: true, data: await retryOperation(req.params.id) });
  })
);
router.get(
  '/:id/prints/:assetId',
  asyncHandler(async (req, res) => {
    const order = await loadOrder(req.params.id);
    const file = order?.quote
      ? await collectionPurchases.operatorPrint(order.quote, req.params.assetId)
      : null;
    if (!file)
      throw new HttpError(
        'The saved print file is unavailable. Review storage before production.',
        404
      );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="order-print.png"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file);
  })
);
export default router;
