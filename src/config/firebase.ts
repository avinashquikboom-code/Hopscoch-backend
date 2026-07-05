import admin from 'firebase-admin';

// Firebase Admin configuration for server-side notifications
const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'shopping-70c5d',
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk@shopping-70c5d.iam.gserviceaccount.com',
};

// Initialize Firebase Admin for server-side notifications
let firebaseAdmin: admin.app.App | null = null;

export const initializeFirebaseAdmin = () => {
  if (!firebaseAdmin) {
    try {
      if (firebaseAdminConfig.projectId) {
        firebaseAdmin = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseAdminConfig.projectId,
            privateKey: firebaseAdminConfig.privateKey || '',
            clientEmail: firebaseAdminConfig.clientEmail,
          }),
        });
      }
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
