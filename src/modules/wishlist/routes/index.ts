import { Router } from 'express';
import WishlistController from '../controllers/wishlist.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const wishlistController = WishlistController;

/**
 * @swagger
 * /wishlist:
 *   get:
 *     summary: Get the authenticated user's wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, wishlistController.getWishlist.bind(wishlistController));

/**
 * @swagger
 * /wishlist/:productId:
 *   post:
 *     summary: Add a product to the wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product added to wishlist successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found
 *       409:
 *         description: Product already in wishlist
 */
router.post('/:productId', authenticate, wishlistController.addToWishlist.bind(wishlistController));

/**
 * @swagger
 * /wishlist/:productId:
 *   delete:
 *     summary: Remove a product from the wishlist
 *     tags: [Wishlist]
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
 *         description: Product removed from wishlist successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Product not found in wishlist
 */
router.delete('/:productId', authenticate, wishlistController.removeFromWishlist.bind(wishlistController));

/**
 * @swagger
 * /wishlist/:productId/status:
 *   get:
 *     summary: Check whether a specific product is wishlisted
 *     tags: [Wishlist]
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
 *         description: Wishlist status retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/:productId/status', authenticate, wishlistController.getWishlistStatus.bind(wishlistController));

export default router;
