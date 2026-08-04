import prisma from '../../../utils/prisma';
import { AppError } from '../../../middleware/errorHandler';

export class ReviewService {
  /**
   * Recalculate avgRating + reviewCount on the Product from live data.
   * Called after every create/delete to keep denormalized fields accurate.
   */
  async recalculateProductRating(productId: number): Promise<void> {
    const agg = await prisma.review.aggregate({
      where: {
        productId,
        deletedAt: null,
        status: 'APPROVED',
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    const avgRating = agg._avg.rating ? Math.round(Number(agg._avg.rating) * 10) / 10 : 0;
    const reviewCount = agg._count.id;

    await prisma.product.update({
      where: { id: productId },
      data: {
        avgRating,
        reviewCount,
      },
    });
  }

  /**
   * Submit a review. Validates verified purchase if orderId is provided.
   * Enforces the unique constraint (userId + productId + orderId).
   * New reviews default to APPROVED (visible immediately).
   */
  async submitReview(
    userId: number,
    productId: number,
    data: {
      rating: number;
      title?: string;
      comment?: string;
      orderId?: number;
    }
  ) {
    const { rating, title, comment, orderId } = data;

    // 1. Validate rating range
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new AppError('Rating must be an integer between 1 and 5', 400);
    }

    // 2. Confirm product exists
    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // 3. Verified purchase check — require at least one DELIVERED order containing this product
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
          status: 'DELIVERED',
          items: { some: { productId } },
        },
        select: { id: true },
      });

      if (!order) {
        throw new AppError(
          'This order is not eligible for review. Only delivered orders containing this product qualify.',
          403
        );
      }
      isVerifiedPurchase = true;
    } else {
      const deliveredOrder = await prisma.order.findFirst({
        where: {
          userId,
          status: 'DELIVERED',
          items: { some: { productId } },
        },
        select: { id: true },
      });

      if (!deliveredOrder) {
        throw new AppError(
          'You can only review products you have purchased and received.',
          403
        );
      }
      isVerifiedPurchase = true;
    }

    // 4. Check for duplicate (same userId + productId + orderId) — treat as edit
    const existing = await prisma.review.findFirst({
      where: {
        userId,
        productId,
        orderId: orderId ?? null,
        deletedAt: null,
      },
    });

    if (existing) {
      const updated = await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating,
          title: title ?? existing.title,
          comment: comment ?? existing.comment,
          updatedAt: new Date(),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      await this.recalculateProductRating(productId);
      return { review: updated, action: 'updated' };
    }

    // 5. Create new review
    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        orderId: orderId ?? null,
        rating,
        title,
        comment,
        isVerifiedPurchase,
        status: 'APPROVED', // go live immediately
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.recalculateProductRating(productId);
    return { review, action: 'created' };
  }

  /**
   * Public paginated GET — only APPROVED, non-deleted reviews.
   */
  async getProductReviews(
    productId: number,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          productId,
          status: 'APPROVED',
          deletedAt: null,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({
        where: { productId, status: 'APPROVED', deletedAt: null },
      }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: list all reviews (including PENDING + REJECTED), with filters.
   */
  async adminListReviews(filters: {
    productId?: number;
    rating?: number;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { productId, rating, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (productId) where.productId = productId;
    if (rating) where.rating = rating;
    if (status) where.status = status;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Admin: toggle visibility via status (APPROVED <-> REJECTED).
   */
  async updateReviewStatus(reviewId: number, status: 'APPROVED' | 'REJECTED') {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true, deletedAt: true },
    });

    if (!review || review.deletedAt) {
      throw new AppError('Review not found', 404);
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { status },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        product: { select: { id: true, name: true } },
      },
    });

    await this.recalculateProductRating(review.productId);
    return updated;
  }

  /**
   * Admin: soft-delete a review.
   */
  async deleteReview(reviewId: number) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true, deletedAt: true },
    });

    if (!review || review.deletedAt) {
      throw new AppError('Review not found', 404);
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });

    await this.recalculateProductRating(review.productId);
  }

  /**
   * Check whether the authenticated user has already reviewed a specific product+order combo.
   * Used by mobile/website to decide whether to show "Rate this product" CTA.
   */
  async getUserReviewForProduct(userId: number, productId: number, orderId?: number) {
    return prisma.review.findFirst({
      where: {
        userId,
        productId,
        orderId: orderId ?? undefined,
        deletedAt: null,
      },
    });
  }
}

export default new ReviewService();
