import { Router } from 'express';
import {
  getCatalogCategories,
  getCatalogProduct,
  getCatalogProducts,
  getQuote,
  postQuote,
} from '../controllers/catalog.controller.js';

const router = Router();

router.get('/categories', getCatalogCategories);
router.get('/products', getCatalogProducts);
router.get('/products/:slug', getCatalogProduct);
router.get('/quotes/:id', getQuote);
router.post('/quotes', postQuote);

export default router;
