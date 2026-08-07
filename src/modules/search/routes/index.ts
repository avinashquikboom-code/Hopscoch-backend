import { Router } from 'express';
import CatalogController from '../../catalog/controllers/catalog.controller';

const router = Router();

router.get('/', CatalogController.searchProducts.bind(CatalogController));
router.get('/suggestions', CatalogController.searchProducts.bind(CatalogController));

export default router;
