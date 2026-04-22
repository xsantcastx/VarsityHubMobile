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
import { captureException, captureMessage } from '../lib/sentry.js';

// In-memory dedup for event reminder emails — used as fallback when Redis is unavailable
const eventRemindersSentFallback = new Set<string>();

// Clear fallback dedup cache daily to prevent unbounded memory growth
setInterval(() => {
  const size = eventRemindersSentFallback.size;
  if (size > 0) {
    eventRemindersSentFallback.clear();
    console.log(`[Scheduler] Cleared ${size} event reminder dedup entries (fallback set)`);
  }
}, 24 * 60 * 60 * 1000);

let _redisForDedup: any = null;
async function getRedisForDedup(): Promise<any | null> {
  if (_redisForDedup) return _redisForDedup;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  try {
    const { default: Redis } = await import('ioredis');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    _redisForDedup = new RedisCtor(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await _redisForDedup.connect();
    return _redisForDedup;
  } catch {
    return null;
  }
}

async function isEventReminderSent(key: string): Promise<boolean> {
  try {
    const redis = await getRedisForDedup();
    if (redis) {
      const exists = await redis.exists(`event_reminder:${key}`);
      return exists === 1;
    }
  } catch {
    console.warn('[Scheduler] Redis dedup check failed — falling back to in-memory set');
  }
  return eventRemindersSentFallback.has(key);
}

async function markEventReminderSent(key: string): Promise<void> {
  try {
    const redis = await getRedisForDedup();
    if (redis) {
      await redis.set(`event_reminder:${key}`, '1', 'EX', 86400);
      return;
    }
  } catch {
    console.warn('[Scheduler] Redis dedup write failed — falling back to in-memory set');
  }
  eventRemindersSentFallback.add(key);
}

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
  // Stories persist forever — no cleanup job. BullMQ rejects the "Feb 31" pattern
  // that used to park this as a disabled stub, so the entry is removed entirely.
  {
    name: 'verify-push-receipts',
    cron: '*/15 * * * *', // Every 15 minutes
    description: 'Check push notification delivery receipts',
    handler: async () => {
      const { verifyPushReceipts } = await import('../lib/notifications.js');
      await verifyPushReceipts();
    },
  },
  {
    name: 'end-of-day-transaction-report',
    cron: '59 23 * * *', // Every day at 11:59 PM
    description: 'End-of-day transaction report (email removed, logs only)',
    handler: async () => {
      try {
        const { getEndOfDayReport } = await import('../lib/transactionLogger.js');
        const report = await getEndOfDayReport();
        console.log(`[Scheduler] End-of-day transaction report for ${report.date}`);
      } catch (error) {
        console.error('[Scheduler] Failed to generate end-of-day transaction report:', error);
      }
    },
  },
  // Event reminder email job removed — non-mandatory engagement email
  {
    name: 'db-backup-sync',
    cron: '0 */6 * * *', // Every 6 hours
    description: 'Sync primary database to backup Postgres instance',
    handler: async () => {
      try {
        const { syncDatabaseBackup } = await import('../lib/dbBackupSync.js');
        const result = await syncDatabaseBackup();
        if (result.success) {
          console.log(`[Scheduler] DB backup sync: ${result.tablesSync} tables, ${result.totalRows} rows`);
        } else if (result.error?.includes('not configured')) {
          // Silent skip — no backup URL set
        } else {
          console.error('[Scheduler] DB backup sync failed:', result.error);
        }
      } catch (error) {
        console.error('[Scheduler] DB backup sync error:', error);
      }
    },
  },
  // Founder metrics job removed — non-mandatory internal report email
  {
    name: 'subscription-expiry-check',
    cron: '0 9 * * *', // Every day at 9:00 AM
    description: 'Send renewal reminders for expiring subscriptions',
    handler: async () => {
      try {
        const { checkExpiringSubscriptions } = await import('./subscriptionExpiryChecker.js');
        await checkExpiringSubscriptions();
      } catch (error) {
        console.error('[Scheduler] Failed to check expiring subscriptions:', error);
      }
    },
  },
  {
    name: 'coach-approval-reminder',
    cron: '30 9 * * *', // Every day at 9:30 AM
    description: 'Log reminder about coaches pending > 7 days',
    handler: async () => {
      try {
        const { prisma } = await import('../lib/prisma.js');
        const { remindPendingCoachApprovals } = await import('../lib/approvalService.js');
        await remindPendingCoachApprovals(prisma);
      } catch (error) {
        console.error('[Scheduler] Coach approval reminder failed:', error);
      }
    },
  },
  {
    name: 'coach-approval-auto-expire',
    cron: '0 10 * * *', // Every day at 10:00 AM
    description: 'Auto-reject coaches pending > 30 days',
    handler: async () => {
      try {
        const { prisma } = await import('../lib/prisma.js');
        const { autoExpirePendingCoaches } = await import('../lib/approvalService.js');
        await autoExpirePendingCoaches(prisma);
      } catch (error) {
        console.error('[Scheduler] Coach approval auto-expire failed:', error);
      }
    },
  },
  {
    name: 'stale-event-auto-reject',
    cron: '30 3 * * *', // Every day at 3:30 AM
    description: 'Auto-reject pending events past their event date',
    handler: async () => {
      try {
        const { prisma } = await import('../lib/prisma.js');
        const { autoExpireStaleEvents } = await import('../lib/approvalService.js');
        await autoExpireStaleEvents(prisma);
      } catch (error) {
        console.error('[Scheduler] Stale event auto-reject failed:', error);
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
let lastFounderMetricsDate: string | null = null;

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

  // Push receipt verification - every 15 minutes
  setInterval(async () => {
    try {
      const { verifyPushReceipts } = await import('../lib/notifications.js');
      await verifyPushReceipts();
    } catch (error) {
      console.error('[Scheduler] Push receipt verification failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes

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
          const report = await getEndOfDayReport();
          if (report) {
            console.log(`[Scheduler] Fallback EOD report for ${report.date}`);
          }
          lastTransactionReportDate = todayDate;
        } catch (error) {
          console.error('[Scheduler] End-of-day transaction report failed:', error);
        }
      }
    }
  }, 60 * 1000); // Check every minute

  // Coach approval reminder - daily
  setInterval(async () => {
    try {
      const { prisma } = await import('../lib/prisma.js');
      const { remindPendingCoachApprovals } = await import('../lib/approvalService.js');
      await remindPendingCoachApprovals(prisma);
    } catch (error) {
      console.error('[Scheduler] Coach approval reminder failed:', error);
    }
  }, 24 * 60 * 60 * 1000);

  // Coach approval auto-expire - daily
  setInterval(async () => {
    try {
      const { prisma } = await import('../lib/prisma.js');
      const { autoExpirePendingCoaches } = await import('../lib/approvalService.js');
      await autoExpirePendingCoaches(prisma);
    } catch (error) {
      console.error('[Scheduler] Coach approval auto-expire failed:', error);
    }
  }, 24 * 60 * 60 * 1000);

  // Stale event auto-reject - daily
  setInterval(async () => {
    try {
      const { prisma } = await import('../lib/prisma.js');
      const { autoExpireStaleEvents } = await import('../lib/approvalService.js');
      await autoExpireStaleEvents(prisma);
    } catch (error) {
      console.error('[Scheduler] Stale event auto-reject failed:', error);
    }
  }, 24 * 60 * 60 * 1000);

  // Daily founder metrics report - check every minute, run at 8:00 AM
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Founder metrics email removed — non-mandatory internal report email
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
