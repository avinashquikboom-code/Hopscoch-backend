import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class WishlistService {
  async getWishlist(userId: any) {
    const numUserId = Number(userId);
    if (isNaN(numUserId)) return [];

    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId: numUserId },
      include: {
        product: {
          include: {
            images: {
              take: 2,
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
    const numUserId = Number(userId);
    const numProductId = Number(productId);
    const varId = variantId ? Number(variantId) : null;

    if (isNaN(numUserId) || isNaN(numProductId)) {
      throw new AppError('Invalid user or product ID', 400);
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: numProductId, deletedAt: null },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Check if already in wishlist using findFirst (safe against Prisma null compound unique filter validation errors)
    const existingItem = await prisma.wishlistItem.findFirst({
      where: {
        userId: numUserId,
        productId: numProductId,
        ...(varId ? { variantId: varId } : {}),
      },
    });

    if (existingItem) {
      // Check-then-toggle: remove existing item instead of failing on duplicate
      await prisma.wishlistItem.delete({
        where: { id: existingItem.id },
      });
      logger.info(`Product toggled off wishlist: ${numProductId} by user: ${numUserId}`);
      return { toggled: 'removed', productId: numProductId };
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: numUserId,
        productId: numProductId,
        ...(varId ? { variantId: varId } : {}),
      },
      include: {
        product: {
          include: {
            images: {
              take: 2,
            },
          },
        },
        variant: true,
      },
    });

    logger.info(`Product added to wishlist: ${numProductId} by user: ${numUserId}`);
    return wishlistItem;
  }

  async removeFromWishlist(userId: any, productId: any): Promise<void> {
    const numUserId = Number(userId);
    const numProductId = Number(productId);

    if (isNaN(numUserId) || isNaN(numProductId)) return;

    await prisma.wishlistItem.deleteMany({
      where: {
        userId: numUserId,
        productId: numProductId,
      },
    });

    logger.info(`Product removed from wishlist: ${numProductId} by user: ${numUserId}`);
  }

  async getWishlistStatus(userId: any, productId: any) {
    const numUserId = Number(userId);
    const numProductId = Number(productId);

    if (isNaN(numUserId) || isNaN(numProductId)) {
      return { isWishlisted: false, variantId: null };
    }

    const wishlistItem = await prisma.wishlistItem.findFirst({
      where: { userId: numUserId, productId: numProductId },
    });

    return {
      isWishlisted: !!wishlistItem,
      variantId: wishlistItem?.variantId || null,
    };
  }
}

export default new WishlistService();
