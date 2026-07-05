import { Router } from 'express';
import adminController from '../../admin/controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

// GET all collections
router.get('/', authenticate, async (req, res, next) => {
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
router.get('/:collectionId', authenticate, async (req, res, next) => {
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

// Middleware to translate frontend field keys to backend Prisma expectations
const translateCollectionBody = (req: any, res: any, next: any) => {
  if (req.body) {
    if (req.body.order !== undefined) {
      req.body.sortOrder = Number(req.body.order);
    }
    if (req.body.isActive !== undefined) {
      req.body.isFeatured = req.body.isActive;
    }
  }
  next();
};

// POST create collection
router.post('/', authenticate, translateCollectionBody, adminController.createCollection.bind(adminController));

// PUT update collection
router.put('/:collectionId', authenticate, translateCollectionBody, adminController.updateCollection.bind(adminController));

// DELETE delete collection
router.delete('/:collectionId', authenticate, adminController.deleteCollection.bind(adminController));

export default router;
