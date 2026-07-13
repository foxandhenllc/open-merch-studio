import { Router } from 'express';
import {
  getDesignAsset,
  getDesignDraft,
  getDesignAllowance,
  postDesignDraft,
  postDesignIdea,
  postDesignMockup,
  postDesignRevision,
  postReadiness,
  postStudioSession,
} from '../controllers/design.controller.js';

const router = Router();

router.post('/sessions', postStudioSession);
router.get('/sessions/:sessionId/allowance', getDesignAllowance);
router.get('/assets/:assetId.png', getDesignAsset);
router.post('/ideas', postDesignIdea);
router.post('/drafts', postDesignDraft);
router.get('/drafts/:id', getDesignDraft);
router.post('/drafts/:id/revisions', postDesignRevision);
router.post('/readiness', postReadiness);
router.post('/mockups', postDesignMockup);

export default router;
