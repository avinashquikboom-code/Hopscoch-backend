import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import { authenticate } from '../../../middleware/auth';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();
const paymentController = PaymentController;

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Create a payment for an order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - method
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               method:
 *                 type: string
 *                 enum: [RAZORPAY, STRIPE, UPI, CARD, WALLET, COD]
 *               providerRef:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment created successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Validation error or order not eligible for payment
 */
router.post('/', authenticate, paymentController.createPayment.bind(paymentController));

/**
 * @swagger
 * /payments/{paymentId}/status:
 *   patch:
 *     summary: Update payment status (Webhook or Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, AUTHORIZED, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED]
 *               providerRef:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Payment not found
 */
router.patch('/:paymentId/status', authenticate, paymentController.updatePaymentStatus.bind(paymentController));

/**
 * @swagger
 * /payments/{paymentId}/refund:
 *   post:
 *     summary: Process refund for a payment (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refundAmount
 *               - refundReason
 *             properties:
 *               refundAmount:
 *                 type: number
 *               refundReason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Invalid refund amount or payment not eligible
 */
router.post('/:paymentId/refund', authenticate, paymentController.processRefund.bind(paymentController));

/**
 * @swagger
 * /payments/order/{orderId}:
 *   get:
 *     summary: Get payment by order ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Payment not found
 */
router.get('/order/:orderId', authenticate, paymentController.getPaymentByOrderId.bind(paymentController));

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: List the authenticated user's payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, AUTHORIZED, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED]
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [RAZORPAY, STRIPE, UPI, CARD, WALLET, COD]
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, paymentController.getPaymentsForUser.bind(paymentController));

/**
 * @swagger
 * /payments/admin/all:
 *   get:
 *     summary: Get all payments (Admin only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, AUTHORIZED, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED]
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [RAZORPAY, STRIPE, UPI, CARD, WALLET, COD]
 *     responses:
 *       200:
 *         description: All payments retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/admin/all', authenticate, paymentController.getAllPaymentsForAdmin.bind(paymentController));

// Refunds endpoints for admin ledger
router.get('/refunds', authenticate, async (req, res, next) => {
  try {
    const returnRequests = await prisma.returnRequest.findMany({
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              }
            },
            payment: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const refunds = returnRequests.map(r => {
      const payment = r.order.payment;
      return {
        id: r.id,
        orderId: r.orderId,
        customerName: `${r.order.user.firstName} ${r.order.user.lastName || ''}`.trim(),
        email: r.order.user.email,
        amount: payment ? Number(payment.amount) : 0,
        type: r.isReplacement ? 'replacement' : 'full',
        reason: r.reason,
        status: r.status === 'REQUESTED' ? 'pending' : r.status === 'APPROVED' ? 'approved' : r.status === 'REJECTED' ? 'rejected' : 'completed',
        paymentMethod: payment ? payment.method : 'COD',
        paymentGateway: payment ? (payment.providerRef ? 'Razorpay' : 'Manual') : 'Manual',
        transactionId: payment ? String(payment.id) : '',
        gatewayTransactionId: payment ? payment.providerRef || '' : '',
        createdAt: r.createdAt
      };
    });

    return ResponseFormatter.success(res, 'Refunds retrieved successfully', refunds);
  } catch (error) {
    return next(error);
  }
});

router.patch('/refunds/:id/status', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let returnStatus: any = 'REQUESTED';
    if (status === 'approved') returnStatus = 'APPROVED';
    if (status === 'rejected') returnStatus = 'REJECTED';
    if (status === 'completed') returnStatus = 'RECEIVED';

    const updatedRequest = await prisma.returnRequest.update({
      where: { id: Number(id) },
      data: {
        status: returnStatus
      }
    });

    return ResponseFormatter.success(res, 'Refund status updated successfully', updatedRequest);
  } catch (error) {
    return next(error);
  }
});

export default router;
