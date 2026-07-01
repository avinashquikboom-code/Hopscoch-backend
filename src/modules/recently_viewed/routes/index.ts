import { Router } from 'express';
import RecentlyViewController from '../controllers/recently-viewed.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const recentlyViewController = RecentlyViewController;

/**
 * @swagger
 * /recently-viewed:
 *   get:
 *     summary: Get the authenticated user's recently viewed products
 *     tags: [Recently Viewed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recently viewed products retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, recentlyViewController.getRecentlyViewed.bind(recentlyViewController));

/**
 * @swagger
 * /recently-viewed/:productId:
 *   post:
 *     summary: Record a product view (called on product detail open)
 *     tags: [Recently Viewed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product view recorded successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 */
router.post('/:productId', authenticate, recentlyViewController.recordView.bind(recentlyViewController));

/**
 * @swagger
 * /recently-viewed:
 *   delete:
 *     summary: Clear recently viewed history
 *     tags: [Recently Viewed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recently viewed history cleared successfully
 *       401:
 *         description: Authentication required
 */
router.delete('/', authenticate, recentlyViewController.clearRecentlyViewed.bind(recentlyViewController));

export default router;
