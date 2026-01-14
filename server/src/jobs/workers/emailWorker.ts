/**
 * Email Worker
 * 
 * Processes email jobs from the queue.
 * Handles email delivery with retry logic.
 * 
 * Run with: npx ts-node server/src/jobs/workers/emailWorker.ts
 * Or configure as a Railway service
 * 
 * @module jobs/workers/emailWorker
 */

import * as Sentry from '@sentry/node';
import { Job, Worker } from 'bullmq';
import type { EmailJob } from '../queues.js';

let worker: Worker<EmailJob> | null = null;

/**
 * Start the email worker
 */
export async function startEmailWorker(): Promise<Worker<EmailJob> | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[EmailWorker] No REDIS_URL configured, worker not started');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const { sendEmail } = await import('../../lib/email.js');

    worker = new Worker<EmailJob>(
      'emails',
      async (job: Job<EmailJob>) => {
        const { to, subject, text, html, template, templateData } = job.data;

        console.log(`[EmailWorker] Processing job ${job.id} to ${to}`);

        try {
          // TODO: Add template rendering if template is specified
          await sendEmail({ to, subject, text, html });
          
          return {
            success: true,
            processedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error(`[EmailWorker] Failed to send email:`, error);
          throw error; // Re-throw for retry
        }
      },
      {
        connection,
        concurrency: 5, // Process 5 emails concurrently
        limiter: {
          max: 20,
          duration: 1000, // Max 20 per second (email provider limits)
        },
      }
    );

    worker.on('completed', (job) => {
      console.log(`[EmailWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[EmailWorker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err);
      if (Sentry) {
        Sentry.captureException(err, {
          tags: { worker: 'email', jobId: job?.id },
        });
      }
    });

    worker.on('error', (err) => {
      console.error('[EmailWorker] Worker error:', err);
    });

    console.log('[EmailWorker] Started');
    return worker;
  } catch (error) {
    console.error('[EmailWorker] Failed to start:', error);
    return null;
  }
}

/**
 * Stop the email worker gracefully
 */
export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[EmailWorker] Stopped');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startEmailWorker()
    .then((w) => {
      if (!w) {
        console.log('Worker not started - check REDIS_URL');
        process.exit(0);
      }
      console.log('Email worker running. Press Ctrl+C to stop.');
    })
    .catch((error) => {
      console.error('Fatal error starting worker:', error);
      process.exit(1);
    });

  process.on('SIGTERM', async () => {
    await stopEmailWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await stopEmailWorker();
    process.exit(0);
  });
}
