import crypto from 'crypto';
import { logger } from '../../../utils/logger';
import settingsService from '../../settings/services/settings.service';

export class RazorpayClient {
  constructor() {
    settingsService.registerUpdateListener((provider) => {
      if (provider === 'razorpay') {
        logger.info('Razorpay settings updated. Invaliding client credentials.');
      }
    });
  }

  private async getCredentials(): Promise<{ keyId: string; keySecret: string }> {
    const keyId = await settingsService.getIntegrationKey('razorpay', 'key_id');
    const keySecret = await settingsService.getIntegrationKey('razorpay', 'key_secret');
    return { keyId, keySecret };
  }

  private async getAuthHeader(): Promise<string> {
    const { keyId, keySecret } = await this.getCredentials();
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials missing. Please configure them in Integration Settings.');
    }
    const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    return `Basic ${token}`;
  }

  public async createOrder(amount: number, currency: string = 'INR', receipt: string): Promise<any> {
    const authHeader = await this.getAuthHeader();
    // Razorpay amount is in paise (e.g. 100 paise = 1 INR)
    const amountInPaise = Math.round(amount * 100);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt,
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay order creation failed');
    }
    return data;
  }

  public async fetchPayment(paymentId: string): Promise<any> {
    const authHeader = await this.getAuthHeader();
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay payment fetch failed');
    }
    return data;
  }

  public async capturePayment(paymentId: string, amount: number, currency: string = 'INR'): Promise<any> {
    const authHeader = await this.getAuthHeader();
    const amountInPaise = Math.round(amount * 100);

    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay payment capture failed');
    }
    return data;
  }

  public async refundPayment(paymentId: string, amount?: number, speed: 'normal' | 'optimum' = 'normal'): Promise<any> {
    const authHeader = await this.getAuthHeader();
    const body: any = { speed };
    if (amount) {
      body.amount = Math.round(amount * 100); // in paise
    }

    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay refund failed');
    }
    return data;
  }

  // Signature verification utility for Payment callbacks
  public async verifyPaymentSignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
    try {
      const { keySecret } = await this.getCredentials();
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      return generatedSignature === signature;
    } catch (err) {
      logger.error(`Razorpay signature verification error: ${err}`);
      return false;
    }
  }

  // Signature verification utility for Webhooks
  public async verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
    try {
      const webhookSecret = await settingsService.getIntegrationKey('razorpay', 'webhook_secret');
      if (!webhookSecret) {
        logger.warn('Razorpay webhook secret missing in settings.');
        return false;
      }
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      return generatedSignature === signature;
    } catch (err) {
      logger.error(`Razorpay webhook signature verification error: ${err}`);
      return false;
    }
  }

  // Connection Testing
  public async testConnection(keyId: string, keySecret: string): Promise<boolean> {
    try {
      const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${token}`,
        },
      });
      return response.ok;
    } catch (err) {
      logger.error(`Razorpay connection test failed: ${err}`);
      return false;
    }
  }
}

export default new RazorpayClient();
