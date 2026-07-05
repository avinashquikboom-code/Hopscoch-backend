import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

// GET all reviews (moderation ledger)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    return ResponseFormatter.success(res, 'Reviews retrieved successfully', reviews);
  } catch (error) {
    return next(error);
  }
});

// PUT update review status (moderation toggle)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const review = await prisma.review.findUnique({
      where: { id: Number(id) }
    });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const updatedReview = await prisma.review.update({
      where: { id: Number(id) },
      data: {
        isReported: status === 'pending' || status === 'reported',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
          }
        },
      }
    });

    return ResponseFormatter.success(res, 'Review updated successfully', updatedReview);
  } catch (error) {
    return next(error);
  }
});

// DELETE review
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: Number(id) }
    });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await prisma.review.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() }
    });

    return ResponseFormatter.success(res, 'Review deleted successfully');
  } catch (error) {
    return next(error);
  }
});

export default router;
