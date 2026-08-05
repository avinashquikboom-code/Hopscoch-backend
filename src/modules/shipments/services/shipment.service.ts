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

    const labelUrl = `/api/v1/admin/shipping/label/${orderId}/download`;
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

    const invoiceUrl = `/api/v1/admin/shipping/invoice/${orderId}/download`;

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

  async renderLabelHtml(orderId: number): Promise<string> {
    const order: any = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        user: true,
        shipment: true,
        address: true,
      },
    });

    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }

    const addr = (order.address as any) || {};
    const recipientName = addr.recipientName || addr.fullName || addr.name || order.user?.firstName || 'Customer';
    const street = addr.addressLine1 || addr.line1 || addr.street || '';
    const city = addr.city || '';
    const state = addr.state || '';
    const pincode = addr.pincode || addr.postalCode || '';
    const phone = addr.phone || addr.phoneNumber || order.user?.phone || '';
    const fullAddress = [street, city, state, pincode].filter(Boolean).join(', ');

    const courier = order.shipment?.courier || 'FCI Seller Express';
    const awb = order.shipment?.awb || `AWB-FCIS-${orderId}`;
    const paymentMode = order.paymentStatus === 'PAID' ? 'PREPAID' : 'COD';
    const itemsList = (order.items || []).map((i: any) => `${i.product?.name || i.name || 'Product'} (x${i.quantity || 1})`).join(', ');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Shipping Label - Order #${order.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .label-box { max-width: 480px; margin: 0 auto; background: #fff; border: 2px solid #0f172a; border-radius: 8px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #14b8a6; padding-bottom: 12px; margin-bottom: 14px; }
    .brand { font-size: 22px; font-weight: 900; color: #14b8a6; text-transform: uppercase; letter-spacing: -0.5px; }
    .badge { background: #0f172a; color: #fff; padding: 4px 10px; font-size: 11px; font-weight: 800; border-radius: 4px; text-transform: uppercase; }
    .section { border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 12px; }
    .title { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .val { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.4; }
    .barcode { font-family: monospace; font-size: 18px; font-weight: 900; letter-spacing: 3px; background: #f1f5f9; padding: 8px; text-align: center; border-radius: 4px; border: 1px solid #cbd5e1; margin: 10px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media print { body { background: #fff; padding: 0; } .label-box { border: 2px solid #000; box-shadow: none; } }
  </style>
</head>
<body onload="window.print()">
  <div class="label-box">
    <div class="header">
      <div class="brand">FCI Seller</div>
      <div class="badge">${paymentMode}</div>
    </div>
    <div class="barcode">||| |||| || ||||| |||| ${awb}</div>
    <div class="grid section">
      <div>
        <div class="title">Courier / Carrier</div>
        <div class="val">${courier}</div>
      </div>
      <div>
        <div class="title">Order Number</div>
        <div class="val">#${order.orderNumber || order.id}</div>
      </div>
    </div>
    <div class="section">
      <div class="title">Deliver To (Consignee)</div>
      <div class="val"><strong>${recipientName}</strong></div>
      <div class="val">${fullAddress}</div>
      <div class="val">Phone: ${phone}</div>
    </div>
    <div class="section">
      <div class="title">Package Contents</div>
      <div class="val">${itemsList || 'Standard Package'}</div>
    </div>
    <div class="grid">
      <div>
        <div class="title">Shipped From</div>
        <div class="val">${order.sellerNameSnapshot || 'FCI Seller'} Fulfillment Center<br/>${(order as any).sellerAddressSnapshot ? `${(order as any).sellerAddressSnapshot}<br/>` : ''}${order.sellerContactSnapshot ? `Contact: ${order.sellerContactSnapshot}` : 'India'}</div>
      </div>
      <div>
        <div class="title">Total Amount</div>
        <div class="val" style="font-size: 16px; font-weight: 800; color: #14b8a6;">₹${Number(order.totalAmount || order.total || 0).toFixed(2)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  async renderInvoiceHtml(orderId: number): Promise<string> {
    const [order, settings, defaultWarehouse] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          user: true,
          address: true,
        },
      }),
      prisma.systemSettings.findFirst(),
      prisma.warehouse.findFirst({ where: { isDefault: true } }),
    ]);

    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }

    const addr = (order.address as any) || {};
    const recipientName = addr.recipientName || addr.fullName || addr.name || order.user?.firstName || 'Customer';
    const street = addr.addressLine1 || addr.line1 || addr.street || '';
    const city = addr.city || '';
    const state = addr.state || '';
    const pincode = addr.pincode || addr.postalCode || '';
    const phone = addr.phone || addr.phoneNumber || (order.user as any)?.phone || '';
    const fullAddress = [street, city, state, pincode].filter(Boolean).join(', ');

    const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    const totalAmt = Number((order as any).totalAmount || (order as any).total || 0);

    // Prefer order-time seller snapshots (manual checkout entry), fall back to live settings
    const s = settings as any;
    const sellerLegalName =
      (order as any).sellerNameSnapshot ||
      s?.sellerLegalName ||
      s?.sellerName ||
      'FCI Seller Retail Pvt. Ltd.';
    const sellerGst = s?.sellerGstNumber || '';
    const sellerAddr =
      (order as any).sellerAddressSnapshot ||
      [s?.sellerAddress, s?.sellerCity, s?.sellerState, s?.sellerPincode].filter(Boolean).join(', ');
    const sellerPhone =
      (order as any).sellerContactSnapshot ||
      s?.sellerContactNumber ||
      '';
    const sellerEmail = s?.sellerEmail || '';

    // Fulfilled By — default warehouse (fallback; per-order tracking is a future enhancement)
    const warehouseName = defaultWarehouse?.name || 'FCI Seller Fulfillment Center';
    const warehouseAddr = defaultWarehouse
      ? [defaultWarehouse.address, defaultWarehouse.city, defaultWarehouse.state, defaultWarehouse.pincode].filter(Boolean).join(', ')
      : 'India';

    const itemsRows = (order.items || []).map((item: any, idx: number) => {
      const title = item.product?.name || item.name || 'Product Item';
      const qty = item.quantity || 1;
      const price = Number(item.price || item.priceSnapshot || item.unitPrice || 0);
      const total = price * qty;
      const taxable = total / 1.18;
      const cgst = (total - taxable) / 2;
      const sgst = cgst;
      return `<tr>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; font-size:12px;">${idx + 1}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; font-weight:600; font-size:12px;">${title}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; font-size:12px;">${qty}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-size:12px;">₹${taxable.toFixed(2)}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-size:12px;">9% (₹${cgst.toFixed(2)})</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-size:12px;">9% (₹${sgst.toFixed(2)})</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-size:12px; font-weight:700;">₹${total.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const taxableTotal = totalAmt / 1.18;
    const cgst = (totalAmt - taxableTotal) / 2;
    const sgst = cgst;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Tax Invoice - FCI Seller #${order.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #1e293b; padding: 24px; margin:0; }
    .card { max-width: 850px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 30px; border-radius: 8px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #14b8a6; padding-bottom: 16px; margin-bottom: 20px; }
    .logo { font-size: 26px; font-weight: 900; color: #14b8a6; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 20px; }
    .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; background: #f8fafc; }
    .box-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #14b8a6; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; letter-spacing: 0.5px; }
    .box p { font-size: 12px; margin: 3px 0; color: #334155; line-height: 1.4; }
    .box p strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #0f172a; color: #fff; padding: 10px; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
    .totals-table { width: 340px; margin-left: auto; }
    .totals-table td { padding: 6px 12px; font-size: 12px; border: none; }
    .totals-table tr.grand-total td { font-size: 15px; font-weight: 900; color: #0f172a; border-top: 2px solid #14b8a6; border-bottom: 2px solid #14b8a6; background: #f0fdf4; }
    .footer { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; }
    .signatory { text-align: right; font-size: 12px; font-weight: 700; color: #0f172a; }
    .signatory-space { height: 40px; margin: 8px 0; border-bottom: 1px dashed #cbd5e1; width: 160px; margin-left: auto; }
    @media print { body { padding: 0; } .card { border: none; } }
  </style>
</head>
<body onload="window.print()">
  <div class="card">
    <div class="header">
      <div>
        <div class="logo">FCI SELLER</div>
        <p style="font-size:12px; color:#64748b; margin:4px 0 0 0;">Tax Invoice</p>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px; font-weight:900; color:#0f172a;">TAX INVOICE</div>
        <div style="font-size:12px; color:#64748b;">Invoice #: INV-FCI-${order.id}</div>
        <div style="font-size:12px; color:#64748b;">Date: ${dateStr}</div>
        <div style="font-size:12px; color:#64748b;">Order: #${(order as any).orderNumber || order.id}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="box">
        <div class="box-title">Sold By</div>
        <p><strong>${sellerLegalName}</strong></p>
        ${sellerAddr ? `<p>${sellerAddr}</p>` : ''}
        ${sellerGst ? `<p><strong>GSTIN:</strong> ${sellerGst}</p>` : ''}
        ${sellerPhone ? `<p><strong>Contact:</strong> ${sellerPhone}</p>` : ''}
        ${sellerEmail ? `<p>${sellerEmail}</p>` : ''}
      </div>
      <div class="box">
        <div class="box-title">Fulfilled By</div>
        <p><strong>${warehouseName}</strong></p>
        <p>${warehouseAddr}</p>
        ${defaultWarehouse?.phone ? `<p>Ph: ${defaultWarehouse.phone}</p>` : ''}
      </div>
      <div class="box">
        <div class="box-title">Shipped To</div>
        <p><strong>${recipientName}</strong></p>
        <p>${fullAddress}</p>
        ${phone ? `<p>Ph: ${phone}</p>` : ''}
        <p style="margin-top:8px;"><strong>Payment:</strong> ${(order as any).paymentStatus || 'COMPLETED'}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>Item Description</th>
          <th style="width:50px; text-align:center;">Qty</th>
          <th style="width:100px; text-align:right;">Taxable (₹)</th>
          <th style="width:90px; text-align:right;">CGST 9%</th>
          <th style="width:90px; text-align:right;">SGST 9%</th>
          <th style="width:100px; text-align:right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || `<tr><td colspan="7" style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Standard Order Purchase</td></tr>`}
      </tbody>
    </table>

    <table class="totals-table">
      <tr><td style="color:#64748b;">Subtotal (Taxable):</td><td style="text-align:right; font-weight:600;">₹${taxableTotal.toFixed(2)}</td></tr>
      <tr><td style="color:#64748b;">CGST (9%):</td><td style="text-align:right; font-weight:600;">₹${cgst.toFixed(2)}</td></tr>
      <tr><td style="color:#64748b;">SGST (9%):</td><td style="text-align:right; font-weight:600;">₹${sgst.toFixed(2)}</td></tr>
      <tr class="grand-total"><td>Grand Total (Incl. GST):</td><td style="text-align:right;">₹${totalAmt.toFixed(2)}</td></tr>
    </table>

    <div class="footer">
      <div style="font-size:10px; color:#64748b; max-width:420px; line-height:1.5;">
        <p style="font-weight:700; color:#0f172a; margin:0 0 4px;">Terms &amp; Conditions:</p>
        <p style="margin:2px 0;">1. Goods once sold can be returned per official return policy guidelines.</p>
        <p style="margin:2px 0;">2. All disputes are subject to local judicial jurisdiction.</p>
        <p style="margin:2px 0;">3. Computer-generated tax invoice. No physical signature required.</p>
      </div>
      <div class="signatory">
        <p>For ${sellerLegalName}</p>
        <div class="signatory-space"></div>
        <p style="font-size:11px; color:#64748b;">Authorized Signatory</p>
      </div>
    </div>
  </div>
</body>
</html>`;
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
