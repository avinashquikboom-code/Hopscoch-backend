import { Router } from 'express';
import VisualSearchController from '../controllers/visual-search.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const visualSearchController = VisualSearchController;

/**
 * @swagger
 * /visual-search:
 *   post:
 *     summary: Upload an image and run visual product matching
 *     tags: [Visual Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Visual search completed successfully
 *       401:
 *         description: Authentication required
 */
router.post('/visual-search', authenticate, visualSearchController.search.bind(visualSearchController));

/**
 * @swagger
 * /visual-search/:queryId:
 *   get:
 *     summary: Get a previously run visual search query and its ranked matches
 *     tags: [Visual Search]
 *     parameters:
 *       - in: path
 *         name: queryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visual search query retrieved successfully
 *       404:
 *         description: Query not found
 */
router.get('/visual-search/:queryId', visualSearchController.getQuery.bind(visualSearchController));

/**
 * @swagger
 * /visual-search/history:
 *   get:
 *     summary: List the authenticated user's visual search history
 *     tags: [Visual Search]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visual search history retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/visual-search/history', authenticate, visualSearchController.getHistory.bind(visualSearchController));

/**
 * @swagger
 * /visual-search/:queryId:
 *   delete:
 *     summary: Delete a visual search history entry
 *     tags: [Visual Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visual search query deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Query not found
 */
router.delete('/visual-search/:queryId', authenticate, visualSearchController.deleteQuery.bind(visualSearchController));

export default router;
