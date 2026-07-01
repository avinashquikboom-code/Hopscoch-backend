import { Router } from 'express';
import UserController from '../controllers/user.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const userController = UserController;

/**
 * @swagger
 * /users/:userId:
 *   get:
 *     summary: Get a user's public profile by id
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:userId', userController.getUserProfile.bind(userController));

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *               phone:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Authentication required
 */
router.patch('/me', authenticate, userController.updateCurrentUser.bind(userController));

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Delete the authenticated user's account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Authentication required
 */
router.delete('/me', authenticate, userController.deleteCurrentUser.bind(userController));

export default router;
