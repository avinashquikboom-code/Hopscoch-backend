import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/', (req, res) => res.json({ message: 'Get notifications endpoint' }));
router.put('/:id/read', (req, res) => res.json({ message: 'Mark notification as read endpoint' }));
router.put('/read-all', (req, res) => res.json({ message: 'Mark all as read endpoint' }));

export default router;
