import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class ShipmentService {
  async createShipment(data: {
    orderId: string;
    courierPartner: string;
    trackingNumber: string;
    estimatedDeliveryDate: string;
  }) {
    const { orderId, courierPartner, trackingNumber, estimatedDeliveryDate } = data;

    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Create shipment record (using Payment table as base since Shipment model doesn't exist in schema yet)
    // In production, you'd have a dedicated Shipment table
    // For now, we'll add tracking info to order timeline
    
    await prisma.orderTimelineEvent.create({
      data: {
        orderId,
        status: 'CONFIRMED',
        note: `Shipment created via ${courierPartner}. Tracking: ${trackingNumber}`,
      },
    });

    // Update order status to PROCESSING
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING',
        timeline: {
          create: {
            status: 'PROCESSING',
            note: 'Order processed for shipment',
          },
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        address: true,
      },
    });

    logger.info(`Shipment created for order: ${orderId} via ${courierPartner}`);
    return {
      orderId,
      courierPartner,
      trackingNumber,
      estimatedDeliveryDate,
      order: updatedOrder,
    };
  }

  async updateTracking(orderId: string, data: {
    status: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
    location?: string;
    note?: string;
  }) {
    const { status, location, note } = data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Map shipment status to order status
    const statusMapping: Record<string, string> = {
      PICKED_UP: 'PROCESSING',
      IN_TRANSIT: 'SHIPPED',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      FAILED: 'CANCELLED',
      RETURNED: 'RETURNED',
    };

    const orderStatus = statusMapping[status] || 'PROCESSING';

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: orderStatus as any,
        timeline: {
          create: {
            status: orderStatus as any,
            note: `Tracking update: ${status}${location ? ` at ${location}` : ''}${note ? `. ${note}` : ''}`,
          },
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        address: true,
        timeline: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    logger.info(`Tracking updated for order: ${orderId} to ${status}`);
    return updatedOrder;
  }

  async getShipmentByOrderId(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
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
          orderBy: { createdAt: 'desc' },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    return order;
  }

  async getAllShipmentsForAdmin(filters: {
    page: number;
    limit: number;
    status?: string;
    courier?: string;
  }) {
    const { page, limit, status, courier } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
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
          address: true,
          timeline: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      shipments: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkDeliveryZone(pincode: string) {
    const deliveryZone = await prisma.deliveryZone.findUnique({
      where: { pincode },
    });

    if (!deliveryZone) {
      throw new AppError('Pincode not serviceable', 404);
    }

    return deliveryZone;
  }

  async getAllDeliveryZones(filters: {
    page: number;
    limit: number;
  }) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [zones, total] = await Promise.all([
      prisma.deliveryZone.findMany({
        orderBy: { pincode: 'asc' },
        skip,
        take: limit,
      }),
      prisma.deliveryZone.count(),
    ]);

    return {
      zones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new ShipmentService();
