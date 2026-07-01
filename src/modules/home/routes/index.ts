import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/banners', (req, res) => res.json({ message: 'Get banners endpoint' }));
router.get('/featured', (req, res) => res.json({ message: 'Get featured products endpoint' }));

export default router;
