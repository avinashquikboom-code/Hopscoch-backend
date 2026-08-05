import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

// Public Webhook Endpoint called by Razorpay
router.post(
  ['/webhooks/razorpay', '/v1/webhooks/razorpay', '/payments/webhook'],
  WebhookController.handleRazorpayWebhook
);

// Admin Webhook Event Logs & Timeline
router.get(
  ['/admin/webhooks/logs', '/admin/payments/webhooks'],
  authenticate,
  authorize('ADMIN'),
  WebhookController.getWebhookLogs
);

export default router;
