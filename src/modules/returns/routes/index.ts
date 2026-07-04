import { Router } from 'express';
import ReturnController from '../controllers/return.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const returnController = ReturnController;

/**
 * @swagger
 * /returns:
 *   post:
 *     summary: Create a return request for an order
 *     tags: [Returns]
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
 *               - reason
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *               isReplacement:
 *                 type: boolean
 *                 default: false
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Return request created successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Validation error or order not eligible for return
 */
router.post('/', authenticate, returnController.createReturnRequest.bind(returnController));

/**
 * @swagger
 * /returns:
 *   get:
 *     summary: List the authenticated user's return requests
 *     tags: [Returns]
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
 *           enum: [REQUESTED, APPROVED, REJECTED, PICKED_UP, RECEIVED, REFUND_INITIATED, REFUND_COMPLETED]
 *     responses:
 *       200:
 *         description: Returns retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, returnController.getReturns.bind(returnController));

/**
 * @swagger
 * /returns/{returnId}:
 *   get:
 *     summary: Get a single return request details
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: returnId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Return retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Return not found
 */
router.get('/:returnId', authenticate, returnController.getReturnById.bind(returnController));

/**
 * @swagger
 * /returns/{returnId}/status:
 *   patch:
 *     summary: Update return request status (Admin only)
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: returnId
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
 *                 enum: [REQUESTED, APPROVED, REJECTED, PICKED_UP, RECEIVED, REFUND_INITIATED, REFUND_COMPLETED]
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Return status updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Return not found
 *       400:
 *         description: Invalid status transition
 */
router.patch('/:returnId/status', authenticate, returnController.updateReturnStatus.bind(returnController));

/**
 * @swagger
 * /returns/admin/all:
 *   get:
 *     summary: Get all return requests (Admin only)
 *     tags: [Returns]
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
 *           enum: [REQUESTED, APPROVED, REJECTED, PICKED_UP, RECEIVED, REFUND_INITIATED, REFUND_COMPLETED]
 *     responses:
 *       200:
 *         description: All returns retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/admin/all', authenticate, returnController.getAllReturnsForAdmin.bind(returnController));

export default router;
