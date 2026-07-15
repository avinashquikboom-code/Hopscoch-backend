import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import shiprocketClient from './shiprocket.client';
import { getShiprocketPickupLocation } from '../../inventory/services/warehouse.service';

export class ShipmentService {
  async createShipment(orderId: number) {
    // Check if shipment already exists
    const existing = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (existing) {
      throw new AppError('Shipment already created for this order', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        address: true,
        items: true,
        payment: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (!order.address) {
      throw new AppError('Shipping address missing for this order', 400);
    }

    logger.info(`Creating Shiprocket order for Hopscotch Order ID: ${orderId}`);
    
    // Format payload for Shiprocket API
    const payload = {
      order_id: String(order.id),
      order_date: order.createdAt.toISOString().replace('T', ' ').substring(0, 19),
      pickup_location: await getShiprocketPickupLocation(),
      billing_customer_name: order.address.fullName || order.user.firstName || 'Customer',
      billing_last_name: '',
      billing_address: order.address.line1,
      billing_address_2: order.address.line2 || '',
      billing_city: order.address.city,
      billing_pincode: order.address.pincode,
      billing_state: order.address.state,
      billing_country: order.address.country || 'India',
      billing_email: order.user.email,
      billing_phone: order.address.phone || '9876543210',
      shipping_is_billing: true,
      order_items: order.items.map(item => ({
        name: item.productNameSnapshot,
        sku: item.variantSnapshot && typeof item.variantSnapshot === 'object' && 'sku' in item.variantSnapshot ? (item.variantSnapshot as any).sku : `SKU-${item.variantId}`,
        units: item.quantity,
        selling_price: Number(item.priceSnapshot),
      })),
      payment_method: order.payment?.method === 'COD' ? 'COD' : 'Prepaid',
      sub_total: Number(order.subtotal),
      length: 10,
      width: 10,
      height: 10,
      weight: 0.5,
    };

    const response = await shiprocketClient.request('/orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        shiprocketOrderId: String(response.order_id),
        shipmentId: String(response.shipment_id),
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
            note: `Shipment initiated on Shiprocket. Shipment ID: ${response.shipment_id}`,
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

  async generateAWB(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.shipmentId) {
      throw new AppError('Shipment record not found', 404);
    }

    logger.info(`Assigning AWB for shipment: ${shipment.shipmentId}`);
    const response = await shiprocketClient.request('/courier/assign/awb', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: shipment.shipmentId }),
    });

    if (!response.response || !response.response.data || !response.response.data.awb_code) {
      throw new AppError('AWB generation failed', 400);
    }

    const awbData = response.response.data;
    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        awb: awbData.awb_code,
        courier: awbData.courier_name || 'Shiprocket Partner',
        status: 'AWB_ASSIGNED',
      },
    });

    return updated;
  }

  async generateLabel(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.shipmentId) {
      throw new AppError('Shipment record not found', 404);
    }

    logger.info(`Generating label for shipment: ${shipment.shipmentId}`);
    const response = await shiprocketClient.request('/courier/generate/label', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: [shipment.shipmentId] }),
    });

    if (!response.label_url) {
      throw new AppError('Label generation failed', 400);
    }

    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        labelUrl: response.label_url,
      },
    });

    return updated;
  }

  async generateInvoice(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.shiprocketOrderId) {
      throw new AppError('Shipment record not found', 404);
    }

    logger.info(`Generating invoice for order ID: ${shipment.shiprocketOrderId}`);
    const response = await shiprocketClient.request('/orders/print/invoice', {
      method: 'POST',
      body: JSON.stringify({ order_ids: [shipment.shiprocketOrderId] }),
    });

    if (!response.invoice_url) {
      throw new AppError('Invoice generation failed', 400);
    }

    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        invoiceUrl: response.invoice_url,
      },
    });

    // Also update order table
    await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceUrl: response.invoice_url,
      },
    });

    return updated;
  }

  async schedulePickup(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.shipmentId) {
      throw new AppError('Shipment record not found', 404);
    }

    logger.info(`Scheduling pickup for shipment: ${shipment.shipmentId}`);
    const response = await shiprocketClient.request('/pickup/trigger', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: [shipment.shipmentId] }),
    });

    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        status: 'PICKUP_SCHEDULED',
      },
    });

    return updated;
  }

  async cancelShipment(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.awb) {
      throw new AppError('Shipment AWB not assigned or found', 404);
    }

    logger.info(`Cancelling shipment for AWB: ${shipment.awb}`);
    await shiprocketClient.request('/orders/cancel/shipment/with-awb', {
      method: 'POST',
      body: JSON.stringify({ awbs: [shipment.awb] }),
    });

    const updated = await prisma.shipment.update({
      where: { orderId },
      data: {
        status: 'CANCELLED',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        timeline: {
          create: {
            status: 'CANCELLED',
            note: 'Shipment cancelled on Shiprocket',
          },
        },
      },
    });

    return updated;
  }

  async trackShipment(orderId: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.awb) {
      throw new AppError('Shipment AWB not assigned or found', 404);
    }

    logger.info(`Tracking shipment for AWB: ${shipment.awb}`);
    const response = await shiprocketClient.request(`/courier/track/awb/${shipment.awb}`, {
      method: 'GET',
    });

    if (response.tracking_data && response.tracking_data.shipment_track_activities) {
      const activities = response.tracking_data.shipment_track_activities;
      await prisma.shipment.update({
        where: { orderId },
        data: {
          timeline: activities,
        },
      });
      return activities;
    }

    return shipment.timeline || [];
  }

  async createReturnRequest(orderId: number, reason: string, isReplacement = false) {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment || !shipment.awb) {
      throw new AppError('Order must have a valid shipment to initiate return', 400);
    }

    // Call Shiprocket to create a return order
    logger.info(`Initiating return request for Order ID: ${orderId}`);
    
    // Create DB return request record
    const request = await prisma.returnRequest.upsert({
      where: { orderId },
      update: {
        status: 'REQUESTED',
        reason,
        isReplacement,
      },
      create: {
        orderId,
        status: 'REQUESTED',
        reason,
        isReplacement,
      },
    });

    await prisma.order.update({
      where: { id: orderId },
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
