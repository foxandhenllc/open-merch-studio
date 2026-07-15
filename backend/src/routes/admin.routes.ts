import { Router } from 'express';
import {
  getAdminOrders,
  getAdminOrder,
  getAdminReport,
  getAdminSettings,
  getLaunchReadiness,
  patchAdminSettings,
  postAdminOrderRetry,
  postAdminOrderReview,
  postCatalogSync,
} from '../controllers/admin.controller.js';
import { requireAdminAccess } from '../middleware.js';

const router = Router();

router.use(requireAdminAccess);
router.post('/catalog/sync', postCatalogSync);
router.get('/settings', getAdminSettings);
router.patch('/settings', patchAdminSettings);
router.get('/orders', getAdminOrders);
router.get('/orders/:orderId', getAdminOrder);
router.post('/orders/:orderId/fulfillment/retry', postAdminOrderRetry);
router.post('/orders/:orderId/review', postAdminOrderReview);
router.get('/report', getAdminReport);
router.get('/launch-readiness', getLaunchReadiness);

export default router;
