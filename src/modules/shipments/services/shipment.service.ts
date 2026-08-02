import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import shiprocketClient from './shiprocket.client';
import { getShiprocketPickupLocation } from '../../inventory/services/warehouse.service';

export class ShipmentService {
  async createShipment(orderId: number) {
    const existing = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (existing) {
      return existing;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        shipmentId: `shp_manual_${Date.now()}`,
        status: 'CREATED',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING',
        timeline: {
          create: {
            status: 'PROCESSING',
            note: `Shipment initiated. Shipment ID: ${shipment.shipmentId}`,
          },
        },
      },
    });

    return shipment;
  }

  async updateTracking(orderId: any, data: {
    status: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
    location?: string;
    note?: string;
  }) {
    const { status, location, note } = data;

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const statusMapping: Record<string, string> = {
      PICKED_UP: 'PROCESSING',
      IN_TRANSIT: 'SHIPPED',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      FAILED: 'CANCELLED',
      RETURNED: 'RETURNED',
    };

    const orderStatus = statusMapping[status] || 'PROCESSING';

    const updatedOrder = await prisma.order.update({
      where: { id: Number(orderId) },
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

  async generateAWB(orderId: number, courierName?: string, awbNumber?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const finalCourier = courierName || order.courierName || order.shipment?.courier || 'Standard Logistics';
    const finalAwb = awbNumber || order.awbNumber || order.shipment?.awb || `AWB-${Date.now()}`;

    const shipment = await prisma.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        shipmentId: `shp_${orderId}_${Date.now()}`,
        courier: finalCourier,
        awb: finalAwb,
        status: 'AWB_ASSIGNED',
      },
      update: {
        courier: finalCourier,
        awb: finalAwb,
        status: 'AWB_ASSIGNED',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
        courierName: finalCourier,
        awbNumber: finalAwb,
        shippedAt: new Date(),
        timeline: {
          create: {
            status: 'SHIPPED',
            note: `Shipped via ${finalCourier} (AWB: ${finalAwb})`,
          },
        },
      },
    });

    logger.info(`AWB assigned manually for order ${orderId}: ${finalCourier} (AWB: ${finalAwb})`);

    try {
      const UnifiedNotificationService = (await import('../../notification/services/unified-notification.service')).UnifiedNotificationService;
      await UnifiedNotificationService.sendNotificationToUser(order.userId, {
        title: 'Order Shipped! 🚚',
        body: `Your order #${order.orderNumber} has been shipped via ${finalCourier}! Tracking AWB: ${finalAwb}`,
        type: 'ORDER',
        data: { orderId: String(order.id), orderNumber: order.orderNumber, status: 'SHIPPED', courierName: finalCourier, awbNumber: finalAwb },
      });
    } catch (notifErr: any) {
      logger.warn(`Order shipped notification failed: ${notifErr.message}`);
    }

    return shipment;
  }

  async generateLabel(orderId: number) {
    let shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment) {
      shipment = await this.createShipment(orderId);
    }

    const labelUrl = `/api/v1/admin/orders/${orderId}/invoice`;
    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        labelUrl,
      },
    });

    return updated;
  }

  async generateInvoice(orderId: number) {
    let shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    const invoiceUrl = `/api/v1/admin/orders/${orderId}/invoice`;

    if (shipment) {
      shipment = await prisma.shipment.update({
        where: { orderId },
        data: {
          invoiceUrl,
        },
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceUrl,
      },
    });

    return { is_invoice_created: true, invoice_url: invoiceUrl, shipment };
  }

  async schedulePickup(orderId: number) {
    let shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment) {
      shipment = await this.createShipment(orderId);
    }

    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        status: 'PICKUP_SCHEDULED',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'OUT_FOR_DELIVERY',
        timeline: {
          create: {
            status: 'OUT_FOR_DELIVERY',
            note: 'Package picked up by courier service.',
          },
        },
      },
    });

    return updated;
  }

  async cancelShipment(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (shipment) {
      await prisma.shipment.update({
        where: { orderId },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        timeline: {
          create: {
            status: 'CANCELLED',
            note: 'Shipment cancelled by admin',
          },
        },
      },
    });

    return { success: true, message: 'Shipment cancelled' };
  }

  async trackShipment(orderIdInput: number | string) {
    const numericId = typeof orderIdInput === 'number' ? orderIdInput : parseInt(String(orderIdInput).replace(/\D/g, ''));
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(isNaN(numericId) || numericId <= 0 ? [] : [{ id: numericId }]),
          { orderNumber: String(orderIdInput) },
          { orderNumber: `#${orderIdInput}` },
        ],
      },
      include: {
        shipment: true,
        timeline: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const courier = (order as any).courierName || order.shipment?.courier || 'Logistics Partner';
    const awb = (order as any).awbNumber || order.shipment?.awb || null;

    let trackingUrl: string | null = null;
    if (courier && awb) {
      const courierLower = courier.toLowerCase();
      if (courierLower.includes('delhivery')) trackingUrl = `https://www.delhivery.com/track/package/${awb}`;
      else if (courierLower.includes('bluedart')) trackingUrl = `https://www.bluedart.com/tracking?trackNo=${awb}`;
      else if (courierLower.includes('dtdc')) trackingUrl = `https://www.dtdc.in/tracking/shipment-tracking.asp?strAWB=${awb}`;
      else if (courierLower.includes('india post') || courierLower.includes('speedpost')) trackingUrl = `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
      else if (courierLower.includes('ecom')) trackingUrl = `https://ecomexpress.in/tracking/?awb=${awb}`;
    }

    const activities = order.timeline.map((evt) => ({
      activity: (evt.status || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
      location: evt.note || 'Status Updated',
      date: evt.createdAt ? new Date(evt.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      status: evt.status,
    }));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      courierName: courier,
      awbNumber: awb,
      shippedAt: (order as any).shippedAt || order.shipment?.createdAt || null,
      trackingUrl,
      activities: activities.length > 0 ? activities : [
        { activity: 'Order Confirmed', location: 'Processing', date: new Date(order.createdAt).toLocaleString('en-IN'), status: order.status }
      ],
    };
  }

  async createReturnRequest(orderIdInput: number | string, reason: string, isReplacement = false) {
    const numericId = typeof orderIdInput === 'number' ? orderIdInput : parseInt(String(orderIdInput).replace(/\D/g, ''));
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(isNaN(numericId) || numericId <= 0 ? [] : [{ id: numericId }]),
          { orderNumber: String(orderIdInput) },
        ],
      },
      include: {
        shipment: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const awb = (order as any).awbNumber || order.shipment?.awb;
    if (!awb && order.status !== 'DELIVERED' && order.status !== 'SHIPPED') {
      throw new AppError('Order must be delivered or shipped to initiate return', 400);
    }

    // Create DB return request record
    logger.info(`Initiating return request for Order ID: ${order.id}`);
    const request = await prisma.returnRequest.upsert({
      where: { orderId: order.id },
      update: {
        status: 'REQUESTED',
        reason,
        isReplacement,
      },
      create: {
        orderId: order.id,
        status: 'REQUESTED',
        reason,
        isReplacement,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: isReplacement ? 'REPLACED' : 'RETURNED',
        timeline: {
          create: {
            status: isReplacement ? 'REPLACED' : 'RETURNED',
            note: `Return/Replacement request raised. Reason: ${reason}`,
          },
        },
      },
    });

    return request;
  }

  async handleShiprocketWebhook(payload: any) {
    const awb = payload.awb;
    const statusName = payload.current_status; // e.g. "PICKED UP", "IN TRANSIT", "DELIVERED"
    
    logger.info(`Shiprocket Webhook status update: AWB ${awb} -> ${statusName}`);

    const shipment = await prisma.shipment.findFirst({
      where: { awb },
    });

    if (!shipment) {
      logger.warn(`No shipment found for AWB: ${awb}`);
      return;
    }

    // Update shipment status
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: statusName,
        timeline: payload.scans || shipment.timeline,
      },
    });

    // Map Shiprocket status to order status
    let orderStatus: any = 'PROCESSING';
    if (statusName === 'IN TRANSIT' || statusName === 'SHIPPED') {
      orderStatus = 'SHIPPED';
    } else if (statusName === 'OUT FOR DELIVERY') {
      orderStatus = 'OUT_FOR_DELIVERY';
    } else if (statusName === 'DELIVERED') {
      orderStatus = 'DELIVERED';
    } else if (statusName === 'CANCELLED') {
      orderStatus = 'CANCELLED';
    } else if (statusName === 'RTO' || statusName === 'RETURNED') {
      orderStatus = 'RETURNED';
    }

    await prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        status: orderStatus,
        timeline: {
          create: {
            status: orderStatus,
            note: `Tracking status update: ${statusName}`,
          },
        },
      },
    });
  }

  async getShippingDashboard() {
    const shipments = await prisma.shipment.findMany();
    
    let pending = 0;
    let inTransit = 0;
    let delivered = 0;
    let rto = 0;
    let returns = 0;

    for (const s of shipments) {
      const stat = s.status?.toUpperCase() || '';
      if (stat === 'CREATED' || stat === 'AWB_ASSIGNED' || stat === 'PICKUP_SCHEDULED') {
        pending++;
      } else if (stat.includes('TRANSIT') || stat.includes('OUT FOR') || stat.includes('SHIPPED')) {
        inTransit++;
      } else if (stat === 'DELIVERED') {
        delivered++;
      } else if (stat.includes('RTO')) {
        rto++;
      } else if (stat.includes('RETURN')) {
        returns++;
      }
    }

    return {
      pending,
      inTransit,
      delivered,
      rto,
      returns,
      total: shipments.length,
    };
  }

  // ─── Existing service functionality ────────────────────────────────────────
  async getShipmentByOrderId(orderId: any) {
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
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
        shipment: true,
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
          shipment: true,
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
