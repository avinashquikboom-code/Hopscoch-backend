import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import IntegrationController from '../modules/settings/controllers/integration.controller';
import PaymentController from '../modules/payments/controllers/payment.controller';
import ShipmentController from '../modules/shipments/controllers/shipment.controller';
import OrderController from '../modules/order/controllers/order.controller';

const router = Router();

// ==========================================
// ADMIN MODULES (Settings, Payments, Shipping)
// ==========================================

// Integrations Settings (Admin only)
router.get(
  '/admin/settings/integrations',
  authenticate,
  authorize('ADMIN'),
  IntegrationController.getIntegrationSettings.bind(IntegrationController)
);
router.put(
  '/admin/settings/integrations',
  authenticate,
  authorize('ADMIN'),
  IntegrationController.updateIntegrationSettings.bind(IntegrationController)
);
router.post(
  '/admin/settings/integrations/test',
  authenticate,
  authorize('ADMIN'),
  IntegrationController.testConnection.bind(IntegrationController)
);

// Shipping Admin Operations
router.get(
  '/admin/shipping/dashboard',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.getShippingDashboard.bind(ShipmentController)
);
router.post(
  '/admin/shipping/create',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.createShipment.bind(ShipmentController)
);
router.post(
  '/admin/shipping/awb',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.generateAWB.bind(ShipmentController)
);
router.post(
  '/admin/shipping/label',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.generateLabel.bind(ShipmentController)
);
router.post(
  '/admin/shipping/invoice',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.generateInvoice.bind(ShipmentController)
);
router.post(
  '/admin/shipping/pickup',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.schedulePickup.bind(ShipmentController)
);
router.post(
  '/admin/shipping/cancel',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.cancelShipment.bind(ShipmentController)
);
router.get(
  '/admin/shipping/track/:orderId',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.trackShipment.bind(ShipmentController)
);
router.get(
  '/admin/shipping/all',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.getAllShipmentsForAdmin.bind(ShipmentController)
);

// Payments Admin Operations
router.get(
  '/admin/payments/dashboard',
  authenticate,
  authorize('ADMIN'),
  PaymentController.getPaymentsDashboard.bind(PaymentController)
);
router.get(
  '/admin/payments',
  authenticate,
  authorize('ADMIN'),
  PaymentController.getAllPaymentsForAdmin.bind(PaymentController)
);
router.get(
  '/admin/payments/:orderId',
  authenticate,
  authorize('ADMIN'),
  PaymentController.getPaymentByOrderId.bind(PaymentController)
);
router.post(
  '/admin/payments/:paymentId/refund',
  authenticate,
  authorize('ADMIN'),
  PaymentController.processRefund.bind(PaymentController)
);

// ==========================================
// CUSTOMER / WEB MODULES
// ==========================================

// Web Shipping
router.get(
  '/web/shipping/track/:orderId',
  authenticate,
  ShipmentController.trackShipment.bind(ShipmentController)
);
router.post(
  '/web/shipping/return',
  authenticate,
  ShipmentController.createReturnRequest.bind(ShipmentController)
);

// Web Payments
router.get(
  '/web/payments/config',
  authenticate,
  PaymentController.getRazorpayConfig.bind(PaymentController)
);
router.post(
  '/web/payments/order',
  authenticate,
  PaymentController.createRazorpayOrder.bind(PaymentController)
);
router.post(
  '/web/payments/verify',
  authenticate,
  PaymentController.verifyRazorpayPayment.bind(PaymentController)
);

// ==========================================
// MOBILE / FLUTTER MODULES
// ==========================================

// Mobile Shipping
router.get(
  '/mobile/shipping/track/:orderId',
  authenticate,
  ShipmentController.trackShipment.bind(ShipmentController)
);
router.post(
  '/mobile/shipping/return',
  authenticate,
  ShipmentController.createReturnRequest.bind(ShipmentController)
);

// Mobile Payments
router.get(
  '/mobile/payments/config',
  authenticate,
  PaymentController.getRazorpayConfig.bind(PaymentController)
);
router.post(
  '/mobile/payments/order',
  authenticate,
  PaymentController.createRazorpayOrder.bind(PaymentController)
);
router.post(
  '/mobile/payments/verify',
  authenticate,
  PaymentController.verifyRazorpayPayment.bind(PaymentController)
);

// ==========================================
// WEBHOOKS
// ==========================================
router.post('/shipping/webhook', ShipmentController.handleWebhook.bind(ShipmentController));
router.post('/payments/webhook', PaymentController.handleWebhook.bind(PaymentController));

// Web and Mobile Order Creation Routes (Phase 1)
router.post('/web/orders', authenticate, OrderController.createOrder.bind(OrderController));
router.post('/mobile/orders', authenticate, OrderController.createOrder.bind(OrderController));

export default router;
