import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class PaymentService {
  async createPayment(userId: any, data: {
    orderId: any;
    method: 'RAZORPAY' | 'STRIPE' | 'UPI' | 'CARD' | 'WALLET' | 'COD';
    providerRef?: string;
  }) {
    const { orderId, method, providerRef } = data;

    // Validate order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId },
      include: { payment: true },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if payment already exists
    if (order.payment) {
      throw new AppError('Payment already exists for this order', 400);
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId,
        method,
        status: 'PENDING',
        providerRef,
        amount: order.totalAmount,
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
            address: true,
          },
        },
      },
    });

    logger.info(`Payment created: ${payment.id} for order: ${orderId} by user: ${userId}`);
    return payment;
  }

  async updatePaymentStatus(paymentId: any, status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED', providerRef?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: Number(paymentId) },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: Number(paymentId) },
      data: {
        status,
        providerRef: providerRef || payment.providerRef,
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    // Update order status based on payment status
    if (status === 'PAID') {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'CONFIRMED',
          timeline: {
            create: {
              status: 'CONFIRMED',
              note: 'Payment received successfully',
            },
          },
        },
      });
    } else if (status === 'FAILED') {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'CANCELLED',
          timeline: {
            create: {
              status: 'CANCELLED',
              note: 'Payment failed',
            },
          },
        },
      });

      // Restore stock
      const orderWithItems = await prisma.order.findUnique({
        where: { id: payment.orderId },
        include: { items: true },
      });

      if (orderWithItems) {
        for (const item of orderWithItems.items) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }

    logger.info(`Payment status updated: ${paymentId} to ${status}`);
    return updatedPayment;
  }

  async processRefund(paymentId: any, data: {
    refundAmount: number;
    refundReason: string;
  }) {
    const { refundAmount, refundReason } = data;

    const payment = await prisma.payment.findUnique({
      where: { id: Number(paymentId) },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    if (payment.status !== 'PAID') {
      throw new AppError('Payment must be in PAID status to process refund', 400);
    }

    if (refundAmount > Number(payment.amount) - Number(payment.refundedAmount)) {
      throw new AppError('Refund amount exceeds available balance', 400);
    }

    // Update payment with refund
    const updatedPayment = await prisma.payment.update({
      where: { id: Number(paymentId) },
      data: {
        refundedAmount: {
          increment: refundAmount,
        },
        status: Number(payment.refundedAmount) + refundAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
      include: {
        order: true,
      },
    });

    // Add timeline event
    await prisma.orderTimelineEvent.create({
      data: {
        orderId: payment.orderId,
        status: payment.order.status,
        note: `Refund processed: ₹${refundAmount}. Reason: ${refundReason}`,
      },
    });

    logger.info(`Refund processed: ${paymentId} amount: ₹${refundAmount}`);
    return updatedPayment;
  }

  async getPaymentByOrderId(orderId: any) {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: true,
                  },
                },
              },
            },
            address: true,
          },
        },
      },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    return payment;
  }

  async getPaymentsForUser(userId: any, filters: {
    page: number;
    limit: number;
    status?: string;
    method?: string;
  }) {
    const { page, limit, status, method } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      order: { userId },
    };

    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllPaymentsForAdmin(filters: {
    page: number;
    limit: number;
    status?: string;
    method?: string;
  }) {
    const { page, limit, status, method } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new PaymentService();
