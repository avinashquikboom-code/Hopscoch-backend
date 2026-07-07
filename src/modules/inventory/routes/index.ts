import { Router } from 'express';
import InventoryController from '../controllers/inventory.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const inventoryController = InventoryController;

/**
 * @swagger
 * /inventory/movements:
 *   post:
 *     summary: Create a stock movement (Admin)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variantId
 *               - warehouseId
 *               - type
 *               - quantityChange
 *             properties:
 *               variantId:
 *                 type: string
 *                 format: uuid
 *               warehouseId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [RESTOCK, SALE, RETURN, ADJUSTMENT, DAMAGE]
 *               quantityChange:
 *                 type: integer
 *               reason:
 *                 type: string
 *               referenceOrderId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Stock movement created successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Validation error or insufficient stock
 */
router.post('/movements', authenticate, inventoryController.createStockMovement.bind(inventoryController));

/**
 * @swagger
 * /inventory:
 *   post:
 *     summary: Create inventory item (Admin)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sku
 *               - name
 *               - category
 *               - stock
 *               - location
 *             properties:
 *               sku:
 *                 type: string
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               stock:
 *                 type: integer
 *               minStock:
 *                 type: integer
 *               location:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inventory item created successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Validation error
 */
router.post('/', authenticate, inventoryController.createInventoryItem.bind(inventoryController));

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get inventory items with filters (Admin)
 *     tags: [Inventory]
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
 *         name: warehouseId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Inventory retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, inventoryController.getInventoryItems.bind(inventoryController));

/**
 * @swagger
 * /inventory/variant/{variantId}:
 *   get:
 *     summary: Get inventory by variant ID
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inventory retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Inventory not found
 */
router.get('/variant/:variantId', authenticate, inventoryController.getInventoryByVariant.bind(inventoryController));

/**
 * @swagger
 * /inventory/threshold:
 *   patch:
 *     summary: Update inventory low stock threshold (Admin)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventoryItemId
 *               - lowStockThreshold
 *             properties:
 *               inventoryItemId:
 *                 type: string
 *                 format: uuid
 *               lowStockThreshold:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Threshold updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Inventory item not found
 */
router.patch('/threshold', authenticate, inventoryController.updateInventoryThreshold.bind(inventoryController));

/**
 * @swagger
 * /inventory/movements:
 *   get:
 *     summary: Get stock movements with filters (Admin)
 *     tags: [Inventory]
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
 *         name: inventoryItemId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [RESTOCK, SALE, RETURN, ADJUSTMENT, DAMAGE]
 *     responses:
 *       200:
 *         description: Stock movements retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/movements', authenticate, inventoryController.getStockMovements.bind(inventoryController));

/**
 * @swagger
 * /inventory/warehouses:
 *   get:
 *     summary: Get all warehouses (Admin)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Warehouses retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/warehouses', authenticate, inventoryController.getWarehouses.bind(inventoryController));

/**
 * @swagger
 * /inventory/alerts/low-stock:
 *   get:
 *     summary: Get low stock alerts (Admin)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Low stock alerts retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/alerts/low-stock', authenticate, inventoryController.getLowStockAlerts.bind(inventoryController));

export default router;
