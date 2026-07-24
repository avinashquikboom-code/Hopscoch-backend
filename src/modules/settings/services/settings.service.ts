import crypto from 'crypto';
import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

// Encryption setup
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.SETTINGS_ENCRYPTION_KEY || 'your-default-settings-encryption-key-passphrase')
  .digest(); // Always exactly 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export type IntegrationProvider = 'shiprocket' | 'razorpay' | 'google' | 'aws';

export class SettingsService {
  private cache: Map<string, string> = new Map();
  private updateListeners: ((provider: IntegrationProvider) => void)[] = [];

  registerUpdateListener(listener: (provider: IntegrationProvider) => void) {
    this.updateListeners.push(listener);
  }

  onKeyUpdate(provider: IntegrationProvider) {
    for (const listener of this.updateListeners) {
      try {
        listener(provider);
      } catch (err) {
        logger.error(`Error in integration update listener: ${err}`);
      }
    }
  }

  async getIntegrationKey(provider: IntegrationProvider, keyName: string): Promise<string> {
    const cacheKey = `${provider}:${keyName}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Try database first
    const dbSetting = await prisma.integrationSetting.findUnique({
      where: {
        provider_keyName: {
          provider,
          keyName,
        },
      },
    });

    if (dbSetting && dbSetting.isActive) {
      try {
        const decryptedValue = decrypt(dbSetting.encryptedValue);
        this.cache.set(cacheKey, decryptedValue);
        return decryptedValue;
      } catch (err) {
        logger.error(`Failed to decrypt setting ${cacheKey}: ${err}`);
      }
    }

    // Fallback to env/config
    let envKey = `${provider.toUpperCase()}_${keyName.toUpperCase()}`;
    if (provider === 'aws') {
      if (keyName === 'access_key_id') envKey = 'AWS_ACCESS_KEY_ID';
      else if (keyName === 'secret_access_key') envKey = 'AWS_SECRET_ACCESS_KEY';
      else if (keyName === 'region') envKey = 'AWS_REGION';
      else if (keyName === 'bucket_name') envKey = 'AWS_S3_BUCKET_NAME';
    }
    const envValue = process.env[envKey] || '';
    if (envValue) {
      this.cache.set(cacheKey, envValue);
    }
    return envValue;
  }

  async updateIntegrationKey(
    provider: IntegrationProvider,
    keyName: string,
    value: string,
    updatedBy?: string
  ): Promise<void> {
    const encryptedValue = encrypt(value);
    
    await prisma.integrationSetting.upsert({
      where: {
        provider_keyName: {
          provider,
          keyName,
        },
      },
      update: {
        encryptedValue,
        isActive: true,
        updatedBy: updatedBy ? String(updatedBy) : null,
      },
      create: {
        provider,
        keyName,
        encryptedValue,
        isActive: true,
        updatedBy: updatedBy ? String(updatedBy) : null,
      },
    });

    const cacheKey = `${provider}:${keyName}`;
    this.cache.delete(cacheKey);
    
    this.onKeyUpdate(provider);
  }

  // Audit Logs Helper
  async logAudit(provider: IntegrationProvider, action: string, updatedBy?: string) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: updatedBy ? Number(updatedBy) : 1, // Default or mock admin user ID
          action: `INTEGRATION_${provider.toUpperCase()}_${action.toUpperCase()}`,
          metadata: { details: `Updated integration credentials for ${provider}` },
          ipAddress: '127.0.0.1'
        }
      });
    } catch (err) {
      logger.error(`Failed to write audit log: ${err}`);
    }
  }

  // ─── Existing settings functionality ───────────────────────────────────────
  async getAppSettings() {
    const settings = {
      siteName: 'FCISeller',
      siteDescription: 'Luxury Fashion E-commerce',
      siteUrl: process.env.CLIENT_URL || 'http://localhost:3000',
      logoUrl: '',
      faviconUrl: '',
      contactEmail: 'support@fciseller.com',
      contactPhone: '+91 9876543210',
      socialLinks: {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: '',
      },
      seoTitle: 'FCISeller - Luxury Fashion',
      seoDescription: 'Shop the latest luxury fashion at FCISeller',
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

  private getSettingsFilePath(): string {
    const path = require('path');
    return path.join(process.cwd(), 'data', 'app_settings.json');
  }

  private readSettingsFile(): any {
    const fs = require('fs');
    try {
      const filePath = this.getSettingsFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.error(`Failed to read app settings file: ${err}`);
    }
    return { languages: [], currencies: [], countries: [] };
  }

  private writeSettingsFile(data: any): void {
    const fs = require('fs');
    try {
      const filePath = this.getSettingsFilePath();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to write app settings file: ${err}`);
    }
  }

  async getLanguages() {
    const data = this.readSettingsFile();
    if (!data.languages || !Array.isArray(data.languages) || data.languages.length === 0) {
      data.languages = [
        { id: '1', code: 'en', name: 'English', flag: '🇺🇸', isDefault: true, isEnabled: true },
        { id: '2', code: 'hi', name: 'Hindi', flag: '🇮🇳', isDefault: false, isEnabled: true },
        { id: '3', code: 'es', name: 'Spanish', flag: '🇪🇸', isDefault: false, isEnabled: true },
        { id: '4', code: 'fr', name: 'French', flag: '🇫🇷', isDefault: false, isEnabled: true },
        { id: '5', code: 'de', name: 'German', flag: '🇩🇪', isDefault: false, isEnabled: true },
        { id: '6', code: 'ar', name: 'Arabic', flag: '🇸🇦', isDefault: false, isEnabled: true },
        { id: '7', code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾', isDefault: false, isEnabled: true },
        { id: '8', code: 'nl', name: 'Nederlands', flag: '🇳🇱', isDefault: false, isEnabled: true },
      ];
      this.writeSettingsFile(data);
    }
    return data.languages;
  }

  async getCurrencies() {
    const data = this.readSettingsFile();
    if (!data.currencies || !Array.isArray(data.currencies) || data.currencies.length === 0) {
      data.currencies = [
        { id: '1', code: 'INR', symbol: '₹', name: 'Indian Rupee', exchangeRate: 1.00, isDefault: true, isEnabled: true },
        { id: '2', code: 'USD', symbol: '$', name: 'US Dollar', exchangeRate: 0.012, isDefault: false, isEnabled: true },
        { id: '3', code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: 0.011, isDefault: false, isEnabled: true },
        { id: '4', code: 'GBP', symbol: '£', name: 'British Pound', exchangeRate: 0.0095, isDefault: false, isEnabled: true },
        { id: '5', code: 'AED', symbol: 'AED', name: 'UAE Dirham', exchangeRate: 0.044, isDefault: false, isEnabled: true },
        { id: '6', code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', exchangeRate: 0.0045, isDefault: false, isEnabled: true },
        { id: '7', code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', exchangeRate: 0.057, isDefault: false, isEnabled: true },
        { id: '8', code: 'MUR', symbol: '₨', name: 'Mauritian Rupee', exchangeRate: 0.54, isDefault: false, isEnabled: true },
        { id: '9', code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', exchangeRate: 0.027, isDefault: false, isEnabled: true },
        { id: '10', code: 'GYD', symbol: 'G$', name: 'Guyanese Dollar', exchangeRate: 2.51, isDefault: false, isEnabled: true },
        { id: '11', code: 'SRD', symbol: 'Sr$', name: 'Surinamese Dollar', exchangeRate: 0.39, isDefault: false, isEnabled: true },
        { id: '12', code: 'TTD', symbol: 'TT$', name: 'Trinidad & Tobago Dollar', exchangeRate: 0.081, isDefault: false, isEnabled: true },
      ];
      this.writeSettingsFile(data);
    }
    return data.currencies;
  }

  async getCountries() {
    const data = this.readSettingsFile();
    if (!data.countries || !Array.isArray(data.countries) || data.countries.length === 0) {
      data.countries = [
        { code: 'IN', name: 'India' },
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'AE', name: 'UAE (Dubai)' },
        { code: 'BH', name: 'Bahrain' },
        { code: 'MY', name: 'Malaysia' },
        { code: 'MU', name: 'Mauritius' },
        { code: 'FJ', name: 'Fiji' },
        { code: 'GY', name: 'Guyana' },
        { code: 'SR', name: 'Suriname' },
        { code: 'TT', name: 'Trinidad & Tobago' },
        { code: 'AU', name: 'Australia' },
        { code: 'CA', name: 'Canada' },
        { code: 'DE', name: 'Germany' },
        { code: 'FR', name: 'France' },
        { code: 'JP', name: 'Japan' },
        { code: 'SG', name: 'Singapore' },
        { code: 'SA', name: 'Saudi Arabia' },
        { code: 'QA', name: 'Qatar' },
        { code: 'KW', name: 'Kuwait' },
        { code: 'OM', name: 'Oman' },
        { code: 'ZA', name: 'South Africa' },
        { code: 'NZ', name: 'New Zealand' },
        { code: 'NL', name: 'Netherlands' },
        { code: 'ES', name: 'Spain' },
        { code: 'IT', name: 'Italy' },
        { code: 'CH', name: 'Switzerland' },
        { code: 'CN', name: 'China' },
        { code: 'BR', name: 'Brazil' },
        { code: 'MX', name: 'Mexico' },
      ];
      this.writeSettingsFile(data);
    }
    return data.countries;
  }

  async updateLanguages(languages: any[]) {
    const data = this.readSettingsFile();
    data.languages = languages;
    this.writeSettingsFile(data);
    logger.info('Languages updated in config file');
    return languages;
  }

  async updateCurrencies(currencies: any[]) {
    const data = this.readSettingsFile();
    data.currencies = currencies;
    this.writeSettingsFile(data);
    logger.info('Currencies updated in config file');
    return currencies;
  }

  async updateCountries(countries: any[]) {
    const data = this.readSettingsFile();
    data.countries = countries;
    this.writeSettingsFile(data);
    logger.info('Countries updated in config file');
    return countries;
  }

  async resetData(scope: 'all' | 'orders' | 'products' | 'customers' | 'logs' = 'all') {
    logger.info(`Admin initiated database reset with scope: ${scope}`);

    if (scope === 'orders' || scope === 'all') {
      await prisma.orderTimelineEvent.deleteMany({});
      await prisma.returnRequest.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.orderItem.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.stockMovement.deleteMany({});
      await prisma.couponUsage.deleteMany({});
    }

    if (scope === 'products' || scope === 'all') {
      await prisma.reviewMedia.deleteMany({});
      await prisma.review.deleteMany({});
      await prisma.cartItem.deleteMany({});
      await prisma.cart.deleteMany({});
      await prisma.wishlistItem.deleteMany({});
      await prisma.recentlyViewed.deleteMany({});
      await prisma.productImage.deleteMany({});
      await prisma.productVideo.deleteMany({});
      await prisma.productVariant.deleteMany({});
      await prisma.relatedProduct.deleteMany({});
      await prisma.warehouseInventory.deleteMany({});
      await prisma.product.deleteMany({});
      await prisma.category.deleteMany({});
      await prisma.brand.deleteMany({});
    }

    if (scope === 'customers' || scope === 'all') {
      await prisma.recentSearch.deleteMany({});
      await prisma.searchLog.deleteMany({});
      await prisma.aIImageSearchLog.deleteMany({});
      await prisma.rewardPointsTransaction.deleteMany({});
      await prisma.supportTicket.deleteMany({});
      await prisma.contactRequest.deleteMany({});
      await prisma.address.deleteMany({ where: { user: { role: 'CUSTOMER' } } });
      await prisma.session.deleteMany({ where: { user: { role: 'CUSTOMER' } } });
      await prisma.refreshToken.deleteMany({ where: { user: { role: 'CUSTOMER' } } });
      await prisma.userPreference.deleteMany({ where: { user: { role: 'CUSTOMER' } } });
      await prisma.user.deleteMany({ where: { role: 'CUSTOMER' } });
    }

    if (scope === 'logs' || scope === 'all') {
      await prisma.notification.deleteMany({});
      await prisma.analyticsEvent.deleteMany({});
      await prisma.activityLog.deleteMany({});
      await prisma.banner.deleteMany({});
      await prisma.campaign.deleteMany({});
    }

    logger.info(`Database reset successfully completed for scope: ${scope}`);
    return { success: true, message: `Database reset completed for scope: ${scope}` };
  }
}

export default new SettingsService();
