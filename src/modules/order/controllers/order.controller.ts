import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import OrderService from '../services/order.service';
import { createOrderSchema } from '../validators/order.validator';

export class OrderController {
  async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedData = createOrderSchema.parse(req.body);
      const order = await OrderService.createOrder(req.user.id, validatedData);
      ResponseFormatter.success(res, 'Order placed successfully', order);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { page = '1', limit = '20', status } = req.query;
      const orders = await OrderService.getOrders(req.user.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
      });
      ResponseFormatter.success(res, 'Orders retrieved successfully', orders);
    } catch (error) {
      throw error;
    }
  }

  async getOrderById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { orderId } = req.params;
      const order = await OrderService.getOrderById(req.user.id, orderId);
      ResponseFormatter.success(res, 'Order retrieved successfully', order);
    } catch (error) {
      throw error;
    }
  }

  async cancelOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { orderId } = req.params;
      const { reason } = req.body || {};
      const order = await OrderService.cancelOrder(req.user.id, orderId, reason);
      ResponseFormatter.success(res, 'Order cancelled successfully', order);
    } catch (error) {
      throw error;
    }
  }
}

export default new OrderController();
