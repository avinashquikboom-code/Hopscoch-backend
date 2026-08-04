import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import reviewService from '../services/review.service';

const router = Router();

// ────────────────────────────────────────────────────────────
// PUBLIC / CUSTOMER ENDPOINTS
// ────────────────────────────────────────────────────────────

/**
 * GET /api/reviews/product/:productId
 * Paginated public list of APPROVED reviews for a product.
 * No auth required — visible to everyone.
 */
router.get('/product/:productId', optionalAuth, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const result = await reviewService.getProductReviews(productId, page, limit);
    return ResponseFormatter.success(res, 'Reviews retrieved successfully', result);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/reviews/product/:productId/my-review?orderId=xxx
 * Check if the authenticated user has already reviewed this product (for a given order).
 * Used by mobile/website to toggle "Rate this" CTA.
 */
router.get('/product/:productId/my-review', authenticate, async (req: any, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const orderId = req.query.orderId ? Number(req.query.orderId) : undefined;
    const userId = req.user?.id || req.user?.userId;

    const review = await reviewService.getUserReviewForProduct(userId, productId, orderId);
    return ResponseFormatter.success(res, 'Review status retrieved', { reviewed: !!review, review });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reviews/product/:productId
 * Submit or edit a review. Requires auth + verified purchase.
 * Body: { rating: 1-5, title?, comment?, orderId? }
 */
router.post('/product/:productId', authenticate, async (req: any, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const userId = req.user?.id || req.user?.userId;
    const { rating, title, comment, orderId } = req.body;

    if (!rating) {
      return res.status(400).json({ success: false, message: 'rating is required' });
    }

    const result = await reviewService.submitReview(userId, productId, {
      rating: Number(rating),
      title,
      comment,
      orderId: orderId ? Number(orderId) : undefined,
    });

    const statusCode = result.action === 'created' ? 201 : 200;
    const message = result.action === 'created' ? 'Review submitted successfully' : 'Review updated successfully';
    return res.status(statusCode).json({ success: true, message, data: result.review });
  } catch (error) {
    return next(error);
  }
});

// ────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS (mounted at /api/reviews)
// ────────────────────────────────────────────────────────────

/**
 * GET /api/reviews
 * Admin: list all reviews with filters (?productId, ?rating, ?status, ?page, ?limit)
 */
router.get('/', authenticate, async (req: any, res, next) => {
  try {
    const filters = {
      productId: req.query.productId ? Number(req.query.productId) : undefined,
      rating: req.query.rating ? Number(req.query.rating) : undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };
    const result = await reviewService.adminListReviews(filters);
    return ResponseFormatter.success(res, 'Reviews retrieved successfully', result.reviews, result.pagination as any);
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/reviews/:id
 * Admin: toggle review visibility — body: { status: 'APPROVED' | 'REJECTED' }
 */
router.patch('/:id', authenticate, async (req: any, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'APPROVED' or 'REJECTED'" });
    }

    const updated = await reviewService.updateReviewStatus(id, status);
    return ResponseFormatter.success(res, 'Review updated successfully', updated);
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/reviews/:id  (kept for backward compat with existing admin panel)
 * Delegates to PATCH logic.
 */
router.put('/:id', authenticate, async (req: any, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    // Legacy admin panel sends status:'approved'|'reported' — map to our enum
    const normalized =
      status === 'approved' ? 'APPROVED'
      : status === 'reported' || status === 'rejected' ? 'REJECTED'
      : status?.toUpperCase();

    if (!['APPROVED', 'REJECTED'].includes(normalized)) {
      return res.status(400).json({ success: false, message: "status must be 'APPROVED' or 'REJECTED'" });
    }

    const updated = await reviewService.updateReviewStatus(id, normalized as 'APPROVED' | 'REJECTED');
    return ResponseFormatter.success(res, 'Review updated successfully', updated);
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reviews/:id
 * Admin: soft-delete a review and recalculate product avgRating.
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await reviewService.deleteReview(id);
    return ResponseFormatter.success(res, 'Review deleted successfully', null);
  } catch (error) {
    return next(error);
  }
});

export default router;
