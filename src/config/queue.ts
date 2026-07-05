import { Queue, Worker, Job } from 'bullmq';
import { getFirebaseMessaging } from './firebase';

// Queue configuration
export const queueConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 24 * 3600, // 24 hours
      count: 5000,
    },
  },
};

// Define queue names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  ORDER: 'order',
  PAYMENT: 'payment',
  INVENTORY: 'inventory',
  REPORT: 'report',
} as const;

// Create queues
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, queueConfig);
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, queueConfig);
export const orderQueue = new Queue(QUEUE_NAMES.ORDER, queueConfig);
export const paymentQueue = new Queue(QUEUE_NAMES.PAYMENT, queueConfig);
export const inventoryQueue = new Queue(QUEUE_NAMES.INVENTORY, queueConfig);
export const reportQueue = new Queue(QUEUE_NAMES.REPORT, queueConfig);

// Export all queues
export const queues = {
  email: emailQueue,
  notification: notificationQueue,
  order: orderQueue,
  payment: paymentQueue,
  inventory: inventoryQueue,
  report: reportQueue,
};

// Job processors interface
export interface JobData {
  type: string;
  data: any;
}

// Generic job processor type
export type JobProcessor = (job: Job<JobData>) => Promise<void>;

// Notification queue processor
export const initializeNotificationWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job) => {
      const { type, data } = job.data;
      
      // Process notification based on type
      switch (type) {
        case 'PUSH':
          return await sendPushNotification(data);
        case 'EMAIL':
          return await sendEmailNotification(data);
        case 'SMS':
          return await sendSMSNotification(data);
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }
    },
    {
      connection: queueConfig.connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err.message);
  });

  return worker;
};

// Send push notification via Firebase
async function sendPushNotification(data: any) {
  try {
    const messaging = getFirebaseMessaging();

    const message = {
      notification: {
        title: data.title,
        body: data.body,
      },
      token: data.deviceToken,
      data: data.additionalData || {},
    };

    await messaging.send(message);
    return { success: true, message: 'Push notification sent' };
  } catch (error: any) {
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

// Send email notification (placeholder)
async function sendEmailNotification(data: any) {
  // Implement email sending logic here
  console.log('Sending email notification:', data);
  return { success: true, message: 'Email notification sent' };
}

// Send SMS notification (placeholder)
async function sendSMSNotification(data: any) {
  // Implement SMS sending logic here
  console.log('Sending SMS notification:', data);
  return { success: true, message: 'SMS notification sent' };
}
