import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class CartService {
  async getCart(userId: any) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
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
        },
      },
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
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
          },
        },
      });
    }

    return cart;
  }

  async addToCart(userId: any, data: { productId: any; variantId: any; quantity: number }) {
    const { productId, variantId, quantity } = data;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: Number(productId), deletedAt: null },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Check if variant exists
    const variant = await prisma.productVariant.findUnique({
      where: { id: Number(variantId), deletedAt: null },
    });

    if (!variant) {
      throw new AppError('Product variant not found', 404);
    }

    // Check stock
    if (variant.stock < quantity) {
      throw new AppError('Insufficient stock', 400);
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
        },
      },
    });

    let cartItem;

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > variant.stock) {
        throw new AppError('Insufficient stock', 400);
      }

      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
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
    } else {
      // Add new item
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId,
          quantity,
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
    }

    logger.info(`Product added to cart: ${productId} by user: ${userId}`);
    return cartItem;
  }

  async updateCartItem(userId: any, cartItemId: any, data: { quantity?: number; savedForLater?: boolean }) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: Number(cartItemId), cartId: cart.id },
      include: { variant: true },
    });

    if (!cartItem) {
      throw new AppError('Cart item not found', 404);
    }

    if (data.quantity !== undefined) {
      // Check stock
      if (data.quantity > (cartItem as any).variant!.stock) {
        throw new AppError('Insufficient stock', 400);
      }
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: Number(cartItemId) },
      data,
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

    logger.info(`Cart item updated: ${cartItemId} by user: ${userId}`);
    return updatedItem;
  }

  async removeFromCart(userId: any, cartItemId: any): Promise<void> {
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    const deleted = await prisma.cartItem.deleteMany({
      where: { id: Number(cartItemId), cartId: cart.id },
    });

    if (deleted.count === 0) {
      throw new AppError('Cart item not found', 404);
    }

    logger.info(`Cart item removed: ${cartItemId} by user: ${userId}`);
  }

  async clearCart(userId: any): Promise<void> {
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    logger.info(`Cart cleared for user: ${userId}`);
  }
}

export default new CartService();
