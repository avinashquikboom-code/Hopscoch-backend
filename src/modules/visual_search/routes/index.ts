import { Router } from 'express';
import VisualSearchController from '../controllers/visual-search.controller';
import { authenticate, optionalAuth } from '../../../middleware/auth';
import { upload } from '../../../middleware/upload';

const router = Router();
const visualSearchController = VisualSearchController;

// Mobile visual search endpoint
router.post(
  '/visual-search',
  optionalAuth,
  upload.single('image'),
  visualSearchController.searchVisual.bind(visualSearchController)
);

// History & deletion
router.get(
  '/visual-search/history',
  authenticate,
  visualSearchController.getHistory.bind(visualSearchController)
);

router.delete(
  '/visual-search/:queryId',
  authenticate,
  visualSearchController.deleteQuery.bind(visualSearchController)
);

export default router;
