import Queue from 'bull';
import Redis from 'ioredis';
import { debugLog } from './debugLog.js';

// Redis connection details
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL must be set in production');
}

// Helper to appease TS when using CommonJS default export
const RedisCtor = Redis as unknown as new (url?: string) => import('ioredis').default;

// Create Redis connections (one for client, one for subscriber)
export const redis = new RedisCtor(REDIS_URL);
export const redisSubscriber = new RedisCtor(REDIS_URL);

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
emailQueue.on('waiting', (jobId) => {
  debugLog(`[queue] Email job waiting: ${jobId}`);
});

emailQueue.on('active', (job) => {
  debugLog(`[queue] Email job processing: ${job.id}`);
});

emailQueue.on('completed', (job) => {
  debugLog(`✅ [queue] Email job completed: ${job.id}`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`❌ [queue] Email job failed: ${job.id}`, err.message);
});

emailQueue.on('error', (err) => {
  console.error('❌ [queue] Email queue error:', err);
});

// Test Redis connection on startup
export async function initializeQueue(): Promise<void> {
  try {
    await redis.ping();
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
  await redis.quit();
  await redisSubscriber.quit();
  debugLog('[queue] Queue and Redis connections closed');
}
