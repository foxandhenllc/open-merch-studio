import { preparationRetention } from '../collections/retention.service.js';
import orderOperationsRoutes from './order-operations.routes.js';
import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import { env } from '../config/env.js';
import { merchantConfig } from '../generated/merchant-config.js';
import { imageModels } from './image-models.js';
import { readStoreSettings, saveStoreSettings } from './store-settings.js';
import { connectionSummaries } from './provider-connections.js';
import { deploymentSettings } from './deployment-settings.js';
import collectionArtworkRoutes from './collection-artwork.routes.js';
import collectionPublicationRoutes from './collection-publications.routes.js';
import { readCollectionDrafts, saveCollectionDrafts } from './collection-drafts.service.js';
import {
  readMerchantProfile,
  saveMerchantProfile,
  publishMerchantProfile,
} from './merchant-profile.service.js';

const router = Router();
router.use('/order-operations', orderOperationsRoutes);
router.post(
  '/preparation-retention',
  asyncHandler(async (req, res) => {
    if (
      !req.body ||
      Array.isArray(req.body) ||
      typeof req.body.clear !== 'boolean' ||
      Object.keys(req.body).some((key) => !['clear', 'cursor'].includes(key)) ||
      (req.body.cursor !== undefined && typeof req.body.cursor !== 'string')
    )
      throw new HttpError('Invalid preparation cleanup request.', 400);
    res.json({ success: true, data: await preparationRetention.run(req.body) });
  })
);

router.use('/collection-publications', collectionPublicationRoutes);
router.use('/collection-artwork', collectionArtworkRoutes);
router.get(
  '/collections',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await readCollectionDrafts() });
  })
);
router.put(
  '/collections',
  asyncHandler(async (req, res) => {
    if (
      !req.body ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some((key) => !['collections', 'revision'].includes(key))
    )
      throw new HttpError('Invalid collection draft request.', 400, 'invalid_collection_draft');
    res.json({
      success: true,
      data: await saveCollectionDrafts(req.body.collections, req.body.revision),
    });
  })
);
router.get(
  '/profile',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await readMerchantProfile() });
  })
);
router.put(
  '/profile',
  asyncHandler(async (req, res) => {
    if (
      !req.body ||
      Object.keys(req.body).some((key) => !['draft', 'revision', 'baseDigest'].includes(key))
    )
      throw new HttpError('Invalid profile request.', 400, 'invalid_profile');
    res.json({
      success: true,
      data: await saveMerchantProfile(req.body.draft, req.body.revision, req.body.baseDigest),
    });
  })
);
router.post(
  '/profile/publish',
  asyncHandler(async (req, res) => {
    if (
      !req.body ||
      Object.keys(req.body).some((key) => !['revision', 'digest', 'approved'].includes(key))
    )
      throw new HttpError('Invalid profile publication.', 400, 'invalid_profile');
    res.json({
      success: true,
      data: await publishMerchantProfile(req.body.revision, req.body.digest, req.body.approved),
    });
  })
);
router.get(
  '/setup',
  asyncHandler(async (_req, res) => {
    // Provider setup remains reachable while an initial database connection is missing or broken.
    let settings;
    try {
      settings = await readStoreSettings();
    } catch {
      settings = null;
    }
    res.json({
      success: true,
      data: {
        store: {
          name: merchantConfig.brand.displayName,
          url: merchantConfig.web.canonicalUrl,
          supportEmail: merchantConfig.operator.supportEmail,
        },
        settings,
        models: imageModels,
        connections: connectionSummaries(),
        hosting: await deploymentSettings().status(),
        commerce: {
          checkoutAccessMode: env.checkoutAccessMode,
          paymentsAuthorized: env.allowLivePayments,
          fulfillmentAuthorized: env.allowLiveFulfillment,
          autoConfirm: env.printfulAutoConfirmOrders,
        },
      },
    });
  })
);
router.patch(
  '/store-settings',
  asyncHandler(async (req, res) => {
    if (!req.body || Object.keys(req.body).some((key) => !['values', 'revision'].includes(key))) {
      throw new HttpError('Invalid settings request.', 400, 'invalid_store_settings');
    }
    res.json({ success: true, data: await saveStoreSettings(req.body.values, req.body.revision) });
  })
);
router.put(
  '/connections/:provider',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await deploymentSettings().save(req.params.provider, req.body),
    });
  })
);
router.post(
  '/deployment',
  asyncHandler(async (_req, res) => {
    res.status(202).json({ success: true, data: await deploymentSettings().redeploy() });
  })
);
export default router;
