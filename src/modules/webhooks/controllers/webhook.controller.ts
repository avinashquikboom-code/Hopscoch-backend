import { Request, Response, NextFunction } from 'express';
import { WebhookService } from '../services/webhook.service';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import { webhookLogQuerySchema } from '../validators/webhook.validator';
import { ZodError } from 'zod';

export class WebhookController {
  /**
   * Handle incoming Razorpay Webhook
   * Endpoint: POST /api/webhooks/razorpay
   */
  static async handleRazorpayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const result = await WebhookService.processEvent(rawBody, signature, req.body);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.statusCode === 401) {
        res.status(401).json({ success: false, message: error.message || 'Invalid signature' });
        return;
      }
      next(error);
    }
  }

  /**
   * Admin: Get Webhook Event Logs & Timeline
   * Endpoint: GET /api/admin/webhooks/logs
   */
  static async getWebhookLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const validatedQuery = webhookLogQuerySchema.parse(req.query);
      const result = await WebhookService.getWebhookLogs({
        page: Number(validatedQuery.page),
        limit: Number(validatedQuery.limit),
        eventType: validatedQuery.eventType,
        status: validatedQuery.status,
      });

      ResponseFormatter.success(res, 'Webhook logs retrieved successfully', result.logs, undefined, result.pagination);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }
}
