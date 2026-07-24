import { z } from 'zod';

export const createOrderSchema = z.object({
  addressId: z.union([z.string(), z.number()]).optional(),
  address: z.union([
    z.string(),
    z.object({
      street: z.string().optional(),
      streetAddress: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      stateProvince: z.string().optional(),
      zipCode: z.string().optional(),
      zipPostal: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      fullName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
  ]).optional(),
  items: z.array(
    z.object({
      productId: z.union([z.string(), z.number()]).optional(),
      variantId: z.union([z.string(), z.number()]).optional(),
      product: z.any().optional(),
      quantity: z.number().min(1).default(1),
    })
  ).optional(),
  paymentMethod: z.string().optional().default('COD'),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  discountAmount: z.union([z.string(), z.number()]).optional(),
  discount: z.union([z.string(), z.number()]).optional(),
  couponCode: z.string().optional(),
  coupon: z.string().optional(),
  shippingAmount: z.union([z.string(), z.number()]).optional(),
  shipping: z.union([z.string(), z.number()]).optional(),
}).passthrough();

