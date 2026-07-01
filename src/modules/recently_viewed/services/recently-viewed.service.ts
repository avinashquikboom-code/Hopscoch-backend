import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class RecentlyViewedService {
  async getRecentlyViewed(userId: string) {
    const recentlyViewed = await prisma.recentlyViewed.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              where: { sortOrder: 0 },
              take: 1,
            },
            category: true,
            brand: true,
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
      take: 20,
    });

    return recentlyViewed;
  }

  async recordView(userId: string, productId: string): Promise<void> {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Upsert recently viewed record
    await prisma.recentlyViewed.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        userId,
        productId,
        viewedAt: new Date(),
      },
    });

    logger.info(`Product view recorded: ${productId} by user: ${userId}`);
  }

  async clearRecentlyViewed(userId: string): Promise<void> {
    await prisma.recentlyViewed.deleteMany({
      where: { userId },
    });

    logger.info(`Recently viewed history cleared for user: ${userId}`);
  }
}

export default new RecentlyViewedService();
