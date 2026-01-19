/**
 * Scheduler Service
 * 
 * Sets up repeatable jobs for scheduled tasks:
 * - Game reminders (12hr and 1hr before)
 * - Daily digest emails
 * - Cleanup old notifications
 * - Push receipt verification
 * 
 * Run with: npx ts-node server/src/jobs/scheduler.ts
 * Or configure as a Railway cron service
 * 
 * @module jobs/scheduler
 */

import { Queue } from 'bullmq';

interface ScheduledJob {
  name: string;
  cron: string;
  handler: () => Promise<void>;
  description: string;
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: 'game-reminders-12hr',
    cron: '0 * * * *', // Every hour at minute 0
    description: 'Send 12-hour game reminders',
    handler: async () => {
      const { notifyUpcomingGames } = await import('../lib/notifications.js');
      await notifyUpcomingGames(12);
    },
  },
  {
    name: 'game-reminders-1hr',
    cron: '30 * * * *', // Every hour at minute 30
    description: 'Send 1-hour game reminders',
    handler: async () => {
      const { notifyUpcomingGames } = await import('../lib/notifications.js');
      await notifyUpcomingGames(1);
    },
  },
  {
    name: 'cleanup-old-notifications',
    cron: '0 3 * * *', // Every day at 3am
    description: 'Clean up old read notifications',
    handler: async () => {
      const { prisma } = await import('../lib/prisma.js');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await prisma.notification.deleteMany({
        where: {
          read_at: { not: null },
          created_at: { lt: thirtyDaysAgo },
        },
      });
      
      console.log(`[Scheduler] Cleaned up ${result.count} old notifications`);
    },
  },
  {
    name: 'verify-push-receipts',
    cron: '*/15 * * * *', // Every 15 minutes
    description: 'Check push notification delivery receipts',
    handler: async () => {
      // This would check Expo push receipts
      console.log('[Scheduler] Push receipt verification - TODO');
    },
  },
  {
    name: 'end-of-day-transaction-report',
    cron: '59 23 * * *', // Every day at 11:59 PM
    description: 'Send end-of-day transaction report via email',
    handler: async () => {
      try {
        const { getEndOfDayReport } = await import('../lib/transactionLogger.js');
        const { sendEndOfDayTransactionReport } = await import('../lib/email.js');
        
        // Get report for today
        const report = await getEndOfDayReport();
        
        // Get recipient email from environment variable or use first admin email
        const reportEmail = process.env.TRANSACTION_REPORT_EMAIL || 
          (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim() ||
          'emancero@varsityhub.app'; // Fallback to primary admin
        
        if (!reportEmail) {
          console.warn('[Scheduler] No email configured for transaction reports');
          return;
        }
        
        await sendEndOfDayTransactionReport({
          to: reportEmail,
          report,
        });
        
        console.log(`[Scheduler] End-of-day transaction report sent to ${reportEmail} for ${report.date}`);
      } catch (error) {
        console.error('[Scheduler] Failed to send end-of-day transaction report:', error);
      }
    },
  },
];

let schedulerQueue: Queue | null = null;

/**
 * Setup all scheduled jobs
 */
export async function setupScheduler(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Scheduler] No REDIS_URL configured, using fallback cron');
    return setupFallbackCron();
  }

  try {
    const { default: Redis } = await import('ioredis');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    const connection = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: null,
    });

    schedulerQueue = new Queue('scheduler', { connection });

    // Remove existing repeatable jobs and add fresh ones
    const existingJobs = await schedulerQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }

    // Add scheduled jobs
    for (const job of SCHEDULED_JOBS) {
      await schedulerQueue.add(
        job.name,
        { description: job.description },
        {
          repeat: { pattern: job.cron },
          removeOnComplete: true,
          removeOnFail: { count: 10 },
        }
      );
      console.log(`[Scheduler] Added job: ${job.name} (${job.cron})`);
    }

    console.log('[Scheduler] All scheduled jobs configured');
    return true;
  } catch (error) {
    console.error('[Scheduler] Failed to setup:', error);
    return false;
  }
}

/**
 * Fallback cron using setInterval (for when Redis is not available)
 */
// Track last date when end-of-day transaction report was sent to prevent duplicates
let lastTransactionReportDate: string | null = null;

function setupFallbackCron(): boolean {
  console.log('[Scheduler] Setting up fallback cron with setInterval');

  // Game reminders - every hour
  setInterval(async () => {
    try {
      const { notifyUpcomingGames } = await import('../lib/notifications.js');
      await notifyUpcomingGames(12);
      await notifyUpcomingGames(1);
    } catch (error) {
      console.error('[Scheduler] Game reminder failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Cleanup - once per day (check every hour, run at 3am)
  setInterval(async () => {
    const hour = new Date().getHours();
    if (hour === 3) {
      try {
        const { prisma } = await import('../lib/prisma.js');
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        await prisma.notification.deleteMany({
          where: {
            read_at: { not: null },
            created_at: { lt: thirtyDaysAgo },
          },
        });
      } catch (error) {
        console.error('[Scheduler] Cleanup failed:', error);
      }
    }
  }, 60 * 60 * 1000); // Check every hour

  // End-of-day transaction report - check every minute, run at 11:59 PM
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Run at 11:59 PM
    if (hour === 23 && minute === 59) {
      // Get today's date string (YYYY-MM-DD) to prevent duplicate sends
      const todayDate = now.toISOString().split('T')[0];
      
      // Only send if we haven't already sent for today
      if (lastTransactionReportDate !== todayDate) {
        try {
          const { getEndOfDayReport } = await import('../lib/transactionLogger.js');
          const { sendEndOfDayTransactionReport } = await import('../lib/email.js');
          
          const report = await getEndOfDayReport();
          
          const reportEmail = process.env.TRANSACTION_REPORT_EMAIL || 
            (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim() ||
            'emancero@varsityhub.app';
          
          if (reportEmail) {
            await sendEndOfDayTransactionReport({
              to: reportEmail,
              report,
            });
            lastTransactionReportDate = todayDate;
            console.log(`[Scheduler] End-of-day transaction report sent to ${reportEmail} for ${report.date}`);
          }
        } catch (error) {
          console.error('[Scheduler] End-of-day transaction report failed:', error);
        }
      }
    }
  }, 60 * 1000); // Check every minute

  return true;
}

/**
 * Start the scheduler worker to process scheduled jobs
 */
export async function startSchedulerWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Scheduler] No Redis - using fallback mode');
    await setupFallbackCron();
    return;
  }

  try {
    const { Worker } = await import('bullmq');
    const { default: Redis } = await import('ioredis');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    const connection = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const worker = new Worker(
      'scheduler',
      async (job) => {
        const scheduledJob = SCHEDULED_JOBS.find((j) => j.name === job.name);
        if (scheduledJob) {
          console.log(`[Scheduler] Running ${job.name}: ${scheduledJob.description}`);
          await scheduledJob.handler();
        } else {
          console.warn(`[Scheduler] Unknown job: ${job.name}`);
        }
      },
      { connection }
    );

    worker.on('completed', (job) => {
      console.log(`[Scheduler] Job ${job.name} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[Scheduler] Job ${job?.name} failed:`, err);
    });

    console.log('[Scheduler] Worker started');
  } catch (error) {
    console.error('[Scheduler] Failed to start worker:', error);
  }
}

/**
 * List all scheduled jobs
 */
export async function listScheduledJobs(): Promise<Array<{ name: string; cron: string; description: string }>> {
  return SCHEDULED_JOBS.map(({ name, cron, description }) => ({ name, cron, description }));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await setupScheduler();
    await startSchedulerWorker();
    console.log('Scheduler running. Press Ctrl+C to stop.');
  })();

  process.on('SIGTERM', () => {
    console.log('Scheduler shutting down...');
    process.exit(0);
  });
}

export { SCHEDULED_JOBS };
