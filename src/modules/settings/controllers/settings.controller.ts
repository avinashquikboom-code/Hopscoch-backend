import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import SettingsService from '../services/settings.service';
import { updateAppSettingsSchema } from '../validators/settings.validator';

export class SettingsController {
  async getAppSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await SettingsService.getAppSettings();
      ResponseFormatter.success(res, 'App settings retrieved successfully', settings);
    } catch (error) {
      throw error;
    }
  }

  async updateAppSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = updateAppSettingsSchema.parse(req.body);
      const settings = await SettingsService.updateAppSettings(validatedData);
      ResponseFormatter.success(res, 'App settings updated successfully', settings);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getUserPreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const preferences = await SettingsService.getUserPreferences(req.user.id);
      ResponseFormatter.success(res, 'User preferences retrieved successfully', preferences);
    } catch (error) {
      throw error;
    }
  }

  async updateUserPreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const preferences = await SettingsService.updateUserPreferences(req.user.id, req.body);
      ResponseFormatter.success(res, 'User preferences updated successfully', preferences);
    } catch (error) {
      throw error;
    }
  }

  async getLanguages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const languages = await SettingsService.getLanguages();
      ResponseFormatter.success(res, 'Languages retrieved successfully', languages);
    } catch (error) {
      throw error;
    }
  }

  async getCurrencies(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currencies = await SettingsService.getCurrencies();
      ResponseFormatter.success(res, 'Currencies retrieved successfully', currencies);
    } catch (error) {
      throw error;
    }
  }
}

export default new SettingsController();
