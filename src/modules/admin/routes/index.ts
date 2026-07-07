import { Router } from 'express';
import AdminController from '../controllers/admin.controller';
import { authenticate } from '../../../middleware/auth';
import { upload } from '../../../middleware/upload';

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
 * /admin/users/{userId}/avatar:
 *   put:
 *     summary: Update user avatar image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User avatar updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User not found
 */
router.put('/users/:userId/avatar', authenticate, upload.single('avatar'), adminController.updateAdminUser.bind(adminController));

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

/**
 * @swagger
 * /admin/customers:
 *   get:
 *     summary: Get all customers (Admin only)
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/customers', authenticate, adminController.getCustomers.bind(adminController));

/**
 * @swagger
 * /admin/customers/{customerId}:
 *   get:
 *     summary: Get customer details (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer details retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Customer not found
 */
router.get('/customers/:customerId', authenticate, adminController.getCustomerDetails.bind(adminController));

/**
 * @swagger
 * /admin/customers/{customerId}:
 *   patch:
 *     summary: Update customer (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
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
 *               isActive:
 *                 type: boolean
 *               isEmailVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Customer not found
 */
router.patch('/customers/:customerId', authenticate, adminController.updateCustomer.bind(adminController));

/**
 * @swagger
 * /admin/customers/{customerId}:
 *   delete:
 *     summary: Delete/Suspend customer (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Customer not found
 */
router.delete('/customers/:customerId', authenticate, adminController.deleteCustomer.bind(adminController));

/**
 * @swagger
 * /admin/products:
 *   get:
 *     summary: Get all products (Admin only)
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ARCHIVED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/products', authenticate, adminController.getProducts.bind(adminController));

/**
 * @swagger
 * /admin/products:
 *   post:
 *     summary: Create product (Admin only)
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
 *               - name
 *               - slug
 *               - description
 *               - categoryId
 *               - brandId
 *               - basePrice
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               brandId:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, UNISEX]
 *               ageGroup:
 *                 type: string
 *                 enum: [ADULT, KID, INFANT]
 *               isFeatured:
 *                 type: boolean
 *               isTrending:
 *                 type: boolean
 *               isNewArrival:
 *                 type: boolean
 *               isBestSeller:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/products', authenticate, adminController.createProduct.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}:
 *   get:
 *     summary: Get product details (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product details retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId', authenticate, adminController.getProductDetails.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}:
 *   put:
 *     summary: Update product (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *               isFeatured:
 *                 type: boolean
 *               isTrending:
 *                 type: boolean
 *               isNewArrival:
 *                 type: boolean
 *               isBestSeller:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.put('/products/:productId', authenticate, adminController.updateProduct.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}:
 *   delete:
 *     summary: Delete product (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.delete('/products/:productId', authenticate, adminController.deleteProduct.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}/thumbnail:
 *   put:
 *     summary: Update product thumbnail image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Product thumbnail updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.put('/products/:productId/thumbnail', authenticate, upload.single('thumbnail'), adminController.updateProduct.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}/images:
 *   put:
 *     summary: Update product images (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Product images updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.put('/products/:productId/images', authenticate, upload.array('images', 10), adminController.updateProduct.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}/video:
 *   put:
 *     summary: Update product video (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Product video updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.put('/products/:productId/video', authenticate, upload.single('video'), adminController.updateProduct.bind(adminController));

/**
 * @swagger
 * /admin/categories:
 *   get:
 *     summary: Get all categories (Admin only)
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/categories', authenticate, adminController.getCategories.bind(adminController));

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     summary: Create category (Admin only)
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
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               parentId:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Category created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/categories', authenticate, adminController.createCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{categoryId}:
 *   put:
 *     summary: Update category (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Category not found
 */
router.put('/categories/:categoryId', authenticate, adminController.updateCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{categoryId}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Category not found
 */
router.delete('/categories/:categoryId', authenticate, adminController.deleteCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{categoryId}/icon:
 *   put:
 *     summary: Update category icon image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               icon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Category icon updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Category not found
 */
router.put('/categories/:categoryId/icon', authenticate, upload.single('icon'), adminController.updateCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{categoryId}/banner:
 *   put:
 *     summary: Update category banner image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Category banner updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Category not found
 */
router.put('/categories/:categoryId/banner', authenticate, upload.single('banner'), adminController.updateCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{categoryId}/images:
 *   put:
 *     summary: Update category icon and banner images (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               icon:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Category images updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Category not found
 */
router.put('/categories/:categoryId/images', authenticate, upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), adminController.updateCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{parentId}/children:
 *   post:
 *     summary: Create subcategory under parent category (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *               isFeatured:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Subcategory created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/categories/:parentId/children', authenticate, upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), adminController.createCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{parentId}/children/icon:
 *   post:
 *     summary: Create subcategory with icon image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Subcategory created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/categories/:parentId/children/icon', authenticate, upload.single('icon'), adminController.createCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{parentId}/children/banner:
 *   post:
 *     summary: Create subcategory with banner image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Subcategory created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/categories/:parentId/children/banner', authenticate, upload.single('banner'), adminController.createCategory.bind(adminController));

/**
 * @swagger
 * /admin/categories/{parentId}/children/images:
 *   post:
 *     summary: Create subcategory with both icon and banner images (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Subcategory created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/categories/:parentId/children/images', authenticate, upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), adminController.createCategory.bind(adminController));

/**
 * @swagger
 * /admin/brands:
 *   get:
 *     summary: Get all brands (Admin only)
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Brands retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/brands', authenticate, adminController.getBrands.bind(adminController));

/**
 * @swagger
 * /admin/brands:
 *   post:
 *     summary: Create brand (Admin only)
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
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Brand created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/brands', authenticate, adminController.createBrand.bind(adminController));

/**
 * @swagger
 * /admin/brands/{brandId}:
 *   put:
 *     summary: Update brand (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Brand updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Brand not found
 */
router.put('/brands/:brandId', authenticate, adminController.updateBrand.bind(adminController));

/**
 * @swagger
 * /admin/brands/{brandId}:
 *   delete:
 *     summary: Delete brand (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Brand deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Brand not found
 */
router.delete('/brands/:brandId', authenticate, adminController.deleteBrand.bind(adminController));

/**
 * @swagger
 * /admin/brands/{brandId}/logo:
 *   put:
 *     summary: Update brand logo image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Brand logo updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Brand not found
 */
router.put('/brands/:brandId/logo', authenticate, upload.single('logo'), adminController.updateBrand.bind(adminController));

/**
 * @swagger
 * /admin/brands/{brandId}/banner:
 *   put:
 *     summary: Update brand banner image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Brand banner updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Brand not found
 */
router.put('/brands/:brandId/banner', authenticate, upload.single('banner'), adminController.updateBrand.bind(adminController));

/**
 * @swagger
 * /admin/brands/{brandId}/images:
 *   put:
 *     summary: Update brand logo and banner images (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Brand images updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Brand not found
 */
router.put('/brands/:brandId/images', authenticate, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), adminController.updateBrand.bind(adminController));

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     summary: Get all orders (Admin only)
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURNED, REPLACED, REFUNDED]
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
 *         description: Orders retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/orders', authenticate, adminController.getOrders.bind(adminController));

/**
 * @swagger
 * /admin/orders/{orderId}:
 *   get:
 *     summary: Get order details (Admin only)
 *     tags: [Admin]
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
 *         description: Order details retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.get('/orders/:orderId', authenticate, adminController.getOrderDetails.bind(adminController));

/**
 * @swagger
 * /admin/orders/{orderId}:
 *   patch:
 *     summary: Update order status (Admin only)
 *     tags: [Admin]
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
 *                 enum: [PENDING, CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURNED, REPLACED, REFUNDED]
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.patch('/orders/:orderId', authenticate, adminController.updateOrderStatus.bind(adminController));

/**
 * @swagger
 * /admin/orders/{orderId}/timeline:
 *   get:
 *     summary: Get order timeline (Admin only)
 *     tags: [Admin]
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
 *         description: Order timeline retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.get('/orders/:orderId/timeline', authenticate, adminController.getOrderTimeline.bind(adminController));

/**
 * @swagger
 * /admin/orders/{orderId}/invoice:
 *   put:
 *     summary: Upload order invoice (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               invoice:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Invoice uploaded successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Order not found
 */
router.put('/orders/:orderId/invoice', authenticate, upload.single('invoice'), adminController.updateOrderStatus.bind(adminController));

/**
 * @swagger
 * /admin/inventory:
 *   get:
 *     summary: Get all inventory (Admin only)
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
 *         name: lowStock
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Inventory retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/inventory', authenticate, adminController.getInventory.bind(adminController));

/**
 * @swagger
 * /admin/inventory:
 *   post:
 *     summary: Add inventory (Admin only)
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
 *               - productId
 *               - variantId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               lowStockThreshold:
 *                 type: integer
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inventory added successfully
 *       401:
 *         description: Authentication required
 */
router.post('/inventory', authenticate, adminController.addInventory.bind(adminController));

/**
 * @swagger
 * /admin/inventory/{inventoryId}:
 *   patch:
 *     summary: Update inventory (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventoryId
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
 *               quantity:
 *                 type: integer
 *               lowStockThreshold:
 *                 type: integer
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Inventory not found
 */
router.patch('/inventory/:inventoryId', authenticate, adminController.updateInventory.bind(adminController));

/**
 * @swagger
 * /admin/returns:
 *   get:
 *     summary: Get all return requests (Admin only)
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [REQUESTED, APPROVED, REJECTED, PROCESSING, COMPLETED, REFUNDED]
 *     responses:
 *       200:
 *         description: Return requests retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/returns', authenticate, adminController.getReturns.bind(adminController));

/**
 * @swagger
 * /admin/returns/{returnId}:
 *   get:
 *     summary: Get return details (Admin only)
 *     tags: [Admin]
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
 *         description: Return details retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Return not found
 */
router.get('/returns/:returnId', authenticate, adminController.getReturnDetails.bind(adminController));

/**
 * @swagger
 * /admin/returns/{returnId}:
 *   patch:
 *     summary: Update return status (Admin only)
 *     tags: [Admin]
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
 *                 enum: [APPROVED, REJECTED, PROCESSING, COMPLETED, REFUNDED]
 *               refundAmount:
 *                 type: number
 *               adminNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Return status updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Return not found
 */
router.patch('/returns/:returnId', authenticate, adminController.updateReturnStatus.bind(adminController));

/**
 * @swagger
 * /admin/analytics/sales:
 *   get:
 *     summary: Get sales analytics (Admin only)
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: Sales analytics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics/sales', authenticate, adminController.getSalesAnalytics.bind(adminController));

/**
 * @swagger
 * /admin/analytics/products:
 *   get:
 *     summary: Get product analytics (Admin only)
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: Product analytics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics/products', authenticate, adminController.getProductAnalytics.bind(adminController));

/**
 * @swagger
 * /admin/analytics/users:
 *   get:
 *     summary: Get user analytics (Admin only)
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics/users', authenticate, adminController.getUserAnalytics.bind(adminController));

router.get('/analytics/full', authenticate, adminController.getFullAnalytics.bind(adminController));

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get settings (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/settings', authenticate, adminController.getSettings.bind(adminController));

/**
 * @swagger
 * /admin/settings:
 *   put:
 *     summary: Update settings (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               siteName:
 *                 type: string
 *               siteDescription:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               currency:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       401:
 *         description: Authentication required
 */
router.put('/settings', authenticate, adminController.updateSettings.bind(adminController));

/**
 * @swagger
 * /admin/images:
 *   post:
 *     summary: Upload image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               altText:
 *                 type: string
 *               entityType:
 *                 type: string
 *               entityId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       401:
 *         description: Authentication required
 */
router.post('/images', authenticate, upload.single('image'), adminController.uploadImage.bind(adminController));
router.post('/upload', authenticate, upload.single('file'), adminController.uploadFile.bind(adminController));

/**
 * @swagger
 * /admin/images/{imageId}:
 *   delete:
 *     summary: Delete image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Image not found
 */
router.delete('/images/:imageId', authenticate, adminController.deleteImage.bind(adminController));

/**
 * @swagger
 * /admin/coupons:
 *   get:
 *     summary: Get all coupons (Admin only)
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, EXPIRED]
 *     responses:
 *       200:
 *         description: Coupons retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/coupons', authenticate, adminController.getCoupons.bind(adminController));

/**
 * @swagger
 * /admin/coupons:
 *   post:
 *     summary: Create coupon (Admin only)
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
 *               - code
 *               - discountType
 *               - discountValue
 *             properties:
 *               code:
 *                 type: string
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *               discountValue:
 *                 type: number
 *               maxDiscount:
 *                 type: number
 *               minPurchase:
 *                 type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               usageLimit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Coupon created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/coupons', authenticate, adminController.createCoupon.bind(adminController));

/**
 * @swagger
 * /admin/coupons/{couponId}:
 *   put:
 *     summary: Update coupon (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: couponId
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
 *               discountValue:
 *                 type: number
 *               maxDiscount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, EXPIRED]
 *     responses:
 *       200:
 *         description: Coupon updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Coupon not found
 */
router.put('/coupons/:couponId', authenticate, adminController.updateCoupon.bind(adminController));

/**
 * @swagger
 * /admin/coupons/{couponId}:
 *   delete:
 *     summary: Delete coupon (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Coupon deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Coupon not found
 */
router.delete('/coupons/:couponId', authenticate, adminController.deleteCoupon.bind(adminController));

/**
 * @swagger
 * /admin/taxes:
 *   get:
 *     summary: Get all tax configurations (Admin only)
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
 *     responses:
 *       200:
 *         description: Tax configurations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/taxes', authenticate, adminController.getTaxes.bind(adminController));

/**
 * @swagger
 * /admin/taxes:
 *   post:
 *     summary: Create tax configuration (Admin only)
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
 *               - name
 *               - rate
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               rate:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *               country:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tax configuration created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/taxes', authenticate, adminController.createTax.bind(adminController));

/**
 * @swagger
 * /admin/taxes/{taxId}:
 *   put:
 *     summary: Update tax configuration (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taxId
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
 *               rate:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tax configuration updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Tax not found
 */
router.put('/taxes/:taxId', authenticate, adminController.updateTax.bind(adminController));

/**
 * @swagger
 * /admin/taxes/{taxId}:
 *   delete:
 *     summary: Delete tax configuration (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taxId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tax configuration deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Tax not found
 */
router.delete('/taxes/:taxId', authenticate, adminController.deleteTax.bind(adminController));

/**
 * @swagger
 * /admin/shipping:
 *   get:
 *     summary: Get all shipping configurations (Admin only)
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
 *     responses:
 *       200:
 *         description: Shipping configurations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/shipping', authenticate, adminController.getShippingConfigs.bind(adminController));

/**
 * @swagger
 * /admin/shipping:
 *   post:
 *     summary: Create shipping configuration (Admin only)
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
 *               - name
 *               - type
 *               - cost
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [FLAT_RATE, FREE, WEIGHT_BASED, PRICE_BASED]
 *               cost:
 *                 type: number
 *               minOrderAmount:
 *                 type: number
 *               countries:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Shipping configuration created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/shipping', authenticate, adminController.createShippingConfig.bind(adminController));

/**
 * @swagger
 * /admin/shipping/{shippingId}:
 *   put:
 *     summary: Update shipping configuration (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shippingId
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
 *               cost:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Shipping configuration updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Shipping not found
 */
router.put('/shipping/:shippingId', authenticate, adminController.updateShippingConfig.bind(adminController));

/**
 * @swagger
 * /admin/shipping/{shippingId}:
 *   delete:
 *     summary: Delete shipping configuration (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shippingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Shipping configuration deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Shipping not found
 */
router.delete('/shipping/:shippingId', authenticate, adminController.deleteShippingConfig.bind(adminController));

/**
 * @swagger
 * /admin/notifications:
 *   get:
 *     summary: Get all notifications (Admin only)
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
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/notifications', authenticate, adminController.getNotifications.bind(adminController));

/**
 * @swagger
 * /admin/notifications:
 *   post:
 *     summary: Send notification (Admin only)
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
 *               - title
 *               - message
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [ORDER_UPDATE, PROMOTION, SYSTEM, ANNOUNCEMENT]
 *               targetAudience:
 *                 type: string
 *                 enum: [ALL, CUSTOMERS, ADMINS]
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       401:
 *         description: Authentication required
 */
router.post('/notifications', authenticate, adminController.sendNotification.bind(adminController));

/**
 * @swagger
 * /admin/collections:
 *   get:
 *     summary: Get all collections (Admin only)
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
 *     responses:
 *       200:
 *         description: Collections retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/collections', authenticate, adminController.getCollections.bind(adminController));

/**
 * @swagger
 * /admin/collections:
 *   post:
 *     summary: Create collection (Admin only)
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
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Collection created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/collections', authenticate, adminController.createCollection.bind(adminController));

/**
 * @swagger
 * /admin/collections/{collectionId}:
 *   put:
 *     summary: Update collection (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Collection updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Collection not found
 */
router.put('/collections/:collectionId', authenticate, adminController.updateCollection.bind(adminController));

/**
 * @swagger
 * /admin/collections/{collectionId}:
 *   delete:
 *     summary: Delete collection (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Collection deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Collection not found
 */
router.delete('/collections/:collectionId', authenticate, adminController.deleteCollection.bind(adminController));

/**
 * @swagger
 * /admin/collections/{collectionId}/image:
 *   put:
 *     summary: Update collection image (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Collection image updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Collection not found
 */
router.put('/collections/:collectionId/image', authenticate, upload.single('image'), adminController.updateCollection.bind(adminController));

/**
 * @swagger
 * /admin/inventory/stock/{variantId}:
 *   put:
 *     summary: Update product variant stock (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stock:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Variant not found
 */
router.put('/inventory/stock/:variantId', authenticate, adminController.updateVariantStock.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}/variants:
 *   post:
 *     summary: Create product variant (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               size:
 *                 type: string
 *               color:
 *                 type: string
 *               material:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Variant created successfully
 *       401:
 *         description: Authentication required
 */
router.post('/products/:productId/variants', authenticate, adminController.createProductVariant.bind(adminController));

/**
 * @swagger
 * /admin/products/{productId}/variants/{variantId}:
 *   put:
 *     summary: Update product variant (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               size:
 *                 type: string
 *               color:
 *                 type: string
 *               material:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Variant updated successfully
 *       401:
 *         description: Authentication required
 */
router.put('/products/:productId/variants/:variantId', authenticate, adminController.updateProductVariant.bind(adminController));

/**
 * @swagger
 * /admin/reviews:
 *   get:
 *     summary: Get all reviews (Admin only)
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/reviews', authenticate, adminController.getReviews.bind(adminController));

/**
 * @swagger
 * /admin/reviews/{reviewId}:
 *   get:
 *     summary: Get review details (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Review not found
 */
router.get('/reviews/:reviewId', authenticate, adminController.getReviewDetails.bind(adminController));

/**
 * @swagger
 * /admin/reviews/{reviewId}:
 *   put:
 *     summary: Update review status (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Review status updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Review not found
 */
router.put('/reviews/:reviewId', authenticate, adminController.updateReviewStatus.bind(adminController));

/**
 * @swagger
 * /admin/reviews/{reviewId}:
 *   delete:
 *     summary: Delete review (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Review not found
 */
router.delete('/reviews/:reviewId', authenticate, adminController.deleteReview.bind(adminController));

/**
 * @swagger
 * /admin/wishlist:
 *   get:
 *     summary: Get all wishlist items (Admin only)
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
 *     responses:
 *       200:
 *         description: Wishlist items retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/wishlist', authenticate, adminController.getWishlist.bind(adminController));

/**
 * @swagger
 * /admin/cart:
 *   get:
 *     summary: Get all cart items (Admin only)
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
 *     responses:
 *       200:
 *         description: Cart items retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/cart', authenticate, adminController.getCart.bind(adminController));

export default router;
