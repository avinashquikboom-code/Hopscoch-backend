import { Router } from 'express';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

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

export default router;
