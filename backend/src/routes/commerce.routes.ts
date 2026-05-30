import { Router } from 'express';
import {
  getOrder,
  postCheckoutSession,
  postFixtureFulfillment,
  postStudioPassCheckout,
} from '../controllers/commerce.controller.js';

const router = Router();

router.post('/studio-passes/checkout', postStudioPassCheckout);
router.post('/checkout/sessions', postCheckoutSession);
router.get('/orders/:orderId', getOrder);
router.post('/orders/:orderId/fixture-fulfillment', postFixtureFulfillment);

export default router;
