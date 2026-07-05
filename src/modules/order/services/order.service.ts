import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class OrderService {
  async createOrder(userId: any, data: { addressId: any }) {
    const { addressId } = data;
    const addrId = Number(addressId);

    // Get user's cart
    const cart: any = await prisma.cart.findUnique({
      where: { userId: Number(userId) },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    // Validate address
    const address = await prisma.address.findFirst({
      where: { id: addrId, userId: Number(userId), deletedAt: null },
    });

    if (!address) {
      throw new AppError('Address not found', 404);
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of cart.items) {
      // Check stock
      if (item.variant.stock < item.quantity) {
        throw new AppError(`Insufficient stock for ${item.product.name}`, 400);
      }
      subtotal += Number(item.variant.price) * item.quantity;
    }

    const taxAmount = subtotal * 0.18; // 18% GST
    const shippingAmount = subtotal > 1000 ? 0 : 99; // Free shipping over 1000
    const totalAmount = subtotal + taxAmount + shippingAmount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: Number(userId),
        addressId: addrId,
        status: 'PENDING',
        subtotal,
        taxAmount,
        shippingAmount,
        discountAmount: 0,
        totalAmount,
        items: {
          create: cart.items.map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId,
            productNameSnapshot: item.product.name,
            variantSnapshot: {
              size: item.variant.size,
              color: item.variant.color,
              material: item.variant.material,
              pattern: item.variant.pattern,
              sku: item.variant.sku,
              price: item.variant.price,
            },
            priceSnapshot: item.variant.price,
            quantity: item.quantity,
          })),
        },
        timeline: {
          create: {
            status: 'PENDING',
            note: 'Order placed successfully',
          },
        },
      },
      include: {
        items: true,
        address: true,
        timeline: true,
      },
    });

    // Update stock
    for (const item of cart.items) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Clear cart
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    logger.info(`Order created: ${order.id} for user: ${userId}`);
    return order;
  }

  async getOrders(userId: any, filters: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    where: { sortOrder: 0 },
                    take: 1,
                  },
                },
              },
            },
          },
          address: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(userId: any, orderId: any) {
    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
                category: true,
                brand: true,
              },
            },
          },
        },
        address: true,
        timeline: {
          orderBy: { createdAt: 'asc' },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    return order;
  }

  async cancelOrder(userId: any, orderId: any) {
    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if order can be cancelled
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      throw new AppError('Order cannot be cancelled at this stage', 400);
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: Number(orderId) },
      data: {
        status: 'CANCELLED',
        timeline: {
          create: {
            status: 'CANCELLED',
            note: 'Order cancelled by user',
          },
        },
      },
      include: {
        items: true,
      },
    });

    // Restore stock
    for (const item of (updatedOrder as any).items) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }

    logger.info(`Order cancelled: ${orderId} by user: ${userId}`);
    return updatedOrder;
  }
}

export default new OrderService();
