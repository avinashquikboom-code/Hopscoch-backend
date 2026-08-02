import prisma from '../../../utils/prisma';
import crypto from 'crypto';
import { AppError } from '../../../middleware/errorHandler';

/**
 * Reseller Service handling share link creation, resolution, and margin tracking.
 */
export class ResellerService {
  /**
   * Generate a unique share link with added margin for a product
   */
  static async createShareLink(userId: number, productId: number, variantId?: number, addedMarginInput?: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const addedMargin = addedMarginInput ? Number(addedMarginInput) : 0;
    if (addedMargin < 0) {
      throw new AppError('Added margin cannot be negative', 400);
    }

    const basePrice = Number(product.basePrice);
    const maxMarginRupees = Number(product.margin ?? 0);

    if (addedMargin > maxMarginRupees) {
      throw new AppError(`Margin cannot exceed ₹${maxMarginRupees}`, 400);
    }

    const shareCode = crypto.randomBytes(4).toString('hex');

    const resellerLink = await prisma.resellerLink.create({
      data: {
        resellerId: userId,
        productId,
        variantId: variantId ? Number(variantId) : null,
        addedMargin,
        shareCode,
      },
    });

    const shareUrl = `https://fciseller.com/p/${product.id}?shareCode=${shareCode}`;

    return {
      id: resellerLink.id,
      shareCode: resellerLink.shareCode,
      shareUrl,
      productId: product.id,
      productName: product.name,
      basePrice,
      addedMargin,
      finalPrice: basePrice + addedMargin,
      createdAt: resellerLink.createdAt,
    };
  }

  /**
   * Resolve a reseller share link by code
   */
  static async getShareLinkByCode(shareCode: string) {
    const link = await prisma.resellerLink.findUnique({
      where: { shareCode },
      include: {
        product: {
          include: {
            images: true,
            variants: true,
            taxRule: true,
          },
        },
      },
    });

    if (!link) {
      throw new AppError('Share link not found', 404);
    }

    // Increment click count
    await prisma.resellerLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    });

    const addedMargin = Number(link.addedMargin);
    const basePrice = Number(link.product.basePrice);
    const markedUpPrice = basePrice + addedMargin;

    return {
      resellerLinkId: link.id,
      shareCode: link.shareCode,
      resellerId: link.resellerId,
      addedMargin,
      basePrice,
      markedUpPrice,
      product: {
        ...link.product,
        markedUpPrice,
        basePrice,
      },
    };
  }

  /**
   * Get all reseller links created by the current user
   */
  static async getMyResellerLinks(userId: number) {
    const links = await prisma.resellerLink.findMany({
      where: { resellerId: userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            basePrice: true,
          },
        },
        orderItems: {
          select: {
            quantity: true,
            resellerMarginEarned: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => {
      const ordersCount = link.orderItems.length;
      const totalMarginEarned = link.orderItems.reduce(
        (sum, item) => sum + Number(item.resellerMarginEarned || 0),
        0
      );

      return {
        id: link.id,
        shareCode: link.shareCode,
        shareUrl: `https://fciseller.com/p/${link.productId}?shareCode=${link.shareCode}`,
        productId: link.productId,
        productName: link.product.name,
        thumbnailUrl: link.product.thumbnailUrl,
        basePrice: Number(link.product.basePrice),
        addedMargin: Number(link.addedMargin),
        finalPrice: Number(link.product.basePrice) + Number(link.addedMargin),
        clickCount: link.clickCount,
        ordersCount,
        totalMarginEarned,
        createdAt: link.createdAt,
      };
    });
  }
}
