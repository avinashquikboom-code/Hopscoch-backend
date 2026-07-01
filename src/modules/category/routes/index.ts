import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/', (req, res) => res.json({ message: 'List categories endpoint' }));
router.get('/:id', (req, res) => res.json({ message: 'Get category endpoint' }));

export default router;
