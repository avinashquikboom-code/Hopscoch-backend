import { Router } from 'express';
import AdminController from '../controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const adminController = AdminController;

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new admin user (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, ADMIN]
 *                 default: ADMIN
 *     responses:
 *       200:
 *         description: Admin user created successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Validation error or email already exists
 */
router.post('/users', authenticate, adminController.createAdminUser.bind(adminController));

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all admin users (Admin only)
 *     tags: [Admin]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, ADMIN]
 *     responses:
 *       200:
 *         description: Admin users retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/users', authenticate, adminController.getAdminUsers.bind(adminController));

/**
 * @swagger
 * /admin/users/{userId}:
 *   patch:
 *     summary: Update admin user (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, ADMIN]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Admin user updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User not found
 */
router.patch('/users/:userId', authenticate, adminController.updateAdminUser.bind(adminController));

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Delete admin user (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Admin user deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User not found
 */
router.delete('/users/:userId', authenticate, adminController.deleteAdminUser.bind(adminController));

/**
 * @swagger
 * /admin/activity-logs:
 *   get:
 *     summary: Get activity logs (Admin only)
 *     tags: [Admin]
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
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Activity logs retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/activity-logs', authenticate, adminController.getActivityLogs.bind(adminController));

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard stats (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     totalOrders:
 *                       type: integer
 *                     totalRevenue:
 *                       type: number
 *                     pendingReturns:
 *                       type: integer
 *                     lowStockItems:
 *                       type: integer
 *                     totalProducts:
 *                       type: integer
 *                 recentOrders:
 *                   type: array
 *                   items:
 *                     type: object
 *                 recentActivity:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Authentication required
 */
router.get('/dashboard', authenticate, adminController.getDashboardStats.bind(adminController));

/**
 * @swagger
 * /admin/profile:
 *   get:
 *     summary: Get current admin profile (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 role:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *                 isEmailVerified:
 *                   type: boolean
 *                 lastLoginAt:
 *                   type: string
 *                   format: date-time
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 */
router.get('/profile', authenticate, adminController.getAdminProfile.bind(adminController));
router.put('/profile', authenticate, adminController.updateAdminProfile.bind(adminController));

/**
 * @swagger
 * /admin/logout:
 *   post:
 *     summary: Logout admin (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Authentication required
 */
router.post('/logout', authenticate, adminController.logoutAdmin.bind(adminController));

export default router;
