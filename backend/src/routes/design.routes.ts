import { Router } from 'express';
import { postDesignDraft } from '../controllers/design.controller.js';

const router = Router();

router.post('/drafts', postDesignDraft);

export default router;
