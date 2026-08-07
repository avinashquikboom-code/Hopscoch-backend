import { Router } from 'express';
import searchKeywordController from '../controllers/search.controller';
import CatalogController from '../../catalog/controllers/catalog.controller';
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

// Catalog search endpoints
router.get('/', CatalogController.searchProducts.bind(CatalogController));
router.get('/suggestions', CatalogController.searchProducts.bind(CatalogController));

// Public search keyword endpoints
router.get('/popular', searchKeywordController.getPopular.bind(searchKeywordController));
router.get('/trending', searchKeywordController.getTrending.bind(searchKeywordController));
router.post('/track', searchKeywordController.trackKeyword.bind(searchKeywordController));

export default router;
