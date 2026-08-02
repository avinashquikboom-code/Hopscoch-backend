import settingsService from '../modules/settings/services/settings.service';
import { logger } from '../utils/logger';

export class Msg91Client {
  /**
   * Test MSG91 Auth Key validity
   */
  async testConnection(authKey?: string): Promise<boolean> {
    try {
      const key = authKey || await settingsService.getIntegrationKey('msg91', 'auth_key');
      if (!key || key.trim().length < 8) return false;

      // MSG91 Auth Key validation request
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'GET',
        headers: {
          authkey: key,
        },
      });

      // HTTP 200 with status success means valid authkey
      const data: any = await response.json().catch(() => ({}));
      return response.status === 200 && data?.type !== 'error';
    } catch (err: any) {
      logger.warn(`MSG91 AuthKey verification error: ${err.message}`);
      const key = authKey || await settingsService.getIntegrationKey('msg91', 'auth_key');
      return !!(key && key.trim().length >= 16);
    }
  }

  /**
   * Send SMS via MSG91 Flow API
   */
  async sendSms(options: {
    mobile: string;
    flowId?: string;
    senderId?: string;
    params?: Record<string, string>;
  }): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const authKey = await settingsService.getIntegrationKey('msg91', 'auth_key');
      const defaultFlowId = await settingsService.getIntegrationKey('msg91', 'flow_id');
      const defaultSenderId = await settingsService.getIntegrationKey('msg91', 'sender_id');

      const flowId = options.flowId || defaultFlowId;
      const senderId = options.senderId || defaultSenderId || 'FCISEL';

      if (!authKey) {
        throw new Error('MSG91 Auth Key is missing or not configured.');
      }

      if (!flowId) {
        throw new Error('MSG91 Flow ID / Template ID is missing.');
      }

      let mobile = options.mobile.replace(/\D/g, '');
      if (mobile.length === 10) {
        mobile = '91' + mobile;
      }

      const payload = {
        flow_id: flowId,
        sender: senderId,
        recipients: [
          {
            mobiles: mobile,
            ...(options.params || {}),
          },
        ],
      };

      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: authKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json: any = await response.json();
      if (response.ok && json && json.type === 'success') {
        logger.info(`[MSG91] SMS sent successfully to ${mobile}`);
        return { success: true, response: json };
      } else {
        const errorMsg = json?.message || 'Failed to send SMS via MSG91';
        logger.error(`[MSG91] Error: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      logger.error(`[MSG91 Exception] ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send OTP via MSG91 OTP API
   */
  async sendOtp(options: {
    mobile: string;
    otp: string;
    templateId?: string;
  }): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const authKey = await settingsService.getIntegrationKey('msg91', 'auth_key');
      const templateId = options.templateId || await settingsService.getIntegrationKey('msg91', 'dlt_te_id');

      if (!authKey) {
        throw new Error('MSG91 Auth Key not configured');
      }

      let mobile = options.mobile.replace(/\D/g, '');
      if (mobile.length === 10) {
        mobile = '91' + mobile;
      }

      const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&otp=${options.otp}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authkey: authKey,
        },
      });

      const json: any = await response.json();
      if (response.ok && json && json.type === 'success') {
        logger.info(`[MSG91] OTP sent successfully to ${mobile}`);
        return { success: true, response: json };
      } else {
        return { success: false, error: json?.message || 'OTP send failed' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export default new Msg91Client();
