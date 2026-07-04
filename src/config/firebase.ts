import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "your-firebase-api-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "shopping-70c5d.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "shopping-70c5d",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "shopping-70c5d.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "556594786143",
  appId: process.env.FIREBASE_APP_ID || "1:556594786143:web:ea9b2ce63e6a15971010ea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = getMessaging(app);

export { app, messaging, getToken };

export default firebaseConfig;
