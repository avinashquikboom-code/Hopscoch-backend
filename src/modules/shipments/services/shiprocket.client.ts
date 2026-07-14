import { logger } from '../../../utils/logger';
import settingsService from '../../settings/services/settings.service';

export class ShiprocketClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Register update listener to clear cached token when settings change
    settingsService.registerUpdateListener((provider) => {
      if (provider === 'shiprocket') {
        logger.info('Shiprocket settings updated. Invalidating token cache.');
        this.token = null;
        this.tokenExpiry = 0;
      }
    });
  }

  private async getBaseUrl(): Promise<string> {
    const baseUrl = await settingsService.getIntegrationKey('shiprocket', 'base_url');
    return baseUrl || 'https://apiv2.shiprocket.in/v1/external';
  }

  private async getCredentials(): Promise<{ email: string; pass: string }> {
    const email = await settingsService.getIntegrationKey('shiprocket', 'email');
    const pass = await settingsService.getIntegrationKey('shiprocket', 'password');
    return { email, pass };
  }

  private async authenticate(): Promise<string> {
    const now = Date.now();
    // Cache token for 9 days (Shiprocket token is valid for 10 days)
    if (this.token && this.tokenExpiry > now) {
      return this.token!;
    }

    logger.info('Authenticating with Shiprocket API...');
    const baseUrl = await this.getBaseUrl();
    const { email, pass } = await this.getCredentials();

    if (!email || !pass) {
      throw new Error('Shiprocket credentials missing. Please configure them in Integration Settings.');
    }

    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await response.json() as any;

    if (!response.ok || !data.token) {
      throw new Error(data.message || 'Shiprocket authentication failed.');
    }

    this.token = data.token;
    this.tokenExpiry = now + 9 * 24 * 60 * 60 * 1000; // 9 days cache
    logger.info('Shiprocket authenticated successfully.');

    return this.token!;
  }

  public async request(endpoint: string, options: RequestInit = {}, retries = 3): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const token = await this.authenticate();

    const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (response.status === 401 && retries > 0) {
        logger.warn(`Shiprocket request returned 401. Re-authenticating... Retries left: ${retries}`);
        this.token = null;
        this.tokenExpiry = 0;
        return this.request(endpoint, options, retries - 1);
      }

      const contentType = response.headers.get('content-type');
      let data: any;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { text: await response.text() };
      }

      if (!response.ok) {
        throw new Error(data.message || `Shiprocket request failed with status: ${response.status}`);
      }

      return data;
    } catch (error: any) {
      if (retries > 0) {
        logger.warn(`Shiprocket request failed: ${error.message}. Retrying... Retries left: ${retries}`);
        return this.request(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  // Live Connection Validation
  public async testConnection(email: string, pass: string): Promise<boolean> {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      return response.ok;
    } catch (err) {
      logger.error(`Shiprocket test connection failed: ${err}`);
      return false;
    }
  }
}

export default new ShiprocketClient();
