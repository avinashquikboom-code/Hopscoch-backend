import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import adminController from '../../admin/controllers/admin.controller';
import catalogController from '../../catalog/controllers/catalog.controller';

const router = Router();

// Sub-routes that must be registered BEFORE /:productId to avoid being caught as product IDs
router.get('/trending', catalogController.getTrendingProducts.bind(catalogController));
router.get('/new', catalogController.getNewArrivals.bind(catalogController));
router.get('/featured', catalogController.getFeaturedProducts.bind(catalogController));

// GET single product by ID
router.get('/:productId', catalogController.getProductById.bind(catalogController));

// GET all products with filters — delegate to catalog service (handles all query params, status, pagination)
router.get('/', catalogController.listProducts.bind(catalogController));

// Middleware to resolve category and brand strings to database IDs
const resolveCategoryAndBrand = async (req: any, res: any, next: any) => {
  try {
    if (req.body) {
      if (req.body.category) {
        const cat = await prisma.category.findFirst({
          where: { name: { equals: req.body.category, mode: 'insensitive' }, deletedAt: null }
        });
        if (cat) {
          req.body.categoryId = cat.id;
        } else {
          const firstCat = await prisma.category.findFirst({ where: { deletedAt: null } });
          if (firstCat) req.body.categoryId = firstCat.id;
        }
      }

      if (req.body.brand) {
        const b = await prisma.brand.findFirst({
          where: { name: { equals: req.body.brand, mode: 'insensitive' }, deletedAt: null }
        });
        if (b) {
          req.body.brandId = b.id;
        } else {
          const firstBrand = await prisma.brand.findFirst({ where: { deletedAt: null } });
          if (firstBrand) req.body.brandId = firstBrand.id;
        }
      }

      if (req.body.price !== undefined) {
        req.body.basePrice = Number(req.body.price);
      }

      if (req.body.status) {
        req.body.status = req.body.status.toUpperCase();
        if (req.body.status === 'ACTIVE') {
          req.body.status = 'PUBLISHED';
        }
      }

      if (!req.body.slug && req.body.name) {
        req.body.slug = req.body.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

// POST create product
router.post('/', authenticate, resolveCategoryAndBrand, adminController.createProduct.bind(adminController));

// PUT update product
router.put('/:productId', authenticate, resolveCategoryAndBrand, adminController.updateProduct.bind(adminController));

// DELETE delete product
router.delete('/:productId', authenticate, adminController.deleteProduct.bind(adminController));

export default router;
