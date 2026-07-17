import { Router } from 'express';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import adminController from '../../admin/controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();

// GET all collections
router.get('/', async (req, res, next) => {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
    return ResponseFormatter.success(res, 'Collections retrieved successfully', collections);
  } catch (error) {
    return next(error);
  }
});

// GET single collection
router.get('/:collectionId', async (req, res, next) => {
  try {
    const { collectionId } = req.params;
    const collection = await prisma.collection.findUnique({
      where: { id: Number(collectionId) },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    return ResponseFormatter.success(res, 'Collection retrieved successfully', collection);
  } catch (error) {
    return next(error);
  }
});

// Administrative collections operations (mapped to /api/collections to match frontend)
router.post('/', authenticate, adminController.createCollection.bind(adminController));

router.put('/:collectionId', authenticate, adminController.updateCollection.bind(adminController));

router.delete('/:collectionId', authenticate, adminController.deleteCollection.bind(adminController));

export default router;
