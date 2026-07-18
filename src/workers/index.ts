import { Worker, Job } from 'bullmq';
import { queueConfig, QUEUE_NAMES, JobProcessor } from '../config/queue';
import { initializeNotificationWorker } from '../config/queue';

// Worker configuration
export const workerConfig = {
  ...queueConfig,
  concurrency: 5,
};

// Email job processor
const emailProcessor: JobProcessor = async (job: Job) => {
  console.log(`Processing email job: ${job.id}`, job.data);
  // Implement email sending logic here
  // This would integrate with your email service (e.g., SendGrid, AWS SES, etc.)
};

// Order job processor
const orderProcessor: JobProcessor = async (job: Job) => {
  console.log(`Processing order job: ${job.id}`, job.data);
  // Implement order-related background tasks (e.g., order confirmation, status updates)
};

// Payment job processor
const paymentProcessor: JobProcessor = async (job: Job) => {
  console.log(`Processing payment job: ${job.id}`, job.data);
  // Implement payment-related background tasks (e.g., payment verification, refund processing)
};

// Inventory job processor
const inventoryProcessor: JobProcessor = async (job: Job) => {
  console.log(`Processing inventory job: ${job.id}`, job.data);
  // Implement inventory-related background tasks (e.g., stock updates, low stock alerts)
};

// Report job processor
const reportProcessor: JobProcessor = async (job: Job) => {
  console.log(`Processing report job: ${job.id}`, job.data);
  // Implement report generation tasks (e.g., daily sales reports, inventory reports)
};

// Create workers
export const emailWorker = new Worker(QUEUE_NAMES.EMAIL, emailProcessor, workerConfig);
export const notificationWorker = initializeNotificationWorker();
export const orderWorker = new Worker(QUEUE_NAMES.ORDER, orderProcessor, workerConfig);
export const paymentWorker = new Worker(QUEUE_NAMES.PAYMENT, paymentProcessor, workerConfig);
export const inventoryWorker = new Worker(QUEUE_NAMES.INVENTORY, inventoryProcessor, workerConfig);
export const reportWorker = new Worker(QUEUE_NAMES.REPORT, reportProcessor, workerConfig);

// Worker event handlers
const setupWorkerEvents = (worker: Worker, queueName: string) => {
  worker.on('completed', (job: Job) => {
    console.log(`✅ ${queueName} job ${job.id} completed successfully`);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`❌ ${queueName} job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error: Error) => {
    console.error(`❌ ${queueName} worker error:`, error);
  });
};

// Setup event handlers for all workers (except notification which has its own)
setupWorkerEvents(emailWorker, QUEUE_NAMES.EMAIL);
setupWorkerEvents(orderWorker, QUEUE_NAMES.ORDER);
setupWorkerEvents(paymentWorker, QUEUE_NAMES.PAYMENT);
setupWorkerEvents(inventoryWorker, QUEUE_NAMES.INVENTORY);
setupWorkerEvents(reportWorker, QUEUE_NAMES.REPORT);

// Export all workers
export const workers = {
  email: emailWorker,
  notification: notificationWorker,
  order: orderWorker,
  payment: paymentWorker,
  inventory: inventoryWorker,
  report: reportWorker,
};

// Graceful shutdown — must exit the process afterwards, otherwise the HTTP
// server keeps the process alive and restarts (ts-node-dev, deploys) hang.
const closeWorkers = async (signal: string) => {
  try {
    await Promise.all([
      emailWorker.close(),
      notificationWorker?.close(),
      orderWorker.close(),
      paymentWorker.close(),
      inventoryWorker.close(),
      reportWorker.close(),
    ]);
    console.log('All workers closed');
  } finally {
    process.exit(signal === 'SIGINT' ? 130 : 0);
  }
};

process.on('SIGTERM', () => closeWorkers('SIGTERM'));
process.on('SIGINT', () => closeWorkers('SIGINT'));
