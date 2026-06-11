import { Router } from 'express';
import {
  getDesignAsset,
  getDesignAllowance,
  getDesignMockup,
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
router.post('/drafts/:id/revisions', postDesignRevision);
router.post('/readiness', postReadiness);
router.get('/mockups/latest', getDesignMockup);
router.post('/mockups', postDesignMockup);

export default router;
