import Queue from 'bull';
import Redis from 'ioredis';
import { debugLog } from './debugLog.js';

// Redis connection details
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

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

// Increase max listeners to prevent warning (we have multiple cron jobs listening)
emailQueue.setMaxListeners(15);

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
    console.error('❌ Failed to connect to Redis:', error);
    process.exit(1);
  }
}

// Graceful shutdown
export async function closeQueue(): Promise<void> {
  await emailQueue.close();
  await redis.quit();
  await redisSubscriber.quit();
  debugLog('[queue] Queue and Redis connections closed');
}
