import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/', (req, res) => res.json({ message: 'List products endpoint' }));
router.get('/:id', (req, res) => res.json({ message: 'Get product endpoint' }));
router.get('/trending', (req, res) => res.json({ message: 'Trending products endpoint' }));
router.get('/new-arrivals', (req, res) => res.json({ message: 'New arrivals endpoint' }));

export default router;
