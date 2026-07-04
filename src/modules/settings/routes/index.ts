import { Router } from 'express';
import SettingsController from '../controllers/settings.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const settingsController = SettingsController;

/**
 * @swagger
 * /settings/app:
 *   get:
 *     summary: Get app settings (Public)
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: App settings retrieved successfully
 */
router.get('/app', settingsController.getAppSettings.bind(settingsController));

/**
 * @swagger
 * /settings/app:
 *   patch:
 *     summary: Update app settings (Admin)
 *     tags: [Settings]
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
 *               siteUrl:
 *                 type: string
 *                 format: uri
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *               faviconUrl:
 *                 type: string
 *                 format: uri
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               socialLinks:
 *                 type: object
 *               seoTitle:
 *                 type: string
 *               seoDescription:
 *                 type: string
 *     responses:
 *       200:
 *         description: App settings updated successfully
 *       401:
 *         description: Authentication required
 */
router.patch('/app', authenticate, settingsController.updateAppSettings.bind(settingsController));

/**
 * @swagger
 * /settings/user:
 *   get:
 *     summary: Get user preferences
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/user', authenticate, settingsController.getUserPreferences.bind(settingsController));

/**
 * @swagger
 * /settings/user:
 *   patch:
 *     summary: Update user preferences
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currency:
 *                 type: string
 *               language:
 *                 type: string
 *               pushOptIn:
 *                 type: boolean
 *               emailOptIn:
 *                 type: boolean
 *               smsOptIn:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User preferences updated successfully
 *       401:
 *         description: Authentication required
 */
router.patch('/user', authenticate, settingsController.updateUserPreferences.bind(settingsController));

/**
 * @swagger
 * /settings/languages:
 *   get:
 *     summary: Get supported languages (Public)
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Languages retrieved successfully
 */
router.get('/languages', settingsController.getLanguages.bind(settingsController));

/**
 * @swagger
 * /settings/currencies:
 *   get:
 *     summary: Get supported currencies (Public)
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Currencies retrieved successfully
 */
router.get('/currencies', settingsController.getCurrencies.bind(settingsController));

export default router;
