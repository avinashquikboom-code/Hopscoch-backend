import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented
router.get('/', (req, res) => res.json({ message: 'Get addresses endpoint' }));
router.post('/', (req, res) => res.json({ message: 'Add address endpoint' }));
router.put('/:id', (req, res) => res.json({ message: 'Update address endpoint' }));
router.delete('/:id', (req, res) => res.json({ message: 'Delete address endpoint' }));

export default router;
