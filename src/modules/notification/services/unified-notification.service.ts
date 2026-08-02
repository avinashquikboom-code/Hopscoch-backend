import prisma from '../../../utils/prisma';
import { getFirebaseMessaging } from '../../../config/firebase';
import { logger } from '../../../utils/logger';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  targetPlatform?: 'MOBILE' | 'WEB' | 'ADMIN' | 'ALL';
  type?: string; // ORDER, SYSTEM, PROMOTION, WISHLIST, DELIVERY
}

export class UnifiedNotificationService {
  /**
   * Register or update FCM Token for user session
   */
  static async registerToken(
    userId: number,
    fcmToken: string,
    deviceType: 'MOBILE' | 'WEB' | 'ADMIN' = 'MOBILE',
    platform: string = 'android'
  ) {
    if (!fcmToken || !fcmToken.trim()) return null;
    const cleanToken = fcmToken.trim();

    try {
      // Find existing session with this token or create/update most recent active session
      const existingSession = await prisma.session.findFirst({
        where: { userId, fcmToken: cleanToken },
      });

      if (existingSession) {
        return await prisma.session.update({
          where: { id: existingSession.id },
          data: {
            deviceType: deviceType.toLowerCase(),
            platform: platform.toLowerCase(),
            isActive: true,
            lastActivityAt: new Date(),
          },
        });
      }

      // Upsert into active user session
      const latestSession = await prisma.session.findFirst({
        where: { userId, isActive: true },
        orderBy: { lastActivityAt: 'desc' },
      });

      if (latestSession) {
        return await prisma.session.update({
          where: { id: latestSession.id },
          data: {
            fcmToken: cleanToken,
            deviceType: deviceType.toLowerCase(),
            platform: platform.toLowerCase(),
            lastActivityAt: new Date(),
          },
        });
      }

      // Create new session entry for token
      return await prisma.session.create({
        data: {
          userId,
          fcmToken: cleanToken,
          deviceType: deviceType.toLowerCase(),
          platform: platform.toLowerCase(),
          isActive: true,
        },
      });
    } catch (err: any) {
      logger.error(`[NotificationService] registerToken failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Send push & in-app notification to specific user(s)
   */
  static async sendNotificationToUser(
    userIds: number | number[],
    payload: NotificationPayload
  ) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0) return { success: false, deliveredCount: 0 };

    try {
      // 1. Save in-app notification to DB for persistent list
      for (const uId of ids) {
        await prisma.notification.create({
          data: {
            userId: uId,
            title: payload.title,
            body: payload.body,
            channel: 'PUSH',
            type: (payload.type?.toUpperCase() as any) || 'ORDER',
            data: payload.data || {},
          },
        });
      }

      // 2. Fetch active FCM tokens for users
      const platformFilter = payload.targetPlatform && payload.targetPlatform !== 'ALL'
        ? { deviceType: payload.targetPlatform.toLowerCase() }
        : {};

      const sessions = await prisma.session.findMany({
        where: {
          userId: { in: ids },
          isActive: true,
          fcmToken: { not: null },
          ...platformFilter,
        },
        select: { id: true, fcmToken: true },
      });

      const tokens: string[] = Array.from(
        new Set(sessions.map((s: { fcmToken: string | null }) => s.fcmToken).filter((t: string | null): t is string => Boolean(t && t.trim().length > 0)))
      );

      if (tokens.length === 0) {
        logger.info(`[FCM] No active FCM tokens found for users: ${ids.join(', ')}`);
        return { success: true, deliveredCount: 0, reason: 'No tokens registered' };
      }

      // 3. Dispatch multicast push notification via FCM
      return await this.dispatchFcmMulticast(tokens, payload);
    } catch (err: any) {
      logger.error(`[NotificationService] sendNotificationToUser error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send notification to all active ADMIN users (e.g. New Order alerts)
   */
  static async notifyAdmins(payload: NotificationPayload) {
    try {
      // Find all admin users
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true, deletedAt: null },
        select: { id: true },
      });

      const adminIds = adminUsers.map((a: { id: number }) => a.id);
      if (adminIds.length === 0) return { success: false, deliveredCount: 0 };

      // Save in-app notification for admins
      for (const adminId of adminIds) {
        await prisma.notification.create({
          data: {
            userId: adminId,
            title: payload.title,
            body: payload.body,
            channel: 'PUSH',
            type: 'SYSTEM',
            data: payload.data || {},
          },
        });
      }

      // Fetch active admin tokens
      const adminSessions = await prisma.session.findMany({
        where: {
          userId: { in: adminIds },
          isActive: true,
          fcmToken: { not: null },
        },
        select: { id: true, fcmToken: true },
      });

      const tokens: string[] = Array.from(
        new Set(adminSessions.map((s: { fcmToken: string | null }) => s.fcmToken).filter((t: string | null): t is string => Boolean(t && t.trim().length > 0)))
      );

      if (tokens.length === 0) {
        logger.info('[FCM] No admin FCM tokens found.');
        return { success: true, deliveredCount: 0 };
      }

      return await this.dispatchFcmMulticast(tokens, payload);
    } catch (err: any) {
      logger.error(`[NotificationService] notifyAdmins error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Low-level Firebase Multicast dispatcher with dead-token cleanup
   */
  private static async dispatchFcmMulticast(tokens: string[], payload: NotificationPayload) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      logger.warn('[FCM] Firebase Messaging is unconfigured or unavailable. Push skipped.');
      return { success: false, deliveredCount: 0, reason: 'FCM unavailable' };
    }

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'high_importance_channel',
            priority: 'high',
            visibility: 'public',
            defaultSound: true,
            sound: 'default',
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      });

      logger.info(`[FCM] Sent notification to ${tokens.length} tokens. Success: ${response.successCount}, Failures: ${response.failureCount}`);

      // Prune dead/expired tokens
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errCode = resp.error.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await prisma.session.updateMany({
          where: { fcmToken: { in: invalidTokens } },
          data: { fcmToken: null },
        });
        logger.info(`[FCM] Pruned ${invalidTokens.length} expired FCM tokens.`);
      }

      return {
        success: true,
        deliveredCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (err: any) {
      logger.error(`[FCM] Multicast failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
