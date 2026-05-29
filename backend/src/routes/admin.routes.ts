import { Router } from 'express';
import { postCatalogSync } from '../controllers/admin.controller.js';

const router = Router();

router.post('/catalog/sync', postCatalogSync);

export default router;
