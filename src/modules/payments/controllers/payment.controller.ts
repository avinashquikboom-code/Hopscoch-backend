import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import { logger } from '../../../utils/logger';
import PaymentService from '../services/payment.service';
import razorpayClient from '../services/razorpay.client';
import { createPaymentSchema, processRefundSchema, paymentQuerySchema } from '../validators/payment.validator';

export class PaymentController {
  async createPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedData = createPaymentSchema.parse(req.body);
      const payment = await PaymentService.createPayment(req.user.id, validatedData);
      ResponseFormatter.success(res, 'Payment created successfully', payment);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        ResponseFormatter.error(res, (error as Error).message || 'Failed to create payment', 500);
      }
    }
  }

  async createRazorpayOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId, amount } = req.body || {};
      const userId = req.user?.id;
      const data = await PaymentService.createRazorpayOrder(userId, orderId, amount);
      ResponseFormatter.success(res, 'Razorpay order created successfully', data);
    } catch (error) {
      ResponseFormatter.error(res, (error as Error).message || 'Failed to create Razorpay order', 500);
    }
  }

  async verifyRazorpayPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        ResponseFormatter.error(res, 'Missing signature verification parameters', 400);
        return;
      }
      const payment = await PaymentService.verifyRazorpayPayment(req.user.id, {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });
      ResponseFormatter.success(res, 'Payment verified and captured successfully', payment);
    } catch (error) {
      ResponseFormatter.error(res, (error as Error).message || 'Payment verification failed', 500);
    }
  }

  async getRazorpayConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const keyId = await razorpayClient.testConnection ? await require('../../settings/services/settings.service').default.getIntegrationKey('razorpay', 'key_id') : process.env.RAZORPAY_KEY_ID;
      ResponseFormatter.success(res, 'Razorpay config retrieved', { keyId });
    } catch (error) {
      ResponseFormatter.error(res, 'Failed to fetch Razorpay config', 500);
    }
  }

  async getPaymentsDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const stats = await PaymentService.getPaymentsDashboard();
      ResponseFormatter.success(res, 'Payments stats retrieved', stats);
    } catch (error) {
      ResponseFormatter.error(res, (error as Error).message || 'Failed to retrieve stats', 500);
    }
  }

  async updatePaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { status, providerRef } = req.body;
      const payment = await PaymentService.updatePaymentStatus(paymentId, status, providerRef);
      ResponseFormatter.success(res, 'Payment status updated successfully', payment);
    } catch (error) {
      ResponseFormatter.error(res, (error as Error).message || 'Failed to update payment status', 500);
    }
  }

  async processRefund(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { paymentId } = req.params;
      const validatedData = processRefundSchema.parse(req.body);
      const payment = await PaymentService.processRefund(paymentId, validatedData);
      ResponseFormatter.success(res, 'Refund processed successfully', payment);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        ResponseFormatter.error(res, (error as Error).message || 'Refund failed', 500);
      }
    }
  }

  async handleWebhook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = JSON.stringify(req.body);
      
      const isValid = await razorpayClient.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        logger.warn('Invalid Razorpay webhook signature');
        res.status(400).json({ success: false, message: 'Invalid signature' });
        return;
      }

      const { event, payload } = req.body;
      await PaymentService.handleRazorpayWebhook(event, payload);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error(`Razorpay webhook error: ${error}`);
      res.status(500).json({ success: false });
    }
  }

  async getPaymentByOrderId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const payment = await PaymentService.getPaymentByOrderId(orderId);
      ResponseFormatter.success(res, 'Payment retrieved successfully', payment);
    } catch (error) {
      ResponseFormatter.error(res, (error as Error).message || 'Failed to get payment', 500);
    }
  }

  async getPaymentsForUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedQuery = paymentQuerySchema.parse(req.query);
      const payments = await PaymentService.getPaymentsForUser(req.user.id, {
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        status: validatedQuery.status,
        method: validatedQuery.method,
      });
      ResponseFormatter.success(res, 'Payments retrieved successfully', payments);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        ResponseFormatter.error(res, (error as Error).message || 'Failed to get payments', 500);
      }
    }
  }

  async getAllPaymentsForAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const validatedQuery = paymentQuerySchema.parse(req.query);
      const payments = await PaymentService.getAllPaymentsForAdmin({
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        status: validatedQuery.status,
        method: validatedQuery.method,
      });
      ResponseFormatter.success(res, 'All payments retrieved successfully', payments);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        ResponseFormatter.error(res, (error as Error).message || 'Failed to get payments', 500);
      }
    }
  }
}

export default new PaymentController();
