import admin from 'firebase-admin';
import * as path from 'path';

// Firebase Admin configuration for server-side notifications
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

// Initialize Firebase Admin for server-side notifications
let firebaseAdmin: admin.app.App | null = null;

export const initializeFirebaseAdmin = () => {
  if (!firebaseAdmin) {
    try {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
    } catch (error) {
      // Firebase already initialized or missing credentials
      if (!firebaseAdmin) {
        firebaseAdmin = admin.initializeApp();
      }
    }
  }
  return firebaseAdmin;
};

export const getFirebaseMessaging = () => {
  const app = initializeFirebaseAdmin();
  if (!app) throw new Error('Firebase Admin not initialized');
  return admin.messaging(app);
};

export default initializeFirebaseAdmin;
