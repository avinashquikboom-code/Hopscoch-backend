import { Router } from 'express';
import CartController from '../controllers/cart.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const cartController = CartController;

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get the authenticated user's current cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, cartController.getCart.bind(cartController));

/**
 * @swagger
 * /cart:
 *   post:
 *     summary: Add a product (with size/color variant and quantity) to the cart
 *     tags: [Cart]
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
 *             properties:
 *               productId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       200:
 *         description: Product added to cart successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Insufficient stock or validation error
 */
router.post('/', authenticate, cartController.addToCart.bind(cartController));

/**
 * @swagger
 * /cart/:cartItemId:
 *   patch:
 *     summary: Update quantity or variant for an existing cart item
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cartItemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *               savedForLater:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Cart item not found
 */
router.patch('/:cartItemId', authenticate, cartController.updateCartItem.bind(cartController));

/**
 * @swagger
 * /cart/:cartItemId:
 *   delete:
 *     summary: Remove an item from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cartItemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cart item removed successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Cart item not found
 */
router.delete('/:cartItemId', authenticate, cartController.removeFromCart.bind(cartController));

/**
 * @swagger
 * /cart:
 *   delete:
 *     summary: Clear the entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Authentication required
 */
router.delete('/', authenticate, cartController.clearCart.bind(cartController));

export default router;
