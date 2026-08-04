import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import IntegrationController from '../modules/settings/controllers/integration.controller';
import PaymentController from '../modules/payments/controllers/payment.controller';
import ShipmentController from '../modules/shipments/controllers/shipment.controller';
import OrderController from '../modules/order/controllers/order.controller';
import addressRoutes from '../modules/address/routes';
import VisualSearchController from '../modules/visual_search/controllers/visual-search.controller';
import { upload } from '../middleware/upload';

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
router.get(
  '/admin/settings/integrations/test',
  authenticate,
  authorize('ADMIN'),
  IntegrationController.testConnection.bind(IntegrationController)
);

// Reset System Data (Admin only)
router.post(
  '/admin/settings/reset-data',
  authenticate,
  authorize('ADMIN'),
  IntegrationController.resetData.bind(IntegrationController)
);

// Gift Wrap Config (Public GET + Admin PUT)
router.get(
  '/config/gift-wrap',
  IntegrationController.getGiftWrapConfig.bind(IntegrationController)
);
router.put(
  '/admin/settings/gift-wrap',
  authenticate,
  authorize('ADMIN'),
  IntegrationController.updateGiftWrapConfig.bind(IntegrationController)
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
router.get(
  '/admin/shipping/awb',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.getAWBDetails.bind(ShipmentController)
);
router.get(
  '/admin/shipping/awb/:orderId',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.getAWBDetails.bind(ShipmentController)
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
router.get(
  '/admin/shipping/label/:orderId/download',
  (req: any, res: any) => ShipmentController.downloadLabel(req, res)
);
router.post(
  '/admin/shipping/invoice',
  authenticate,
  authorize('ADMIN'),
  ShipmentController.generateInvoice.bind(ShipmentController)
);
router.get(
  '/admin/shipping/invoice/:orderId/download',
  (req: any, res: any) => ShipmentController.downloadInvoice(req, res)
);
router.get(
  '/admin/orders/:orderId/invoice',
  (req: any, res: any) => ShipmentController.downloadInvoice(req, res)
);
router.get(
  '/web/orders/:orderId/invoice',
  (req: any, res: any) => ShipmentController.downloadInvoice(req, res)
);
router.get(
  '/orders/:orderId/invoice',
  (req: any, res: any) => ShipmentController.downloadInvoice(req, res)
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
  optionalAuth,
  PaymentController.createRazorpayOrder.bind(PaymentController)
);
router.post(
  '/mobile/payments/verify',
  authenticate,
  PaymentController.verifyRazorpayPayment.bind(PaymentController)
);

// Visual Search (AI Gemini Vision)
router.post(
  '/mobile/search/visual',
  optionalAuth,
  upload.single('image'),
  VisualSearchController.searchVisual.bind(VisualSearchController)
);
router.post(
  '/web/search/visual',
  optionalAuth,
  upload.single('image'),
  VisualSearchController.searchVisual.bind(VisualSearchController)
);
router.post(
  '/search/visual',
  optionalAuth,
  upload.single('image'),
  VisualSearchController.searchVisual.bind(VisualSearchController)
);

// ==========================================
// WEBHOOKS
// ==========================================
router.post('/shipping/webhook', ShipmentController.handleWebhook.bind(ShipmentController));
router.post('/payments/webhook', PaymentController.handleWebhook.bind(PaymentController));

// Web and Mobile Order Creation Routes (Phase 1)
router.post('/web/orders', authenticate, OrderController.createOrder.bind(OrderController));
router.post('/mobile/orders', authenticate, OrderController.createOrder.bind(OrderController));

router.use('/addresses', addressRoutes);

// ==========================================
// REVIEW ENDPOINTS (Mobile + Web — same handler)
// ==========================================
// POST   /api/mobile/products/:id/reviews
// GET    /api/mobile/products/:id/reviews
// GET    /api/mobile/products/:id/reviews/my-review
// (same paths for /web/)
import reviewRoutes from '../modules/review/routes';

router.post('/mobile/products/:productId/reviews', (req, res, next) => {
  req.params.productId = req.params.productId;
  // Forward to the mounted review router's POST /product/:productId
  req.url = `/product/${req.params.productId}`;
  reviewRoutes(req, res, next);
});

router.get('/mobile/products/:productId/reviews', (req, res, next) => {
  req.url = `/product/${req.params.productId}`;
  reviewRoutes(req, res, next);
});

router.get('/mobile/products/:productId/reviews/my-review', (req, res, next) => {
  req.url = `/product/${req.params.productId}/my-review`;
  reviewRoutes(req, res, next);
});

router.post('/web/products/:productId/reviews', (req, res, next) => {
  req.url = `/product/${req.params.productId}`;
  reviewRoutes(req, res, next);
});

router.get('/web/products/:productId/reviews', (req, res, next) => {
  req.url = `/product/${req.params.productId}`;
  reviewRoutes(req, res, next);
});

router.get('/web/products/:productId/reviews/my-review', (req, res, next) => {
  req.url = `/product/${req.params.productId}/my-review`;
  reviewRoutes(req, res, next);
});

export default router;

