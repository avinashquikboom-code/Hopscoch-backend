import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/', (req, res) => res.json({ message: 'Search products endpoint' }));
router.get('/suggestions', (req, res) => res.json({ message: 'Search suggestions endpoint' }));

export default router;
