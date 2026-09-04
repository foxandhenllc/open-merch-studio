import { Router } from 'express';
import { getPublicStorefront } from '../controllers/storefront.controller.js';

const router = Router();

router.get('/:organizationSlug/:storefrontSlug', getPublicStorefront);

export default router;
