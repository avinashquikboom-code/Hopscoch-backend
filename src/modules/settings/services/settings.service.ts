import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class SettingsService {
  async getAppSettings() {
    // Since we don't have a dedicated settings table, we'll return default settings
    // In production, you would have a settings table to store these values
    const settings = {
      siteName: 'Aura Couture',
      siteDescription: 'Luxury Fashion E-commerce',
      siteUrl: process.env.CLIENT_URL || 'http://localhost:3000',
      logoUrl: '',
      faviconUrl: '',
      contactEmail: 'support@auracouture.com',
      contactPhone: '+91 9876543210',
      socialLinks: {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: '',
      },
      seoTitle: 'Aura Couture - Luxury Fashion',
      seoDescription: 'Shop the latest luxury fashion at Aura Couture',
    };

    return settings;
  }

  async updateAppSettings(data: {
    siteName?: string;
    siteDescription?: string;
    siteUrl?: string;
    logoUrl?: string;
    faviconUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
    socialLinks?: Record<string, string>;
    seoTitle?: string;
    seoDescription?: string;
  }) {
    // In production, you would update the settings table
    // For now, we'll return the updated data
    const updatedSettings = {
      ...await this.getAppSettings(),
      ...data,
    };

    logger.info('App settings updated');
    return updatedSettings;
  }

  async getUserPreferences(userId: any) {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      throw new AppError('User preferences not found', 404);
    }

    return preferences;
  }

  async updateUserPreferences(userId: any, data: {
    currency?: string;
    language?: string;
    pushOptIn?: boolean;
    emailOptIn?: boolean;
    smsOptIn?: boolean;
  }) {
    const { currency, language, pushOptIn, emailOptIn, smsOptIn } = data;

    const existingPreferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!existingPreferences) {
      throw new AppError('User preferences not found', 404);
    }

    const updatedPreferences = await prisma.userPreference.update({
      where: { userId },
      data: {
        currency,
        language,
        pushOptIn,
        emailOptIn,
        smsOptIn,
      },
    });

    logger.info(`User preferences updated for user: ${userId}`);
    return updatedPreferences;
  }

  async getLanguages() {
    // Return default supported languages
    const languages = [
      { code: 'en', name: 'English', nativeName: 'English', isActive: true, isDefault: true },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isActive: true, isDefault: false },
      { code: 'es', name: 'Spanish', nativeName: 'Español', isActive: true, isDefault: false },
      { code: 'fr', name: 'French', nativeName: 'Français', isActive: true, isDefault: false },
    ];

    return languages;
  }

  async getCurrencies() {
    // Return default supported currencies
    const currencies = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 1, isActive: true, isDefault: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.012, isActive: true, isDefault: false },
      { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.011, isActive: true, isDefault: false },
      { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.0095, isActive: true, isDefault: false },
    ];

    return currencies;
  }
}

export default new SettingsService();
