import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import addressController from '../controllers/address.controller';

const router = Router();

// Address Management API endpoints
router.get('/', authenticate, addressController.getAddresses.bind(addressController));
router.post('/', authenticate, addressController.createAddress.bind(addressController));
router.put('/:id', authenticate, addressController.updateAddress.bind(addressController));
router.delete('/:id', authenticate, addressController.deleteAddress.bind(addressController));
router.patch('/:id/default', authenticate, addressController.setDefaultAddress.bind(addressController));

export default router;
