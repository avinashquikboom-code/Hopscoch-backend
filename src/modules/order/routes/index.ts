import { Router } from 'express';
import OrderController from '../controllers/order.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const orderController = OrderController;

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Place an order from the current cart
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - addressId
 *             properties:
 *               addressId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order placed successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Cart is empty or validation error
 */
router.post('/', authenticate, orderController.createOrder.bind(orderController));

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List the authenticated user's orders
 *     tags: [Orders]
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
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, orderController.getOrders.bind(orderController));

/**
 * @swagger
 * /orders/:orderId:
 *   get:
 *     summary: Get a single order's details and status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.get('/:orderId', authenticate, orderController.getOrderById.bind(orderController));

/**
 * @swagger
 * /orders/:orderId/cancel:
 *   patch:
 *     summary: Cancel an order (if still cancellable)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 *       400:
 *         description: Order cannot be cancelled at this stage
 */
router.patch('/:orderId/cancel', authenticate, orderController.cancelOrder.bind(orderController));

export default router;
