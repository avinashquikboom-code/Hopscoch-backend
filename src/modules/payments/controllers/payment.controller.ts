import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import PaymentService from '../services/payment.service';
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
        throw error;
      }
    }
  }

  async updatePaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { status, providerRef } = req.body;
      const payment = await PaymentService.updatePaymentStatus(paymentId, status, providerRef);
      ResponseFormatter.success(res, 'Payment status updated successfully', payment);
    } catch (error) {
      throw error;
    }
  }

  async processRefund(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const validatedData = processRefundSchema.parse(req.body);
      const payment = await PaymentService.processRefund(paymentId, validatedData);
      ResponseFormatter.success(res, 'Refund processed successfully', payment);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getPaymentByOrderId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const payment = await PaymentService.getPaymentByOrderId(orderId);
      ResponseFormatter.success(res, 'Payment retrieved successfully', payment);
    } catch (error) {
      throw error;
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
        throw error;
      }
    }
  }

  async getAllPaymentsForAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
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
        throw error;
      }
    }
  }
}

export default new PaymentController();
