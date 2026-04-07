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
  {
    name: 'cleanup-expired-stories',
    cron: '0 * * * *', // Every hour
    description: 'Delete expired stories (24h after creation)',
    handler: async () => {
      try {
        const { prisma } = await import('../lib/prisma.js');
        const now = new Date();
        const result = await prisma.story.deleteMany({
          where: { expires_at: { lt: now } },
        });
        if (result.count > 0) {
          console.log(`[Scheduler] Cleaned up ${result.count} expired stories`);
        }
      } catch (err: any) {
        if (err?.code === 'P2022' || err?.message?.includes('expires_at')) {
          console.warn('[Scheduler] Story expires_at column may not exist yet, skipping cleanup');
          captureMessage('Story cleanup skipped: expires_at column missing — stories are accumulating', 'warning');
        } else {
          console.error('[Scheduler] Failed to cleanup expired stories:', err);
          captureException(err instanceof Error ? err : new Error(String(err)), { extra: { context: 'story_cleanup' } });
        }
      }
    },
  },
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
  {
    name: 'event-reminders-12hr-email',
    cron: '0 * * * *', // Every hour at minute 0
    description: 'Send 12-hour event reminder emails to RSVP attendees',
    handler: async () => {
      try {
        const { prisma } = await import('../lib/prisma.js');
        const { sendEventReminderEmail } = await import('../lib/email.js');

        const now = new Date();
        const windowStart = new Date(now.getTime() + 11 * 60 * 60 * 1000); // 11h from now
        const windowEnd = new Date(now.getTime() + 13 * 60 * 60 * 1000);   // 13h from now

        const upcomingEvents = await prisma.event.findMany({
          where: {
            date: { gte: windowStart, lte: windowEnd },
            status: 'approved',
          },
          select: { id: true, title: true, date: true, location: true, rsvps: { select: { user: { select: { email: true, display_name: true } } } } },
        });

        let sent = 0;
        for (const event of upcomingEvents) {
          const eventDate = new Date(event.date);
          for (const rsvp of event.rsvps) {
            if (!rsvp.user?.email) continue;
            // Deduplicate: skip if already sent reminder for this event+email combo
            const dedupeKey = `${event.id}:${rsvp.user.email}`;
            if (await isEventReminderSent(dedupeKey)) continue;
            await markEventReminderSent(dedupeKey);
            sendEventReminderEmail({
              to: rsvp.user.email,
              recipientName: rsvp.user.display_name || 'Athlete',
              eventTitle: event.title,
              eventDate: eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
              eventTime: eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              eventLocation: event.location || '',
              eventId: event.id,
            }).catch((err) => console.warn('[Scheduler] event reminder email failed:', err?.message || err));
            sent++;
          }
        }

        if (sent > 0) console.log(`[Scheduler] Sent ${sent} event reminder emails for ${upcomingEvents.length} events`);
      } catch (error) {
        console.error('[Scheduler] Failed to send event reminder emails:', error);
      }
    },
  },
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
  {
    name: 'daily-founder-metrics',
    cron: '0 8 * * *', // Every day at 8:00 AM
    description: 'Send daily founder metrics summary via email',
    handler: async () => {
      try {
        const { getFounderMetricsReport } = await import('../lib/founderMetrics.js');
        const { sendFounderMetricsEmail } = await import('../lib/email.js');

        const report = await getFounderMetricsReport(7);
        const reportEmail = process.env.METRICS_REPORT_EMAIL || 'customerservice@varsityhub.app';

        await sendFounderMetricsEmail({
          to: reportEmail,
          report,
        });

        console.log(`[Scheduler] Daily founder metrics sent to ${reportEmail} for ${report.dateRange.end}`);
      } catch (error) {
        console.error('[Scheduler] Failed to send daily founder metrics:', error);
      }
    },
  },
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

    if (hour === 8 && minute === 0) {
      const todayDate = now.toISOString().split('T')[0];

      if (lastFounderMetricsDate !== todayDate) {
        try {
          const { getFounderMetricsReport } = await import('../lib/founderMetrics.js');
          const { sendFounderMetricsEmail } = await import('../lib/email.js');

          const report = await getFounderMetricsReport(7);
          const reportEmail = process.env.METRICS_REPORT_EMAIL || 'customerservice@varsityhub.app';

          await sendFounderMetricsEmail({
            to: reportEmail,
            report,
          });

          lastFounderMetricsDate = todayDate;
          console.log(`[Scheduler] Daily founder metrics sent to ${reportEmail} for ${report.dateRange.end}`);
        } catch (error) {
          console.error('[Scheduler] Daily founder metrics failed:', error);
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
