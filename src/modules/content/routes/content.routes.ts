import { Router } from 'express';
import contentController from '../controllers/content.controller';
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

// Public: View policies
router.get('/policies', contentController.getPolicies.bind(contentController));
router.get('/policies/:key', contentController.getPolicyByKey.bind(contentController));

// Admin: Edit policies
router.put('/policies/:key', authenticate, authorize('ADMIN'), contentController.updatePolicy.bind(contentController));
router.post('/policies/:key', authenticate, authorize('ADMIN'), contentController.updatePolicy.bind(contentController));

export default router;
