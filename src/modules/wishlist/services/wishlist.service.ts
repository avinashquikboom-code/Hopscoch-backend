import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class WishlistService {
  async getWishlist(userId: any) {
    const wishlistItems = await prisma.wishlistItem.findMany({
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
        variant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return wishlistItems;
  }

  async addToWishlist(userId: any, productId: any, variantId?: any) {
    const varId = variantId ? Number(variantId) : null;
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: Number(productId), deletedAt: null },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Check if already in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId_variantId: {
          userId: Number(userId),
          productId: Number(productId),
          variantId: varId as any,
        },
      },
    });

    if (existingItem) {
      throw new AppError('Product already in wishlist', 409);
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: Number(userId),
        productId: Number(productId),
        variantId: varId,
      },
      include: {
        product: {
          include: {
            images: {
              where: { sortOrder: 0 },
              take: 1,
            },
          },
        },
        variant: true,
      },
    });

    logger.info(`Product added to wishlist: ${productId} by user: ${userId}`);
    return wishlistItem;
  }

  async removeFromWishlist(userId: any, productId: any): Promise<void> {
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });

    if (deleted.count === 0) {
      throw new AppError('Product not found in wishlist', 404);
    }

    logger.info(`Product removed from wishlist: ${productId} by user: ${userId}`);
  }

  async getWishlistStatus(userId: any, productId: any) {
    const wishlistItem = await prisma.wishlistItem.findFirst({
      where: { userId, productId },
    });

    return {
      isWishlisted: !!wishlistItem,
      variantId: wishlistItem?.variantId || null,
    };
  }
}

export default new WishlistService();
