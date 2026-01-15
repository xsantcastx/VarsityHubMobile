/**
 * Notification Worker
 * 
 * Processes notification jobs from the queue.
 * Handles push notification delivery with retry logic.
 * 
 * Run with: npx ts-node server/src/jobs/workers/notificationWorker.ts
 * Or configure as a Railway service
 * 
 * @module jobs/workers/notificationWorker
 */

import * as Sentry from '@sentry/node';
import { Job, Worker } from 'bullmq';
import type { NotificationJob } from '../queues.js';

let worker: Worker<NotificationJob> | null = null;

/**
 * Start the notification worker
 */
export async function startNotificationWorker(): Promise<Worker<NotificationJob> | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[NotificationWorker] No REDIS_URL configured, worker not started');
    return null;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    const connection = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const { sendPushNotification } = await import('../../lib/notifications.js');

    worker = new Worker<NotificationJob>(
      'notifications',
      async (job: Job<NotificationJob>) => {
        const { userId, title, body, data } = job.data;

        console.log(`[NotificationWorker] Processing job ${job.id} for user ${userId}`);

        try {
          await sendPushNotification(userId, title, body, data);
          
          return {
            success: true,
            processedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error(`[NotificationWorker] Failed to send notification:`, error);
          throw error; // Re-throw for retry
        }
      },
      {
        connection,
        concurrency: 10, // Process 10 notifications concurrently
        limiter: {
          max: 100,
          duration: 1000, // Max 100 per second
        },
      }
    );

    worker.on('completed', (job) => {
      console.log(`[NotificationWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
      if (Sentry) {
        Sentry.captureException(err, {
          tags: { worker: 'notification', jobId: job?.id },
        });
      }
    });

    worker.on('error', (err) => {
      console.error('[NotificationWorker] Worker error:', err);
    });

    console.log('[NotificationWorker] Started');
    return worker;
  } catch (error) {
    console.error('[NotificationWorker] Failed to start:', error);
    return null;
  }
}

/**
 * Stop the notification worker gracefully
 */
export async function stopNotificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[NotificationWorker] Stopped');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startNotificationWorker()
    .then((w) => {
      if (!w) {
        console.log('Worker not started - check REDIS_URL');
        process.exit(0);
      }
      console.log('Notification worker running. Press Ctrl+C to stop.');
    })
    .catch((error) => {
      console.error('Fatal error starting worker:', error);
      process.exit(1);
    });

  // Handle shutdown signals
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await stopNotificationWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await stopNotificationWorker();
    process.exit(0);
  });
}
