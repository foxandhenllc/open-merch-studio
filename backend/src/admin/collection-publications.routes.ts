import { setCollectionSales } from '../collections/sales.service.js';
import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  publicationStatus,
  prepareCollectionReview,
  publishCollection,
  withdrawCollection,
} from './collection-publications.service.js';
import { collectionSalesReadiness } from './collection-sales-readiness.js';
import {
  getCollectionPrintLayouts,
  saveCollectionPrintLayouts,
  exportCollectionPrintLayout,
} from './collection-print-layouts.js';
const router = Router();
function strictBody(body: unknown, keys: string[]) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(body, key))
  )
    throw new HttpError(
      'Invalid collection publication request.',
      400,
      'invalid_publication_request'
    );
}
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await publicationStatus() });
  })
);
router.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    strictBody(req.body, ['draftRevision', 'printWidths']);
    res.json({
      success: true,
      data: await prepareCollectionReview(
        req.params.id,
        req.body.draftRevision,
        req.body.printWidths
      ),
    });
  })
);
router.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    strictBody(req.body, [
      'draftRevision',
      'publicationRevision',
      'digest',
      'printWidths',
      'templateConfirmed',
      'contentConfirmed',
      'publicPreviewConfirmed',
    ]);
    res.json({ success: true, data: await publishCollection(req.params.id, req.body) });
  })
);
router.post(
  '/:id/withdraw',
  asyncHandler(async (req, res) => {
    strictBody(req.body, ['publicationRevision']);
    res.json({
      success: true,
      data: await withdrawCollection(req.params.id, req.body.publicationRevision),
    });
  })
);
router.post(
  '/:id/sales-readiness',
  asyncHandler(async (req, res) => {
    strictBody(req.body, ['version']);
    res.json({
      success: true,
      data: await collectionSalesReadiness(req.params.id, req.body.version),
    });
  })
);
router.get(
  '/:id/print-layouts',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await getCollectionPrintLayouts(req.params.id, Number(req.query.version)),
    });
  })
);
router.put(
  '/:id/print-layouts',
  asyncHandler(async (req, res) => {
    strictBody(req.body, ['version', 'revision', 'layouts', 'templateConfirmed']);
    res.json({ success: true, data: await saveCollectionPrintLayouts(req.params.id, req.body) });
  })
);
router.get(
  '/:id/print-layouts/:itemId/:code/:kind',
  asyncHandler(async (req, res) => {
    if (!['preview', 'export'].includes(req.params.kind))
      throw new HttpError('Print file not found.', 404);
    const bytes = await exportCollectionPrintLayout(
      req.params.id,
      Number(req.query.version),
      Number(req.query.revision),
      req.params.itemId,
      req.params.code,
      req.params.kind === 'preview'
    );
    res.type('png');
    res.setHeader(
      'Content-Disposition',
      `${req.params.kind === 'export' ? 'attachment' : 'inline'}; filename="print-layout.png"`
    );
    res.send(bytes);
  })
);
router.post(
  '/:id/sales',
  asyncHandler(async (req, res) => {
    strictBody(req.body, ['version', 'layoutRevision', 'enabled', 'reviewed']);
    res.json({ success: true, data: await setCollectionSales(req.params.id, req.body) });
  })
);
export default router;
