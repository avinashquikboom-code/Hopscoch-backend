import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import settingsService from '../services/settings.service';
import shiprocketClient from '../../shipments/services/shiprocket.client';
import razorpayClient from '../../payments/services/razorpay.client';

function maskSecret(val: string): string {
  if (!val || val.length <= 8) return '********';
  return `${val.substring(0, 4)}****${val.substring(val.length - 4)}`;
}

export class IntegrationController {
  async getIntegrationSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Authenticated admin role check
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }

      const shiprocketEmail = await settingsService.getIntegrationKey('shiprocket', 'email');
      const shiprocketBaseUrl = await settingsService.getIntegrationKey('shiprocket', 'base_url');
      const shiprocketPassword = await settingsService.getIntegrationKey('shiprocket', 'password');
      
      const razorpayKeyId = await settingsService.getIntegrationKey('razorpay', 'key_id');
      const razorpayKeySecret = await settingsService.getIntegrationKey('razorpay', 'key_secret');
      const razorpayWebhookSecret = await settingsService.getIntegrationKey('razorpay', 'webhook_secret');

      const googleGeminiApiKey = await settingsService.getIntegrationKey('google', 'gemini_api_key');
      const googleMapsApiKey = await settingsService.getIntegrationKey('google', 'maps_api_key');

      ResponseFormatter.success(res, 'Integration settings retrieved', {
        shiprocket: {
          email: shiprocketEmail,
          base_url: shiprocketBaseUrl,
          password: shiprocketPassword,
        },
        razorpay: {
          key_id: razorpayKeyId,
          key_secret: razorpayKeySecret,
          webhook_secret: razorpayWebhookSecret,
        },
        google: {
          gemini_api_key: googleGeminiApiKey,
          maps_api_key: googleMapsApiKey,
        }
      });
    } catch (err: any) {
      ResponseFormatter.error(res, err.message || 'Failed to retrieve integration settings', 500);
    }
  }

  async updateIntegrationSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }

      const { provider, settings } = req.body; // provider: 'shiprocket' | 'razorpay'

      if (provider === 'shiprocket') {
        const { email, password, base_url } = settings;
        if (email) await settingsService.updateIntegrationKey('shiprocket', 'email', email, String(req.user.id));
        if (password) {
          await settingsService.updateIntegrationKey('shiprocket', 'password', password, String(req.user.id));
        }
        if (base_url) await settingsService.updateIntegrationKey('shiprocket', 'base_url', base_url, String(req.user.id));
        
        await settingsService.logAudit('shiprocket', 'update', String(req.user.id));
      } else if (provider === 'razorpay') {
        const { key_id, key_secret, webhook_secret } = settings;
        if (key_id) await settingsService.updateIntegrationKey('razorpay', 'key_id', key_id, String(req.user.id));
        if (key_secret) {
          await settingsService.updateIntegrationKey('razorpay', 'key_secret', key_secret, String(req.user.id));
        }
        if (webhook_secret) {
          await settingsService.updateIntegrationKey('razorpay', 'webhook_secret', webhook_secret, String(req.user.id));
        }
        
        await settingsService.logAudit('razorpay', 'update', String(req.user.id));
      } else if (provider === 'google') {
        const { gemini_api_key, maps_api_key } = settings;
        if (gemini_api_key !== undefined) {
          await settingsService.updateIntegrationKey('google', 'gemini_api_key', gemini_api_key, String(req.user.id));
        }
        if (maps_api_key !== undefined) {
          await settingsService.updateIntegrationKey('google', 'maps_api_key', maps_api_key, String(req.user.id));
        }
        
        await settingsService.logAudit('google', 'update', String(req.user.id));
      } else {
        ResponseFormatter.error(res, 'Invalid provider name', 400);
        return;
      }

      ResponseFormatter.success(res, `${provider} settings updated successfully`);
    } catch (err: any) {
      ResponseFormatter.error(res, err.message || 'Failed to update integration settings', 500);
    }
  }

  async testConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }

      const { provider, settings } = req.body;
      let isSuccess = false;

      if (provider === 'shiprocket') {
        const { email, password } = settings;
        const currentEmail = email || await settingsService.getIntegrationKey('shiprocket', 'email');
        const currentPass = password || await settingsService.getIntegrationKey('shiprocket', 'password');
        isSuccess = await shiprocketClient.testConnection(currentEmail, currentPass);
      } else if (provider === 'razorpay') {
        const { key_id, key_secret } = settings;
        const currentKeyId = key_id || await settingsService.getIntegrationKey('razorpay', 'key_id');
        const currentSecret = key_secret || await settingsService.getIntegrationKey('razorpay', 'key_secret');
        isSuccess = await razorpayClient.testConnection(currentKeyId, currentSecret);
      } else if (provider === 'google') {
        const { gemini_api_key, maps_api_key } = settings;
        const currentGemini = gemini_api_key || await settingsService.getIntegrationKey('google', 'gemini_api_key');
        isSuccess = !!currentGemini; // Success if key is set
      } else {
        ResponseFormatter.error(res, 'Invalid provider name', 400);
        return;
      }

      if (isSuccess) {
        ResponseFormatter.success(res, `Connection check successful for ${provider}`);
      } else {
        ResponseFormatter.error(res, `Connection check failed for ${provider}`, 400);
      }
    } catch (err: any) {
      ResponseFormatter.error(res, err.message || 'Connection test failed', 500);
    }
  }
}

export default new IntegrationController();
