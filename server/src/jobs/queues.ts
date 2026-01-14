/**
 * Background Job Queue Configuration
 * 
 * Provides BullMQ-based job queues for async processing of:
 * - Push notifications
 * - Email delivery
 * - Analytics events
 * - Media processing
 * - Scheduled tasks
 * 
 * Requires Redis to be configured via REDIS_URL env var.
 * Falls back to in-memory processing when Redis is not available.
 * 
 * @module jobs/queues
 */

import { Queue } from 'bullmq';
import type IORedis from 'ioredis';

// Job types
export interface NotificationJob {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface EmailJob {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: Record<string, any>;
}

export interface AnalyticsJob {
  event: string;
  userId?: string;
  properties: Record<string, any>;
  timestamp: string;
}

export interface MediaJob {
  type: 'backup' | 'transcode' | 'thumbnail';
  resourceId: string;
  sourceUrl: string;
  options?: Record<string, any>;
}

// Queue configuration
const QUEUE_CONFIG = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60, // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 60 * 60, // 7 days
    },
  },
};

// Redis connection (lazy initialized)
let redisConnection: IORedis | null = null;
let queuesInitialized = false;

// Queues (lazy initialized)
let notificationQueue: Queue<NotificationJob> | null = null;
let emailQueue: Queue<EmailJob> | null = null;
let analyticsQueue: Queue<AnalyticsJob> | null = null;
let mediaQueue: Queue<MediaJob> | null = null;
let schedulerQueue: Queue | null = null;

/**
 * Initialize Redis connection
 * Returns null if Redis URL is not configured
 */
async function getRedisConnection(): Promise<IORedis | null> {
  if (redisConnection) return redisConnection;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[Jobs] REDIS_URL not configured - job queues will use fallback mode');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    
    redisConnection.on('connect', () => {
      console.log('[Jobs] Redis connected');
    });
    
    redisConnection.on('error', (err) => {
      console.error('[Jobs] Redis error:', err.message);
    });
    
    return redisConnection;
  } catch (error) {
    console.error('[Jobs] Failed to connect to Redis:', error);
    return null;
  }
}

/**
 * Initialize all queues
 * Call this once at app startup
 */
export async function initializeQueues(): Promise<boolean> {
  if (queuesInitialized) return true;
  
  const connection = await getRedisConnection();
  if (!connection) {
    console.log('[Jobs] Running without Redis - using fallback mode');
    queuesInitialized = true;
    return false;
  }

  try {
    notificationQueue = new Queue<NotificationJob>('notifications', {
      connection,
      ...QUEUE_CONFIG,
    });

    emailQueue = new Queue<EmailJob>('emails', {
      connection,
      defaultJobOptions: {
        ...QUEUE_CONFIG.defaultJobOptions,
        attempts: 5, // More retries for email
      },
    });

    analyticsQueue = new Queue<AnalyticsJob>('analytics', {
      connection,
      defaultJobOptions: {
        ...QUEUE_CONFIG.defaultJobOptions,
        attempts: 2, // Analytics can fail silently
        removeOnComplete: { count: 10000 },
      },
    });

    mediaQueue = new Queue<MediaJob>('media', {
      connection,
      defaultJobOptions: {
        ...QUEUE_CONFIG.defaultJobOptions,
        attempts: 3,
      },
    });

    schedulerQueue = new Queue('scheduler', {
      connection,
    });

    queuesInitialized = true;
    console.log('[Jobs] All queues initialized');
    return true;
  } catch (error) {
    console.error('[Jobs] Failed to initialize queues:', error);
    return false;
  }
}

/**
 * Add a notification job to the queue
 */
export async function queueNotification(job: NotificationJob): Promise<string | null> {
  if (!queuesInitialized) await initializeQueues();
  
  if (notificationQueue) {
    const added = await notificationQueue.add('send', job, {
      priority: 1, // High priority
    });
    return added.id || null;
  }
  
  // Fallback: process immediately
  console.log('[Jobs] Fallback: Processing notification immediately');
  try {
    const { sendPushNotification } = await import('../lib/notifications.js');
    await sendPushNotification(job.userId, job.title, job.body, job.data);
    return 'immediate';
  } catch (error) {
    console.error('[Jobs] Fallback notification failed:', error);
    return null;
  }
}

/**
 * Add an email job to the queue
 */
export async function queueEmail(job: EmailJob): Promise<string | null> {
  if (!queuesInitialized) await initializeQueues();
  
  if (emailQueue) {
    const added = await emailQueue.add('send', job);
    return added.id || null;
  }
  
  // Fallback: process immediately
  console.log('[Jobs] Fallback: Processing email immediately');
  try {
    const { sendEmail } = await import('../lib/email.js');
    await sendEmail({ to: job.to, subject: job.subject, text: job.text, html: job.html });
    return 'immediate';
  } catch (error) {
    console.error('[Jobs] Fallback email failed:', error);
    return null;
  }
}

/**
 * Add an analytics event to the queue
 */
export async function queueAnalytics(job: AnalyticsJob): Promise<string | null> {
  if (!queuesInitialized) await initializeQueues();
  
  if (analyticsQueue) {
    const added = await analyticsQueue.add('track', job);
    return added.id || null;
  }
  
  // Fallback: log immediately
  console.log('[Analytics]', job.event, job.properties);
  return 'immediate';
}

/**
 * Add a media processing job to the queue
 */
export async function queueMediaJob(job: MediaJob): Promise<string | null> {
  if (!queuesInitialized) await initializeQueues();
  
  if (mediaQueue) {
    const added = await mediaQueue.add(job.type, job, {
      priority: job.type === 'backup' ? 3 : 2, // Lower priority for backups
    });
    return added.id || null;
  }
  
  console.warn('[Jobs] Media job queued but will not be processed (no Redis)');
  return null;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<Record<string, any>> {
  if (!queuesInitialized) await initializeQueues();
  
  const stats: Record<string, any> = {
    redis: !!redisConnection,
    queues: {},
  };
  
  const queues = [
    { name: 'notifications', queue: notificationQueue },
    { name: 'emails', queue: emailQueue },
    { name: 'analytics', queue: analyticsQueue },
    { name: 'media', queue: mediaQueue },
    { name: 'scheduler', queue: schedulerQueue },
  ];
  
  for (const { name, queue } of queues) {
    if (queue) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);
        stats.queues[name] = { waiting, active, completed, failed };
      } catch {
        stats.queues[name] = { error: 'Failed to get stats' };
      }
    } else {
      stats.queues[name] = { status: 'not initialized' };
    }
  }
  
  return stats;
}

/**
 * Gracefully shutdown all queues
 */
export async function shutdownQueues(): Promise<void> {
  console.log('[Jobs] Shutting down queues...');
  
  const queues = [notificationQueue, emailQueue, analyticsQueue, mediaQueue, schedulerQueue];
  
  await Promise.all(
    queues.filter(Boolean).map((q) => q!.close())
  );
  
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
  
  queuesInitialized = false;
  console.log('[Jobs] All queues shutdown complete');
}

export {
    analyticsQueue, emailQueue, mediaQueue, notificationQueue, schedulerQueue
};

