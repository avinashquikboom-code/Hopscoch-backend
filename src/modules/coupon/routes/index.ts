import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/', (req, res) => res.json({ message: 'Get coupons endpoint' }));
router.post('/validate', (req, res) => res.json({ message: 'Validate coupon endpoint' }));
router.post('/apply', (req, res) => res.json({ message: 'Apply coupon endpoint' }));

export default router;
