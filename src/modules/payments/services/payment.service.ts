import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import { confirmSale, releaseReservation } from '../../inventory/services/inventory.service';
import razorpayClient from './razorpay.client';
import CartService from '../../cart/services/cart.service';

export class PaymentService {
  async createPayment(userId: any, data: {
    orderId: any;
    method: 'RAZORPAY' | 'STRIPE' | 'UPI' | 'CARD' | 'WALLET' | 'COD';
    providerRef?: string;
  }) {
    const { orderId, method, providerRef } = data;

    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId },
      include: { payment: true },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const payment = await prisma.payment.upsert({
      where: { orderId: Number(orderId) },
      update: {
        method,
        providerRef,
        amount: order.totalAmount,
        status: method === 'COD' ? 'PENDING' : 'PENDING',
      },
      create: {
        orderId: Number(orderId),
        method,
        providerRef,
        amount: order.totalAmount,
        status: 'PENDING',
      },
    });

    logger.info(`Payment created: ${payment.id} for order: ${orderId} by user: ${userId}`);
    return payment;
  }

  async createRazorpayOrder(
    userId?: any,
    orderId?: any,
    customAmount?: number,
    items?: any[],
    couponCode?: string,
    discountAmount?: number,
    giftWrap?: boolean
  ) {
    let amount = 0;
    let targetOrderId: number | null = null;

    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: Number(orderId), ...(userId ? { userId: Number(userId) } : {}) },
      });
      if (!order) {
        throw new AppError('Order not found', 404);
      }
      amount = Number(order.totalAmount);
      targetOrderId = order.id;
    } else if (items && Array.isArray(items) && items.length > 0) {
      // Calculate server-authoritative total from items array by querying live DB prices & tax rules
      let subtotal = 0;
      let totalTax = 0;

      logger.info(`[PaymentService] Calculating server-authoritative total for ${items.length} item(s). Client sent customAmount: ₹${customAmount}, couponCode=${couponCode}, discountAmount=₹${discountAmount}, giftWrap=${giftWrap}`);

      for (const item of items) {
        const productId = item.productId ?? item.product?.id;
        if (!productId) continue;
        const product = await prisma.product.findUnique({
          where: { id: Number(productId) },
          include: {
            taxRule: true,
            category: { include: { taxRule: true } },
          },
        });
        if (!product) continue;

        let unitPrice = Number((product as any).salePrice ?? product.basePrice ?? 0);
        let variant: any = null;

        if (item.variantId) {
          variant = await prisma.productVariant.findUnique({
            where: { id: Number(item.variantId) },
          });
        } else if (item.size || item.color) {
          variant = await prisma.productVariant.findFirst({
            where: {
              productId: Number(productId),
              ...(item.size ? { size: String(item.size) } : {}),
              ...(item.color ? { color: String(item.color) } : {}),
            },
          });
        }

        if (variant && variant.price != null && Number(variant.price) > 0) {
          unitPrice = Number(variant.price);
        }

        const qty = Number(item.quantity || 1);
        const lineSubtotal = unitPrice * qty;
        subtotal += lineSubtotal;

        const rule = product.taxRule || (product.category as any)?.taxRule || null;
        let rate = rule
          ? Number(rule.rate ?? 0)
          : ((product as any).taxPercent != null && Number((product as any).taxPercent) > 0 ? Number((product as any).taxPercent) : 0);
        if (isNaN(rate) || rate < 0) rate = 0;

        const lineTaxAmount = Math.round((lineSubtotal * (rate / 100)) * 100) / 100;
        totalTax += lineTaxAmount;

        logger.info(`[PaymentService] Item productId=${productId}, variantId=${variant?.id || 'none'}, unitPrice=₹${unitPrice}, qty=${qty}, lineSubtotal=₹${lineSubtotal}, taxRate=${rate}%, lineTax=₹${lineTaxAmount}`);
      }

      if (subtotal > 0) {
        const appliedDiscount = Number(discountAmount || 0);
        const discountedSubtotal = Math.max(0, subtotal - appliedDiscount);

        let productShipping = 0;
        let hasProductShipping = false;
        for (const item of items) {
          const productId = item.productId ?? item.product?.id;
          if (!productId) continue;
          const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
          if (product && product.shippingCharge != null) {
            hasProductShipping = true;
            productShipping += Number(product.shippingCharge) * Number(item.quantity || 1);
          }
        }

        const shippingAmount = discountedSubtotal >= 999
          ? 0
          : (hasProductShipping ? productShipping : 0);

        const settingsService = (await import('../../settings/services/settings.service')).default;
        const giftWrapConfig = await settingsService.getGiftWrapConfig();

        let customGiftWrapSum = 0;
        let hasCustomGiftWrap = false;
        for (const item of items) {
          const productId = item.productId ?? item.product?.id;
          if (!productId) continue;
          const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
          if (product && product.isGiftWrapAvailable && product.giftWrapCharge != null && Number(product.giftWrapCharge) > 0) {
            hasCustomGiftWrap = true;
            customGiftWrapSum += Number(product.giftWrapCharge);
          }
        }

        const effectiveGiftWrapFee = (hasCustomGiftWrap && customGiftWrapSum > 0) ? customGiftWrapSum : giftWrapConfig.charge;
        const giftWrapFee = (giftWrap && giftWrapConfig.enabled) ? effectiveGiftWrapFee : 0;

        const calculatedAmount = Math.round((discountedSubtotal + totalTax + shippingAmount + giftWrapFee) * 100) / 100;

        if (customAmount && Number(customAmount) > 0) {
          amount = Number(customAmount);
        } else {
          amount = calculatedAmount;
        }

        logger.info(`[PaymentService] Final Calculation: subtotal=₹${subtotal}, discount=₹${appliedDiscount}, discountedSubtotal=₹${discountedSubtotal}, totalTax=₹${totalTax}, shipping=₹${shippingAmount}, giftWrapFee=₹${giftWrapFee} => Authoritative Total: ₹${amount}`);
      } else if (customAmount && customAmount > 0) {
        amount = Number(customAmount);
      }
    } else if (userId) {
      try {
        const cart = await CartService.getCart(userId);
        if (cart && cart.items && cart.items.length > 0) {
          amount = Number(cart.total);
        }
      } catch (_) {}
    }

    if (amount <= 0 && customAmount && customAmount > 0) {
      amount = Number(customAmount);
    }

    if (amount <= 0) {
      throw new AppError('Invalid order amount for Razorpay payment', 400);
    }

    const rzpOrder = await razorpayClient.createOrder(amount, 'INR', `receipt_${userId || 'guest'}_${Date.now()}`);

    let paymentId: any = null;
    if (targetOrderId) {
      const payment = await prisma.payment.upsert({
        where: { orderId: targetOrderId },
        update: {
          razorpayOrderId: rzpOrder.id,
          amount: amount,
          status: 'PENDING',
          method: 'RAZORPAY',
        },
        create: {
          orderId: targetOrderId,
          method: 'RAZORPAY',
          status: 'PENDING',
          amount: amount,
          razorpayOrderId: rzpOrder.id,
        },
      });
      paymentId = payment.id;
    }

    let keyId = process.env.RAZORPAY_KEY_ID || '';
    try {
      const settingsService = (await import('../../settings/services/settings.service')).default;
      const fetchedKey = await settingsService.getIntegrationKey('razorpay', 'key_id');
      if (fetchedKey && !fetchedKey.startsWith('YOUR_') && fetchedKey !== 'your-razorpay-key-id') {
        keyId = fetchedKey;
      }
    } catch (_) {}

    if (!keyId || keyId.startsWith('YOUR_') || keyId === 'your-razorpay-key-id') {
      keyId = process.env.RAZORPAY_KEY_ID || '';
    }

    return {
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount, // in paise
      currency: rzpOrder.currency,
      keyId,
      paymentId,
    };
  }

  async verifyRazorpayPayment(userId: any, data: { razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string }) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    const isValid = await razorpayClient.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      throw new AppError('Invalid payment signature', 400);
    }

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId },
    });

    if (!payment) {
      throw new AppError('Payment record not found', 404);
    }

    const updatedPayment = await this.updatePaymentStatus(payment.id, 'PAID', razorpayPaymentId);
    
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
      },
    });

    return updatedPayment;
  }

  async updatePaymentStatus(paymentId: any, status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED', providerRef?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: Number(paymentId) },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

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

      // Confirm sale in default warehouse
      await confirmSale(
        updatedPayment.order.items.map((i: any) => ({ variantId: i.variantId, quantity: i.quantity })),
        String(updatedPayment.order.id)
      );
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

      const orderWithItems = await prisma.order.findUnique({
        where: { id: payment.orderId },
        include: { items: true },
      });

      if (orderWithItems) {
        // Release reserved stock in default warehouse
        await releaseReservation(
          orderWithItems.items.map((i: any) => ({ variantId: i.variantId, quantity: i.quantity })),
          String(orderWithItems.id)
        );
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

    // Call Razorpay client if payment was executed via Razorpay
    let rzpRefundId: string | null = null;
    if (payment.method === 'RAZORPAY' && payment.razorpayPaymentId) {
      logger.info(`Initiating online refund on Razorpay for payment: ${payment.razorpayPaymentId}`);
      const refund = await razorpayClient.refundPayment(payment.razorpayPaymentId, refundAmount);
      rzpRefundId = refund.id;
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: Number(paymentId) },
      data: {
        refundedAmount: {
          increment: refundAmount,
        },
        status: Number(payment.refundedAmount) + refundAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundId: rzpRefundId || payment.refundId,
      },
      include: {
        order: true,
      },
    });

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

  async handleRazorpayWebhook(event: string, payload: any) {
    logger.info(`Processing Razorpay webhook event: ${event}`);
    
    if (event === 'payment.captured') {
      const razorpayOrderId = payload.payment.entity.order_id;
      const razorpayPaymentId = payload.payment.entity.id;
      
      const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId },
      });
      
      if (payment && payment.status !== 'PAID') {
        await this.updatePaymentStatus(payment.id, 'PAID', razorpayPaymentId);
      }
    } else if (event === 'payment.failed') {
      const razorpayOrderId = payload.payment.entity.order_id;
      const razorpayPaymentId = payload.payment.entity.id;
      
      const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId },
      });
      
      if (payment && payment.status !== 'PAID') {
        await this.updatePaymentStatus(payment.id, 'FAILED', razorpayPaymentId);
      }
    } else if (event === 'refund.processed') {
      const razorpayPaymentId = payload.refund.entity.payment_id;
      const refundId = payload.refund.entity.id;
      const amountRefunded = payload.refund.entity.amount / 100; // in INR
      
      const payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId },
      });
      
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            refundedAmount: {
              increment: amountRefunded,
            },
            status: Number(payment.refundedAmount) + amountRefunded >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundId,
          },
        });
      }
    }
  }

  async getPaymentsDashboard() {
    const payments = await prisma.payment.findMany();
    
    let captured = 0;
    let failed = 0;
    let refunded = 0;
    
    for (const p of payments) {
      const amt = Number(p.amount);
      const refAmt = Number(p.refundedAmount);
      if (p.status === 'PAID') {
        captured += amt;
      } else if (p.status === 'FAILED') {
        failed += amt;
      }
      refunded += refAmt;
    }
    
    return {
      captured,
      failed,
      refunded,
      total: payments.length,
    };
  }

  async getPaymentByOrderId(orderId: any) {
    const payment = await prisma.payment.findUnique({
      where: { orderId: Number(orderId) },
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
