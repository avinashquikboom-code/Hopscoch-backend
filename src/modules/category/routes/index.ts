import { Router } from 'express';
import adminController from '../../admin/controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

// GET all categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        parent: true,
        children: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
    return ResponseFormatter.success(res, 'Categories retrieved successfully', categories);
  } catch (error) {
    return next(error);
  }
});

// GET single category
router.get('/:categoryId', async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const category = await prisma.category.findUnique({
      where: { id: Number(categoryId), deletedAt: null },
      include: {
        parent: true,
        children: true,
      },
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    return ResponseFormatter.success(res, 'Category retrieved successfully', category);
  } catch (error) {
    return next(error);
  }
});

// Middleware to translate frontend field keys to backend Prisma expectations
const translateCategoryBody = (req: any, res: any, next: any) => {
  if (req.body) {
    if (req.body.order !== undefined) {
      req.body.sortOrder = Number(req.body.order);
    }
    if (req.body.isVisible !== undefined) {
      req.body.isFeatured = req.body.isVisible;
    }
  }
  next();
};

// POST create category
router.post('/', authenticate, translateCategoryBody, adminController.createCategory.bind(adminController));

// PUT update category
router.put('/:categoryId', authenticate, translateCategoryBody, adminController.updateCategory.bind(adminController));

// DELETE delete category
router.delete('/:categoryId', authenticate, adminController.deleteCategory.bind(adminController));

// POST create subcategory under parentId
router.post('/:parentId/children', authenticate, translateCategoryBody, (req, res, next) => {
  req.body.parentId = Number(req.params.parentId);
  return adminController.createCategory(req, res).catch(next);
});

export default router;
