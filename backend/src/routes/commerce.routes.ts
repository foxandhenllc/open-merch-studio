import { Router } from 'express';
import {
  getCheckoutOrder,
  getOrder,
  postCheckoutSession,
  postFixtureFulfillment,
  postOrderReorderDraft,
  postStudioPassCheckout,
} from '../controllers/commerce.controller.js';

const router = Router();

router.post('/studio-passes/checkout', postStudioPassCheckout);
router.post('/checkout/sessions', postCheckoutSession);
router.get('/checkout/sessions/:sessionId/order', getCheckoutOrder);
router.get('/orders/:orderId', getOrder);
router.post('/orders/:orderId/reorder-draft', postOrderReorderDraft);
router.post('/orders/:orderId/fixture-fulfillment', postFixtureFulfillment);

export default router;
