import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import adminController from '../../admin/controllers/admin.controller';

const router = Router();

// GET all products (admin catalog ledger)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        brand: true,
        variants: {
          select: {
            stock: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedProducts = products.map(p => {
      const totalStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
      return {
        ...p,
        price: Number(p.basePrice),
        stock: totalStock,
      };
    });

    return ResponseFormatter.success(res, 'Products retrieved successfully', mappedProducts);
  } catch (error) {
    return next(error);
  }
});

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
