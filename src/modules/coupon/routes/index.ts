import { Router } from 'express';
import adminController from '../../admin/controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

// GET all coupons (admin ledger)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return ResponseFormatter.success(res, 'Coupons retrieved successfully', coupons);
  } catch (error) {
    return next(error);
  }
});

// GET single coupon
router.get('/:couponId', authenticate, async (req, res, next) => {
  try {
    const { couponId } = req.params;
    const coupon = await prisma.coupon.findUnique({
      where: { id: Number(couponId) }
    });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    return ResponseFormatter.success(res, 'Coupon retrieved successfully', coupon);
  } catch (error) {
    return next(error);
  }
});

// Middleware to translate frontend field keys to backend Prisma expectations
const translateCouponBody = (req: any, res: any, next: any) => {
  if (req.body) {
    if (req.body.type) {
      let mappedType = req.body.type.toUpperCase();
      if (mappedType === 'FIXED') {
        mappedType = 'FLAT';
      }
      req.body.type = mappedType;
    }
    if (req.body.value !== undefined) {
      req.body.value = Number(req.body.value);
    }
    if (req.body.minimumOrder !== undefined) {
      req.body.minOrderValue = Number(req.body.minimumOrder);
    }
    if (req.body.maximumDiscount !== undefined) {
      req.body.maxDiscount = req.body.maximumDiscount ? Number(req.body.maximumDiscount) : null;
    }
    if (req.body.expiryDate !== undefined) {
      req.body.expiresAt = new Date(req.body.expiryDate);
    }
    if (!req.body.startsAt) {
      req.body.startsAt = new Date();
    }
  }
  next();
};

// POST create coupon
router.post('/', authenticate, translateCouponBody, adminController.createCoupon.bind(adminController));

// PUT update coupon
router.put('/:couponId', authenticate, translateCouponBody, adminController.updateCoupon.bind(adminController));

// DELETE delete coupon
router.delete('/:couponId', authenticate, adminController.deleteCoupon.bind(adminController));

// Legacy/Placeholders
router.post('/validate', (req, res) => res.json({ message: 'Validate coupon endpoint' }));
router.post('/apply', (req, res) => res.json({ message: 'Apply coupon endpoint' }));

export default router;
