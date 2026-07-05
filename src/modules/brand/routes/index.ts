import { Router } from 'express';
import adminController from '../../admin/controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

// GET all brands
router.get('/', async (req, res, next) => {
  try {
    const brands = await prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return ResponseFormatter.success(res, 'Brands retrieved successfully', brands);
  } catch (error) {
    return next(error);
  }
});

// GET single brand
router.get('/:brandId', async (req, res, next) => {
  try {
    const { brandId } = req.params;
    const brand = await prisma.brand.findUnique({
      where: { id: Number(brandId), deletedAt: null },
    });
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    return ResponseFormatter.success(res, 'Brand retrieved successfully', brand);
  } catch (error) {
    return next(error);
  }
});

// POST create brand
router.post('/', authenticate, adminController.createBrand.bind(adminController));

// PUT update brand
router.put('/:brandId', authenticate, adminController.updateBrand.bind(adminController));

// DELETE delete brand
router.delete('/:brandId', authenticate, adminController.deleteBrand.bind(adminController));

export default router;
