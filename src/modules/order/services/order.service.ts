import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import { reserveStock, releaseReservation } from '../../inventory/services/inventory.service';
import { calculateCartTaxes } from '../../../utils/tax.utils';

export class OrderService {
  async createOrder(userId: any, data: any) {
    const uId = Number(userId);
    const { addressId, address: rawAddress, items: inputItems, paymentMethod = 'COD', razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    // 1. Resolve Address
    let targetAddressId: number | null = null;

    if (addressId) {
      const existingAddr = await prisma.address.findFirst({
        where: { id: Number(addressId), userId: uId, deletedAt: null },
      });
      if (existingAddr) {
        targetAddressId = existingAddr.id;
      }
    }

    if (!targetAddressId && rawAddress) {
      if (typeof rawAddress === 'object') {
        const newAddr = await prisma.address.create({
          data: {
            userId: uId,
            fullName: rawAddress.fullName || `${rawAddress.firstName || ''} ${rawAddress.lastName || ''}`.trim() || 'Valued Customer',
            phone: rawAddress.phone || '0000000000',
            line1: rawAddress.line1 || rawAddress.street || rawAddress.streetAddress || 'Address details',
            city: rawAddress.city || 'City',
            state: rawAddress.state || rawAddress.stateProvince || 'State',
            pincode: rawAddress.pincode || rawAddress.zipCode || rawAddress.zipPostal || '000000',
            country: rawAddress.country || 'India',
          },
        });
        targetAddressId = newAddr.id;
      } else if (typeof rawAddress === 'string') {
        const newAddr = await prisma.address.create({
          data: {
            userId: uId,
            fullName: 'Valued Customer',
            phone: '0000000000',
            line1: rawAddress,
            city: 'City',
            state: 'State',
            pincode: '000000',
            country: 'India',
          },
        });
        targetAddressId = newAddr.id;
      }
    }

    if (!targetAddressId) {
      // Find any saved address for user or create fallback address
      const anyAddr = await prisma.address.findFirst({
        where: { userId: uId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (anyAddr) {
        targetAddressId = anyAddr.id;
      } else {
        const defaultAddr = await prisma.address.create({
          data: {
            userId: uId,
            fullName: 'Valued Customer',
            phone: '0000000000',
            line1: 'Default Checkout Address',
            city: 'City',
            state: 'State',
            pincode: '000000',
            country: 'India',
          },
        });
        targetAddressId = defaultAddr.id;
      }
    }

    // 2. Resolve Items & Calculate Server-Side Prices
    let rawItemsToCalculate: Array<any> = [];

    // Try DB Cart first
    const cart: any = await prisma.cart.findUnique({
      where: { userId: uId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: { include: { taxRule: true } },
                taxRule: true,
              },
            },
            variant: true,
          },
        },
      },
    });

    if (cart && cart.items && cart.items.length > 0) {
      rawItemsToCalculate = cart.items;
    } else if (Array.isArray(inputItems) && inputItems.length > 0) {
      for (const rawItem of inputItems) {
        let pId = rawItem.productId ? Number(rawItem.productId) : null;
        let vId = rawItem.variantId ? Number(rawItem.variantId) : null;
        
        if (!pId && rawItem.product?.id) {
          pId = Number(rawItem.product.id);
        }

        if (!pId || isNaN(pId)) continue;

        const product = await prisma.product.findUnique({
          where: { id: pId },
          include: {
            category: { include: { taxRule: true } },
            taxRule: true,
            variants: true,
          },
        });

        if (!product) continue;

        let variant = product.variants.find((v) => v.id === vId);
        if (!variant && product.variants.length > 0) {
          variant = product.variants[0];
        }

        const quantity = Number(rawItem.quantity || 1);
        rawItemsToCalculate.push({
          product,
          variant,
          quantity,
        });
      }
    }

    if (rawItemsToCalculate.length === 0) {
      throw new AppError('Cart is empty and no valid products were provided', 400);
    }

    // 3. Server-side Tax & Financial Calculations
    const taxCalculation = calculateCartTaxes(rawItemsToCalculate);
    const subtotal = taxCalculation.subtotal;
    const taxAmount = taxCalculation.totalTax;
    const shippingAmount = subtotal > 999 ? 0 : 99;
    const discountAmount = 0;
    const totalAmount = Math.round((subtotal + taxCalculation.totalExclusiveTax + shippingAmount - discountAmount) * 100) / 100;

    // 4. Determine Status & Payment Method
    const validPaymentMethods = ['RAZORPAY', 'STRIPE', 'UPI', 'CARD', 'WALLET', 'COD'];
    const pMethod = validPaymentMethods.includes(String(paymentMethod).toUpperCase())
      ? (String(paymentMethod).toUpperCase() as any)
      : 'COD';

    const isPaid = pMethod !== 'COD' || Boolean(razorpayPaymentId);
    const initialStatus = isPaid ? 'CONFIRMED' : 'PENDING';
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. Create Order + OrderItems + Payment + Timeline in Single Transaction
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: uId,
          addressId: targetAddressId!,
          status: initialStatus,
          subtotal,
          taxAmount,
          shippingAmount,
          discountAmount,
          totalAmount,
          items: {
            create: taxCalculation.itemsWithTax.map((item) => ({
              productId: item.productId,
              variantId: item.variantId && item.variantId > 0 ? item.variantId : undefined,
              productNameSnapshot: item.productName || 'Product',
              variantSnapshot: item.variantId ? { price: item.unitPrice } : { sku: 'default', price: item.unitPrice },
              priceSnapshot: item.unitPrice,
              quantity: item.quantity,
              taxAmount: item.taxAmount,
              taxRateSnapshot: item.rate,
              taxTypeSnapshot: item.taxType,
              hsnSnapshot: item.hsnCode,
            }) as any),
          },
          timeline: {
            create: {
              status: initialStatus,
              note: isPaid ? 'Order placed and payment verified' : 'Order placed (Payment pending / COD)',
            },
          },
          payment: {
            create: {
              method: pMethod,
              status: isPaid ? 'PAID' : 'PENDING',
              amount: totalAmount,
              razorpayOrderId,
              razorpayPaymentId,
              razorpaySignature,
            },
          },
        },
        include: {
          items: true,
          address: true,
          timeline: true,
          payment: true,
        },
      });

      // Clear DB Cart if used
      if (cart && cart.items && cart.items.length > 0) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      }

      return createdOrder;
    });

    // 6. Reserve Inventory Stock (non-blocking safe call)
    try {
      const validVariantReservations = taxCalculation.itemsWithTax
        .filter((i: any) => i.variantId && i.variantId > 0)
        .map((i: any) => ({ variantId: i.variantId!, quantity: i.quantity }));

      if (validVariantReservations.length > 0) {
        await reserveStock(validVariantReservations, String(order.id));
      }
    } catch (invErr) {
      logger.warn(`Inventory reservation warning for order ${order.id}:`, invErr);
    }

    logger.info(`✅ Order created successfully: ID ${order.id}, Number ${order.orderNumber} for User ${uId}`);
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

  async cancelOrder(userId: any, orderId: any, reason?: string) {
    const numericId = Number(orderId);
    let order = null;

    if (!isNaN(numericId) && numericId > 0) {
      order = await prisma.order.findFirst({
        where: { id: numericId },
      });
    }

    if (!order) {
      order = await prisma.order.findFirst({
        where: { orderNumber: String(orderId) },
      });
    }

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const currentStatus = (order.status || '').toUpperCase().trim();
    if (['SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'OUT_FOR_DELIVERY'].includes(currentStatus)) {
      throw new AppError('Order cannot be cancelled at this stage', 400);
    }

    const cancelNote = reason && reason.trim().length > 0
      ? `Order cancelled by user. Reason: ${reason.trim()}`
      : 'Order cancelled by user';

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        timeline: {
          create: {
            status: 'CANCELLED',
            note: cancelNote,
          },
        },
      },
      include: {
        items: true,
      },
    });

    // Release reserved stock in default warehouse
    try {
      await releaseReservation(
        (updatedOrder as any).items.map((i: any) => ({ variantId: i.variantId, quantity: i.quantity })),
        String(updatedOrder.id)
      );
    } catch (err) {
      logger.warn(`Could not release reservation for order ${order.id}: ${err}`);
    }

    logger.info(`Order cancelled: ${orderId} by user: ${userId}. Reason: ${reason || 'N/A'}`);
    return updatedOrder;
  }
}

export default new OrderService();
