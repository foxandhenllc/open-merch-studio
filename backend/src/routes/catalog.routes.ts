import { Router } from 'express';
import {
  getCatalogCategories,
  getCatalogProduct,
  getCatalogProducts,
  postQuote,
} from '../controllers/catalog.controller.js';

const router = Router();

router.get('/categories', getCatalogCategories);
router.get('/products', getCatalogProducts);
router.get('/products/:slug', getCatalogProduct);
router.post('/quotes', postQuote);

export default router;
