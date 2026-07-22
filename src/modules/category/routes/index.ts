import { Router } from 'express';
import adminController from '../../admin/controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';
import { upload } from '../../../middleware/upload';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

const toFullUrl = (url: string | null | undefined, baseUrl: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
};

// GET all categories (Top-level categories with subcategories nested in children)
router.get('/', async (req, res, next) => {
  try {
    const flat = req.query.flat === 'true';
    const whereCondition: any = { deletedAt: null };
    if (!flat) {
      whereCondition.parentId = null;
    }

    const categories = await prisma.category.findMany({
      where: whereCondition,
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    
    // Construct full URLs for images
    const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
    const categoriesWithFullUrls = categories.map((category: any) => ({
      ...category,
      iconUrl: toFullUrl(category.iconUrl, baseUrl),
      bannerUrl: toFullUrl(category.bannerUrl, baseUrl),
    }));
    
    return ResponseFormatter.success(res, 'Categories retrieved successfully', categoriesWithFullUrls);
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
    
    // Construct full URLs for images
    const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
    const categoryWithFullUrls = {
      ...category,
      iconUrl: toFullUrl(category.iconUrl, baseUrl),
      bannerUrl: toFullUrl(category.bannerUrl, baseUrl),
    };
    
    return ResponseFormatter.success(res, 'Category retrieved successfully', categoryWithFullUrls);
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

// POST create category with image upload
router.post('/icon', authenticate, upload.single('icon'), adminController.createCategory.bind(adminController));
router.post('/banner', authenticate, upload.single('banner'), adminController.createCategory.bind(adminController));
router.post('/images', authenticate, upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), adminController.createCategory.bind(adminController));
router.post('/', authenticate, translateCategoryBody, adminController.createCategory.bind(adminController));

// PUT update category with image upload
router.put('/:categoryId/icon', authenticate, upload.single('icon'), adminController.updateCategory.bind(adminController));
router.put('/:categoryId/banner', authenticate, upload.single('banner'), adminController.updateCategory.bind(adminController));
router.put('/:categoryId/images', authenticate, upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), adminController.updateCategory.bind(adminController));
router.put('/:categoryId', authenticate, translateCategoryBody, adminController.updateCategory.bind(adminController));

// DELETE delete category
router.delete('/:categoryId', authenticate, adminController.deleteCategory.bind(adminController));

// GET subcategories for a parent category
router.get('/:parentId/children', async (req, res, next) => {
  try {
    const { parentId } = req.params;
    const subcategories = await prisma.category.findMany({
      where: {
        parentId: Number(parentId),
        deletedAt: null,
      },
      orderBy: { sortOrder: 'asc' },
    });
    
    const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
    const subcategoriesWithFullUrls = subcategories.map((category: any) => ({
      ...category,
      iconUrl: toFullUrl(category.iconUrl, baseUrl),
      bannerUrl: toFullUrl(category.bannerUrl, baseUrl),
    }));
    
    return ResponseFormatter.success(res, 'Subcategories retrieved successfully', subcategoriesWithFullUrls);
  } catch (error) {
    return next(error);
  }
});

// POST create subcategory under parentId with image upload
router.post('/:parentId/children/icon', authenticate, upload.single('icon'), (req, res, next) => {
  req.body.parentId = Number(req.params.parentId);
  return adminController.createCategory(req, res).catch(next);
});
router.post('/:parentId/children/banner', authenticate, upload.single('banner'), (req, res, next) => {
  req.body.parentId = Number(req.params.parentId);
  return adminController.createCategory(req, res).catch(next);
});
router.post('/:parentId/children/images', authenticate, upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), (req, res, next) => {
  req.body.parentId = Number(req.params.parentId);
  return adminController.createCategory(req, res).catch(next);
});
router.post('/:parentId/children', authenticate, translateCategoryBody, (req, res, next) => {
  req.body.parentId = Number(req.params.parentId);
  return adminController.createCategory(req, res).catch(next);
});

export default router;
