import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class ReturnService {
  async createReturnRequest(userId: any, data: {
    orderId: any;
    reason: string;
    isReplacement: boolean;
    images?: string[];
    notes?: string;
  }) {
    const { orderId, reason, isReplacement, images, notes } = data;

    // Validate order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId },
      include: {
        items: true,
        timeline: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if return request already exists
    const existingReturn = await prisma.returnRequest.findUnique({
      where: { orderId },
    });

    if (existingReturn) {
      throw new AppError('Return request already exists for this order', 400);
    }

    // Check if order is eligible for return (delivered orders only)
    const eligibleStatuses = ['DELIVERED', 'OUT_FOR_DELIVERY'];
    if (!eligibleStatuses.includes(order.status)) {
      throw new AppError('Order is not eligible for return', 400);
    }

    // Create return request
    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        status: 'REQUESTED',
        reason,
        isReplacement,
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            address: true,
          },
        },
      },
    });

    // Add timeline event to order
    await prisma.orderTimelineEvent.create({
      data: {
        orderId,
        status: 'RETURNED',
        note: `Return request initiated: ${reason}`,
      },
    });

    logger.info(`Return request created: ${returnRequest.id} for order: ${orderId} by user: ${userId}`);
    return returnRequest;
  }

  async getReturns(userId: any, filters: {
    page: number;
    limit: number;
    status?: string;
  }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      order: { userId },
    };

    if (status) {
      where.status = status;
    }

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
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
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return {
      returns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReturnById(userId: any, returnId: any) {
    const returnRequest = await prisma.returnRequest.findFirst({
      where: {
        id: Number(returnId),
        order: { userId: Number(userId) },
      },
      include: {
        order: {
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
                variant: true,
              },
            },
            address: true,
            timeline: {
              orderBy: { createdAt: 'asc' },
            },
            payment: true,
          },
        },
      },
    });

    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    return returnRequest;
  }

  async updateReturnStatus(returnId: any, data: {
    status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PICKED_UP' | 'RECEIVED' | 'REFUND_INITIATED' | 'REFUND_COMPLETED';
    adminNotes?: string;
  }) {
    const { status, adminNotes } = data;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: Number(returnId) },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      REQUESTED: ['APPROVED', 'REJECTED'],
      APPROVED: ['PICKED_UP', 'REJECTED'],
      PICKED_UP: ['RECEIVED'],
      RECEIVED: ['REFUND_INITIATED'],
      REFUND_INITIATED: ['REFUND_COMPLETED'],
      REJECTED: [],
      REFUND_COMPLETED: [],
    };

    const currentStatus = returnRequest.status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new AppError(`Cannot transition from ${currentStatus} to ${status}`, 400);
    }

    // Update return status
    const updatedReturn = await prisma.returnRequest.update({
      where: { id: Number(returnId) },
      data: { status },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    // Add timeline event
    await prisma.orderTimelineEvent.create({
      data: {
        orderId: returnRequest.orderId,
        status: (returnRequest as any).order.status,
        note: `Return status updated to ${status}${adminNotes ? ': ' + adminNotes : ''}`,
      },
    });

    // If refund completed, restore stock
    if (status === 'REFUND_COMPLETED') {
      for (const item of (returnRequest as any).order.items) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    logger.info(`Return status updated: ${returnId} to ${status}`);
    return updatedReturn;
  }

  async getAllReturnsForAdmin(filters: {
    page: number;
    limit: number;
    status?: string;
  }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
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
      prisma.returnRequest.count({ where }),
    ]);

    return {
      returns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new ReturnService();
