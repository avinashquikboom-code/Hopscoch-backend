import { Queue, Worker, Job } from 'bullmq';

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
