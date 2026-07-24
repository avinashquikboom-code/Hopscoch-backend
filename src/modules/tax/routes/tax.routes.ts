import { Router } from 'express';
import { taxController } from '../controllers/tax.controller';
import { validateCreateTaxMiddleware, validateUpdateTaxMiddleware } from '../middleware/tax.middleware';
import { authenticate } from '../../../middleware/auth';

const router = Router();

// Public / Authenticated read routes
router.get('/', taxController.getTaxList.bind(taxController));
router.get('/:id', taxController.getTax.bind(taxController));

// Admin management routes
router.post('/', authenticate, validateCreateTaxMiddleware, taxController.createTax.bind(taxController));
router.put('/:id', authenticate, validateUpdateTaxMiddleware, taxController.updateTax.bind(taxController));
router.delete('/:id', authenticate, taxController.deleteTax.bind(taxController));

// Bulk Operations
router.post('/bulk', authenticate, taxController.bulkAction.bind(taxController));

// Product Integration endpoints
router.post('/assign-product', authenticate, taxController.assignProductTax.bind(taxController));
router.post('/remove-product', authenticate, taxController.removeProductTax.bind(taxController));

export default router;
