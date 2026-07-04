import { Router } from 'express';
import ShipmentController from '../controllers/shipment.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const shipmentController = ShipmentController;

/**
 * @swagger
 * /shipments:
 *   post:
 *     summary: Create a shipment for an order (Admin)
 *     tags: [Shipments]
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
 *               - courierPartner
 *               - trackingNumber
 *               - estimatedDeliveryDate
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               courierPartner:
 *                 type: string
 *               trackingNumber:
 *                 type: string
 *               estimatedDeliveryDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Shipment created successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.post('/', authenticate, shipmentController.createShipment.bind(shipmentController));

/**
 * @swagger
 * /shipments/{orderId}/tracking:
 *   patch:
 *     summary: Update shipment tracking (Webhook or Admin)
 *     tags: [Shipments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
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
 *                 enum: [PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED]
 *               location:
 *                 type: string
 *               note:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Tracking updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.patch('/:orderId/tracking', authenticate, shipmentController.updateTracking.bind(shipmentController));

/**
 * @swagger
 * /shipments/order/{orderId}:
 *   get:
 *     summary: Get shipment by order ID
 *     tags: [Shipments]
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
 *         description: Shipment retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.get('/order/:orderId', authenticate, shipmentController.getShipmentByOrderId.bind(shipmentController));

/**
 * @swagger
 * /shipments/admin/all:
 *   get:
 *     summary: Get all shipments (Admin only)
 *     tags: [Shipments]
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
 *           enum: [PENDING, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED]
 *       - in: query
 *         name: courier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All shipments retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/admin/all', authenticate, shipmentController.getAllShipmentsForAdmin.bind(shipmentController));

/**
 * @swagger
 * /shipments/zone/{pincode}:
 *   get:
 *     summary: Check if pincode is serviceable
 *     tags: [Shipments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pincode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery zone retrieved successfully
 *       404:
 *         description: Pincode not serviceable
 */
router.get('/zone/:pincode', authenticate, shipmentController.checkDeliveryZone.bind(shipmentController));

/**
 * @swagger
 * /shipments/zones:
 *   get:
 *     summary: Get all delivery zones (Admin)
 *     tags: [Shipments]
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
 *     responses:
 *       200:
 *         description: Delivery zones retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/zones', authenticate, shipmentController.getAllDeliveryZones.bind(shipmentController));

export default router;
