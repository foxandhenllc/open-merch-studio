import { Router } from 'express';
import {
  deleteSessionUploads,
  deleteUpload,
  getDesignAsset,
  getDesignDraft,
  getDesignAllowance,
  postDesignDraft,
  postDesignIdea,
  postDesignMockup,
  postDesignRevision,
  postReadiness,
  postReferenceDesignDraft,
  postStudioSession,
  postUploadAuthorization,
  postUploadCompletion,
} from '../controllers/design.controller.js';

const router = Router();

router.post('/sessions', postStudioSession);
router.get('/sessions/:sessionId/allowance', getDesignAllowance);
router.get('/assets/:assetId.png', getDesignAsset);
router.post('/uploads/authorize', postUploadAuthorization);
router.post('/uploads/:assetId/complete', postUploadCompletion);
router.delete('/uploads/:assetId', deleteUpload);
router.delete('/sessions/:sessionId/uploads', deleteSessionUploads);
router.post('/ideas', postDesignIdea);
router.post('/drafts', postDesignDraft);
router.post('/drafts/from-references', postReferenceDesignDraft);
router.get('/drafts/:id', getDesignDraft);
router.post('/drafts/:id/revisions', postDesignRevision);
router.post('/readiness', postReadiness);
router.post('/mockups', postDesignMockup);

export default router;
