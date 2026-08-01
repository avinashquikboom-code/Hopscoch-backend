import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

// Firebase Admin configuration for server-side notifications
let firebaseAdmin: admin.app.App | null = null;

export const initializeFirebaseAdmin = (): admin.app.App | null => {
  if (firebaseAdmin) return firebaseAdmin;
  if (admin.apps.length > 0) {
    firebaseAdmin = admin.apps[0]!;
    return firebaseAdmin;
  }

  try {
    const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
      logger.info('[FCM] Firebase Admin initialized from serviceAccountKey.json');
      return firebaseAdmin;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      logger.info('[FCM] Firebase Admin initialized from environment variables');
      return firebaseAdmin;
    }

    // Default initialization (GCP metadata service or DEFAULT app)
    firebaseAdmin = admin.initializeApp();
    logger.info('[FCM] Firebase Admin initialized with default credentials');
    return firebaseAdmin;
  } catch (error: any) {
    logger.warn(`[FCM] Firebase Admin initialization warning: ${error.message}`);
    return null;
  }
};

export const getFirebaseMessaging = (): admin.messaging.Messaging | null => {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  try {
    return admin.messaging(app);
  } catch (err: any) {
    logger.warn(`[FCM] getFirebaseMessaging failed: ${err.message}`);
    return null;
  }
};

export default initializeFirebaseAdmin;
