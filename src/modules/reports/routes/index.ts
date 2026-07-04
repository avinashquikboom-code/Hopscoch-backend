import { Router } from 'express';
import ReportController from '../controllers/report.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const reportController = ReportController;

/**
 * @swagger
 * /reports/sales:
 *   get:
 *     summary: Get sales report (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
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
 *         description: Sales report retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/sales', authenticate, reportController.getSalesReport.bind(reportController));

/**
 * @swagger
 * /reports/inventory:
 *   get:
 *     summary: Get inventory report (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: warehouseId
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Inventory report retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/inventory', authenticate, reportController.getInventoryReport.bind(reportController));

/**
 * @swagger
 * /reports/customers:
 *   get:
 *     summary: Get customer report (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
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
 *         description: Customer report retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/customers', authenticate, reportController.getCustomerReport.bind(reportController));

/**
 * @swagger
 * /reports/orders:
 *   get:
 *     summary: Get order report (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURNED, REPLACED, REFUNDED]
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
 *         description: Order report retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/orders', authenticate, reportController.getOrderReport.bind(reportController));

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     summary: Get dashboard metrics (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/dashboard', authenticate, reportController.getDashboardMetrics.bind(reportController));

export default router;
