import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import { reserveStock, releaseReservation } from '../../inventory/services/inventory.service';
import { calculateCartTaxes } from '../../../utils/tax.utils';

function formatOrderSummary(order: any) {
  if (!order) return order;
  const subtotal = Number(order.subtotal || 0);
  const taxAmount = Number(order.taxAmount || 0);
  const shippingAmount = Number(order.shippingAmount || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const totalAmount = Number(order.totalAmount || Math.max(0, subtotal + shippingAmount - discountAmount));

  return {
    ...order,
    subtotal,
    subTotal: subtotal,
    itemsPrice: subtotal,
    taxAmount,
    tax: taxAmount,
    totalTax: taxAmount,
    shippingAmount,
    shippingFee: shippingAmount,
    shipping: shippingAmount,
    deliveryFee: shippingAmount,
    discountAmount,
    discount: discountAmount,
    couponDiscount: discountAmount,
    totalAmount,
    total: totalAmount,
    grandTotal: totalAmount,
    finalTotal: totalAmount,
  };
}

export class OrderService {
  async createOrder(userId: any, data: any) {
    const uId = Number(userId);
    const { 
      addressId, 
      address: rawAddress, 
      items: inputItems, 
      paymentMethod = 'COD', 
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature,
      discountAmount: inputDiscountAmount,
      discount: inputDiscount,
      couponCode: inputCouponCode,
      coupon: inputCoupon,
      shippingAmount: inputShippingAmount,
      shipping: inputShipping
    } = data;

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

    const productShippingSum = rawItemsToCalculate.reduce((sum: number, item: any) => {
      const shipCharge = item.product?.shippingCharge != null ? Number(item.product.shippingCharge) : 0;
      return sum + (shipCharge * Number(item.quantity || 1));
    }, 0);

    let shippingAmount = (inputShippingAmount !== undefined && inputShippingAmount !== null)
      ? Number(inputShippingAmount)
      : (inputShipping !== undefined && inputShipping !== null)
      ? Number(inputShipping)
      : (subtotal >= 999 || subtotal === 0 ? 0 : productShippingSum);

    if (isNaN(shippingAmount) || shippingAmount < 0) {
      shippingAmount = 0;
    }

    let discountAmount = Number(inputDiscountAmount ?? inputDiscount ?? 0);
    if (isNaN(discountAmount) || discountAmount < 0) {
      discountAmount = 0;
    }

    const couponCode = (inputCouponCode || inputCoupon)?.toString().trim();
    if (couponCode) {
      const cleanCode = couponCode.toUpperCase();
      const coupon = await prisma.coupon.findUnique({
        where: { code: cleanCode }
      });

      if (coupon && coupon.isActive) {
        const now = new Date();
        const isValidDate = (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.expiresAt || coupon.expiresAt >= now);
        const isValidMinOrder = !coupon.minOrderValue || subtotal >= Number(coupon.minOrderValue);

        if (isValidDate && isValidMinOrder) {
          if (coupon.type === 'PERCENTAGE') {
            let calcDiscount = subtotal * (Number(coupon.value) / 100);
            if (coupon.maxDiscount && calcDiscount > Number(coupon.maxDiscount)) {
              calcDiscount = Number(coupon.maxDiscount);
            }
            discountAmount = Math.max(discountAmount, Math.round(calcDiscount * 100) / 100);
          } else if (coupon.type === 'FLAT') {
            discountAmount = Math.max(discountAmount, Number(coupon.value));
          } else if (coupon.type === 'FREE_SHIPPING') {
            shippingAmount = 0;
          }
        }
      }
    }

    const isGiftWrapRequested = Boolean(data.giftWrap || data.giftWrapped);
    const settingsService = (await import('../../settings/services/settings.service')).default;
    const giftWrapConfig = await settingsService.getGiftWrapConfig();
    const isGiftWrapped = isGiftWrapRequested && giftWrapConfig.enabled;
    const giftWrapCharge = isGiftWrapped ? giftWrapConfig.charge : 0;

    const grossTotal = subtotal + taxAmount + shippingAmount + giftWrapCharge;
    const calculatedTotal = Math.max(0, Math.round((grossTotal - discountAmount) * 100) / 100);
    const totalAmount = (data.totalAmount != null && Number(data.totalAmount) > 0)
      ? Number(data.totalAmount)
      : calculatedTotal;

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
          giftWrapped: isGiftWrapped,
          giftWrapCharge,
          totalAmount,
          items: {
            create: taxCalculation.itemsWithTax.map((item: any) => ({
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
          payment: razorpayOrderId ? {
            connectOrCreate: {
              where: { razorpayOrderId },
              create: {
                method: pMethod,
                status: isPaid ? 'PAID' : 'PENDING',
                amount: totalAmount,
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
              },
            },
          } : {
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
    return formatOrderSummary(order);
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
      orders: orders.map((o) => formatOrderSummary(o)),
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

    return formatOrderSummary(order);
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

  async calculateCheckout(userId: any, data: any) {
    const uId = Number(userId);
    const { items: inputItems, couponCode: inputCouponCode, giftWrap } = data;

    let rawItemsToCalculate: Array<any> = [];

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
      rawItemsToCalculate = await Promise.all(cart.items.map(async (item: any) => {
        const p = item.product;
        if (p) {
          let effectiveTaxRule = p.taxRule || (p.category as any)?.taxRule || null;
          if (!effectiveTaxRule && p.taxRuleId) {
            effectiveTaxRule = await prisma.tax.findUnique({
              where: { id: Number(p.taxRuleId) },
            });
          }
          const rawRate = (p as any).taxPercent ?? (p as any).tax_percent ?? (p as any).taxRate ?? (p as any).tax_rate;
          const taxPercent = effectiveTaxRule
              ? Number(effectiveTaxRule.rate || 0)
              : (rawRate != null && !isNaN(Number(rawRate)) ? Number(rawRate) : 0);
          const rawType = (p as any).taxType ?? (p as any).tax_type ?? (p as any).type;
          const taxType = effectiveTaxRule
              ? (effectiveTaxRule.taxType || effectiveTaxRule.type || 'EXCLUSIVE')
              : (rawType ? String(rawType) : 'NONE');
          return {
            ...item,
            product: {
              ...p,
              taxRule: effectiveTaxRule,
              effectiveTaxRule,
              taxPercent,
              tax_percent: taxPercent,
              taxRate: taxPercent,
              tax_rate: taxPercent,
              taxType,
              tax_type: taxType,
            },
          };
        }
        return item;
      }));
    } else if (Array.isArray(inputItems) && inputItems.length > 0) {
      for (const rawItem of inputItems) {
        let pId = rawItem.productId ? Number(rawItem.productId) : null;
        let vId = rawItem.variantId ? Number(rawItem.variantId) : null;
        if (!pId && rawItem.product?.id) pId = Number(rawItem.product.id);
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
        if (!variant && product.variants.length > 0) variant = product.variants[0];

        let effectiveTaxRule = product.taxRule || (product.category as any)?.taxRule || null;
        if (!effectiveTaxRule && product.taxRuleId) {
          effectiveTaxRule = await prisma.tax.findUnique({
            where: { id: Number(product.taxRuleId) },
          });
        }
        const rawRate = (product as any).taxPercent ?? (product as any).tax_percent ?? (product as any).taxRate ?? (product as any).tax_rate;
        const taxPercent = effectiveTaxRule
            ? Number(effectiveTaxRule.rate || 0)
            : (rawRate != null && !isNaN(Number(rawRate)) ? Number(rawRate) : 0);
        const rawType = (product as any).taxType ?? (product as any).tax_type ?? (product as any).type;
        const taxType = effectiveTaxRule
            ? (effectiveTaxRule.taxType || effectiveTaxRule.type || 'EXCLUSIVE')
            : (rawType ? String(rawType) : 'NONE');

        const fullP = {
          ...product,
          taxRule: effectiveTaxRule,
          effectiveTaxRule,
          taxPercent,
          tax_percent: taxPercent,
          taxRate: taxPercent,
          tax_rate: taxPercent,
          taxType,
          tax_type: taxType,
        };

        const quantity = Number(rawItem.quantity || 1);
        rawItemsToCalculate.push({ product: fullP, variant, quantity });
      }
    }

    const taxCalculation = calculateCartTaxes(rawItemsToCalculate);
    const subtotal = taxCalculation.subtotal;
    const taxAmount = taxCalculation.totalTax;

    const productShippingSum = rawItemsToCalculate.reduce((sum: number, item: any) => {
      const shipCharge = item.product?.shippingCharge != null ? Number(item.product.shippingCharge) : 0;
      return sum + (shipCharge * Number(item.quantity || 1));
    }, 0);

    let shippingFee = subtotal >= 999 || subtotal === 0 ? 0 : productShippingSum;

    let couponDiscount = 0;
    const cleanCoupon = inputCouponCode?.toString().trim().toUpperCase();
    if (cleanCoupon) {
      const coupon = await prisma.coupon.findUnique({ where: { code: cleanCoupon } });
      if (coupon && coupon.isActive) {
        const now = new Date();
        const isValidDate = (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.expiresAt || coupon.expiresAt >= now);
        const isValidMinOrder = !coupon.minOrderValue || subtotal >= Number(coupon.minOrderValue);
        if (isValidDate && isValidMinOrder) {
          if (coupon.type === 'PERCENTAGE') {
            let calcDiscount = subtotal * (Number(coupon.value) / 100);
            if (coupon.maxDiscount && calcDiscount > Number(coupon.maxDiscount)) calcDiscount = Number(coupon.maxDiscount);
            couponDiscount = Math.round(calcDiscount * 100) / 100;
          } else if (coupon.type === 'FLAT') {
            couponDiscount = Number(coupon.value);
          } else if (coupon.type === 'FREE_SHIPPING') {
            shippingFee = 0;
          }
        }
      }
    }

    const settingsService = (await import('../../settings/services/settings.service')).default;
    const giftWrapConfig = await settingsService.getGiftWrapConfig();
    const isGiftWrapped = Boolean(giftWrap) && giftWrapConfig.enabled;
    const giftWrapCharge = isGiftWrapped ? giftWrapConfig.charge : 0;

    const grossTotal = subtotal + taxAmount + shippingFee + giftWrapCharge;
    const totalAmount = Math.max(0, Math.round((grossTotal - couponDiscount) * 100) / 100);

    return {
      subtotal,
      taxAmount,
      taxBreakdown: taxCalculation.taxBreakdown,
      shippingFee,
      couponDiscount,
      giftWrapCharge,
      totalAmount,
    };
  }
}

export default new OrderService();
