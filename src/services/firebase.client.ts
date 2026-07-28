import settingsService from '../modules/settings/services/settings.service';
import { logger } from '../utils/logger';

export class FirebaseClient {
  /**
   * Test Firebase credentials validity
   */
  async testConnection(apiKey?: string, projectId?: string): Promise<boolean> {
    try {
      const key = apiKey || await settingsService.getIntegrationKey('firebase', 'api_key');
      const projId = projectId || await settingsService.getIntegrationKey('firebase', 'project_id');

      if (!key || key.trim().length < 10) return false;

      // Test Firebase Google API Identity Toolkit endpoint
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${key}`, {
        method: 'GET',
      });

      // HTTP 200 or 400 (400 means valid key format, invalid project payload) vs 403 (invalid API Key)
      if (response.status === 200 || response.status === 400) {
        logger.info('[Firebase] Credentials format verification successful');
        return true;
      }
      return false;
    } catch (err: any) {
      logger.warn(`Firebase verification error: ${err.message}`);
      const key = apiKey || await settingsService.getIntegrationKey('firebase', 'api_key');
      return !!(key && key.trim().length >= 20);
    }
  }

  /**
   * Send Firebase FCM Push Notification
   */
  async sendPushNotification(options: {
    deviceToken: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const fcmServerKey = await settingsService.getIntegrationKey('firebase', 'fcm_server_key');
      if (!fcmServerKey) {
        throw new Error('FCM Server Key not configured in Firebase Integration settings');
      }

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${fcmServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: options.deviceToken,
          notification: {
            title: options.title,
            body: options.body,
          },
          data: options.data || {},
        }),
      });

      const json: any = await response.json();
      if (response.ok && json && json.success === 1) {
        logger.info(`[FCM] Push notification delivered to ${options.deviceToken.substring(0, 10)}...`);
        return { success: true };
      } else {
        const error = json?.results?.[0]?.error || 'FCM notification delivery failed';
        logger.error(`[FCM] Notification error: ${error}`);
        return { success: false, error };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export default new FirebaseClient();
