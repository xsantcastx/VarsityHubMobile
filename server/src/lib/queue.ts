import Queue from 'bull';
import { debugLog } from './debugLog.js';

// Redis connection details
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize email queue
export const emailQueue = new Queue('email', REDIS_URL, {
  settings: {
    // Attempt retry up to 3 times with exponential backoff
    retryProcessDelay: 5000, // 5 seconds between retries
    stalledInterval: 5000,
    maxStalledCount: 2,
    lockDuration: 30000,
  },
});

// Queue event listeners
emailQueue.on('waiting', jobId => {
  debugLog(`[queue] Email job waiting: ${jobId}`);
});

emailQueue.on('active', job => {
  debugLog(`[queue] Email job processing: ${job.id}`);
});

emailQueue.on('completed', job => {
  debugLog(`✅ [queue] Email job completed: ${job.id}`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`❌ [queue] Email job failed: ${job.id}`, err.message);
});

emailQueue.on('error', err => {
  console.error('❌ [queue] Email queue error:', err);
});

// Test Redis connection on startup
export async function initializeQueue(): Promise<void> {
  try {
    await emailQueue.isReady();
    await emailQueue.client.ping();
    debugLog('✅ Queue system initialized (Redis connected)');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn('⚠️  Redis not available - email queue will not work:', errMsg);
    console.warn('⚠️  Add Redis in Railway to enable email functionality');
    // Don't exit - allow app to run without Redis
  }
}

// Graceful shutdown
export async function closeQueue(): Promise<void> {
  await emailQueue.close();
  debugLog('[queue] Queue and Redis connections closed');
}
