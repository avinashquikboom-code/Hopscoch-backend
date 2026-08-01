import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import path from 'path';
import fs from 'fs';

const router = Router();
const filePath = path.join(__dirname, '../notifications.json');

const readNotifications = async (): Promise<any[]> => {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeNotifications = async (data: any[]): Promise<void> => {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

import { UnifiedNotificationService } from '../services/unified-notification.service';
import prisma from '../../../utils/prisma';

// POST register or update FCM device token
router.post('/token', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { fcmToken, deviceType, platform } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required' });
    }

    const session = await UnifiedNotificationService.registerToken(
      userId,
      fcmToken,
      (deviceType?.toUpperCase() as any) || 'MOBILE',
      platform || 'android'
    );

    return ResponseFormatter.success(res, 'FCM token registered successfully', session);
  } catch (error) {
    return next(error);
  }
});

// GET persistent in-app notifications for authenticated user
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return ResponseFormatter.success(res, 'User notifications retrieved successfully', notifications);
  } catch (error) {
    return next(error);
  }
});

// GET all broadcast notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = await readNotifications();
    return ResponseFormatter.success(res, 'Notifications retrieved successfully', notifications);
  } catch (error) {
    return next(error);
  }
});

// POST create notification draft
router.post('/', authenticate, async (req, res, next) => {
  try {
    const notifications = await readNotifications();
    const newNotification = {
      id: String(Date.now() + Math.floor(Math.random() * 1000)),
      title: req.body.title,
      message: req.body.message,
      type: req.body.type || 'general',
      sendToAll: req.body.sendToAll ?? true,
      targetUsers: req.body.targetUsers || [],
      isSent: false,
      sentAt: null,
      createdAt: new Date().toISOString()
    };
    notifications.unshift(newNotification);
    await writeNotifications(notifications);
    return ResponseFormatter.success(res, 'Notification draft created successfully', newNotification);
  } catch (error) {
    return next(error);
  }
});

// POST send/dispatch notification
router.post('/:id/send', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    let notifications = await readNotifications();
    let targetNotification: any = null;

    notifications = notifications.map(n => {
      if (n.id === id) {
        targetNotification = {
          ...n,
          isSent: true,
          sentAt: new Date().toISOString()
        };
        return targetNotification;
      }
      return n;
    });

    if (!targetNotification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await writeNotifications(notifications);
    return ResponseFormatter.success(res, 'Notification sent successfully', targetNotification);
  } catch (error) {
    return next(error);
  }
});

// DELETE notification
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    let notifications = await readNotifications();
    const exists = notifications.some(n => n.id === id);

    if (!exists) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notifications = notifications.filter(n => n.id !== id);
    await writeNotifications(notifications);
    return ResponseFormatter.success(res, 'Notification deleted successfully');
  } catch (error) {
    return next(error);
  }
});

export default router;
