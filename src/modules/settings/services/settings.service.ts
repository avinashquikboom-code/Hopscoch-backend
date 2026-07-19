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

export class SettingsService {
  private cache: Map<string, string> = new Map();
  private updateListeners: ((provider: 'shiprocket' | 'razorpay' | 'google') => void)[] = [];

  registerUpdateListener(listener: (provider: 'shiprocket' | 'razorpay' | 'google') => void) {
    this.updateListeners.push(listener);
  }

  onKeyUpdate(provider: 'shiprocket' | 'razorpay' | 'google') {
    for (const listener of this.updateListeners) {
      try {
        listener(provider);
      } catch (err) {
        logger.error(`Error in integration update listener: ${err}`);
      }
    }
  }

  async getIntegrationKey(provider: 'shiprocket' | 'razorpay' | 'google', keyName: string): Promise<string> {
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
    const envKey = `${provider.toUpperCase()}_${keyName.toUpperCase()}`;
    const envValue = process.env[envKey] || '';
    if (envValue) {
      this.cache.set(cacheKey, envValue);
    }
    return envValue;
  }

  async updateIntegrationKey(
    provider: 'shiprocket' | 'razorpay' | 'google',
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
  async logAudit(provider: 'shiprocket' | 'razorpay' | 'google', action: string, updatedBy?: string) {
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
    return data.languages || [];
  }

  async getCurrencies() {
    const data = this.readSettingsFile();
    return data.currencies || [];
  }

  async getCountries() {
    const data = this.readSettingsFile();
    return data.countries || [];
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
}

export default new SettingsService();
