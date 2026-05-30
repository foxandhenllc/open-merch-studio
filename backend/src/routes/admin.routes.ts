import { Router } from 'express';
import {
  getAdminOrders,
  getAdminReport,
  getAdminSettings,
  getLaunchReadiness,
  patchAdminSettings,
  postCatalogSync,
} from '../controllers/admin.controller.js';
import { requireAdminAccess } from '../middleware.js';

const router = Router();

router.use(requireAdminAccess);
router.post('/catalog/sync', postCatalogSync);
router.get('/settings', getAdminSettings);
router.patch('/settings', patchAdminSettings);
router.get('/orders', getAdminOrders);
router.get('/report', getAdminReport);
router.get('/launch-readiness', getLaunchReadiness);

export default router;
