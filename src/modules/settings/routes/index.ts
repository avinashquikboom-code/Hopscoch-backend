import { Router } from 'express';
import SettingsController from '../controllers/settings.controller';
import { authenticate } from '../../../middleware/auth';
import MarketingService from '../../marketing/services/marketing.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import path from 'path';
import fs from 'fs';

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

// Banners management API routes
router.get('/banners', authenticate, async (req, res, next) => {
  try {
    const banners = await MarketingService.getBanners({});
    return ResponseFormatter.success(res, 'Banners retrieved successfully', banners);
  } catch (error) {
    return next(error);
  }
});

router.post('/banners', authenticate, async (req, res, next) => {
  try {
    const banner = await MarketingService.createBanner(req.body);
    return ResponseFormatter.success(res, 'Banner created successfully', banner);
  } catch (error) {
    return next(error);
  }
});

router.put('/banners/:bannerId', authenticate, async (req, res, next) => {
  try {
    const { bannerId } = req.params;
    const banner = await MarketingService.updateBanner(bannerId, req.body);
    return ResponseFormatter.success(res, 'Banner updated successfully', banner);
  } catch (error) {
    return next(error);
  }
});

router.delete('/banners/:bannerId', authenticate, async (req, res, next) => {
  try {
    const { bannerId } = req.params;
    const result = await MarketingService.deleteBanner(bannerId);
    return ResponseFormatter.success(res, 'Banner deleted successfully', result);
  } catch (error) {
    return next(error);
  }
});

// Payment Gateways management
const gatewaysFilePath = path.join(__dirname, '../gateways.json');

const readGatewaysFile = async (): Promise<any[]> => {
  try {
    const content = await fs.promises.readFile(gatewaysFilePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
};

const writeGatewaysFile = async (data: any[]): Promise<void> => {
  await fs.promises.writeFile(gatewaysFilePath, JSON.stringify(data, null, 2), 'utf-8');
};

router.get('/payments/gateways', authenticate, async (req, res, next) => {
  try {
    const gateways = await readGatewaysFile();
    return ResponseFormatter.success(res, 'Gateways retrieved successfully', gateways);
  } catch (error) {
    return next(error);
  }
});

router.post('/payments/gateways', authenticate, async (req, res, next) => {
  try {
    const gateways = await readGatewaysFile();
    const newGateway = req.body;
    gateways.push(newGateway);
    await writeGatewaysFile(gateways);
    return ResponseFormatter.success(res, 'Gateway created successfully', newGateway);
  } catch (error) {
    return next(error);
  }
});

router.put('/payments/gateways/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    let gateways = await readGatewaysFile();
    let updatedGateway: any = null;
    
    gateways = gateways.map(g => {
      if (g.id === id) {
        updatedGateway = { ...g, ...updates };
        return updatedGateway;
      }
      return g;
    });

    if (!updatedGateway) {
      return res.status(404).json({ success: false, message: 'Gateway not found' });
    }

    await writeGatewaysFile(gateways);
    return ResponseFormatter.success(res, 'Gateway updated successfully', updatedGateway);
  } catch (error) {
    return next(error);
  }
});

export default router;
