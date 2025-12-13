import cron from 'node-cron';
import { debugLog } from '../lib/debugLog.js';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/queue.js';

/**
 * Overnight monitoring task
 * Runs every 4 hours to check queue health and send alerts
 */
export function startOvernightMonitoring() {
  // Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    debugLog('[overnight] Running queue health check...');

    try {
      const counts = await emailQueue.getJobCounts();
      const failedJobs = await emailQueue.getFailed();
      const delayedJobs = await emailQueue.getDelayed();

      debugLog('[overnight] Queue status:', {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
      });

      // Alert if too many failures
      if (counts.failed > 10) {
        console.error(`⚠️ [overnight] HIGH FAILURE RATE: ${counts.failed} failed jobs`);
        
        // Log first 5 failed jobs for debugging
        const recentFailures = failedJobs.slice(0, 5);
        for (const job of recentFailures) {
          console.error('[overnight] Failed job:', {
            id: job.id,
            name: job.name,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            data: job.data,
          });
        }
      }

      // Alert if jobs stuck in delayed state too long
      const stuckJobs = delayedJobs.filter(job => {
        const delay = job.opts.delay || 0;
        const expectedTime = job.timestamp + delay;
        const now = Date.now();
        return now > expectedTime + 60 * 60 * 1000; // 1 hour past expected
      });

      if (stuckJobs.length > 0) {
        console.warn(`⚠️ [overnight] ${stuckJobs.length} jobs stuck in delayed state`);
      }

      // Check Redis connection
      const ping = await emailQueue.client.ping();
      if (ping !== 'PONG') {
        console.error('❌ [overnight] Redis connection lost!');
      }

      debugLog('[overnight] Health check complete ✅');
    } catch (error) {
      console.error('[overnight] Health check failed:', error);
    }
  });

  debugLog('✅ Overnight monitoring started (runs every 4 hours)');
}

/**
 * Clean up old completed jobs
 * Runs daily at 3 AM to prevent queue bloat
 */
export function startQueueCleanup() {
  // Run daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    debugLog('[cleanup] Starting queue cleanup...');

    try {
      // Remove completed jobs older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const completed = await emailQueue.getCompleted();
      
      let removedCount = 0;
      for (const job of completed) {
        if (job.finishedOn && job.finishedOn < sevenDaysAgo) {
          await job.remove();
          removedCount++;
        }
      }

      // Remove failed jobs older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const failed = await emailQueue.getFailed();
      
      let failedRemovedCount = 0;
      for (const job of failed) {
        if (job.finishedOn && job.finishedOn < thirtyDaysAgo) {
          await job.remove();
          failedRemovedCount++;
        }
      }

      debugLog(`[cleanup] Removed ${removedCount} completed jobs, ${failedRemovedCount} failed jobs ✅`);
    } catch (error) {
      console.error('[cleanup] Cleanup failed:', error);
    }
  });

  debugLog('✅ Queue cleanup started (runs daily at 3 AM)');
}

/**
 * Ad goes live notification task
 * Runs daily at midnight to check if ads should go live
 */
export function startAdGoLiveCheck() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    debugLog('[ad-go-live] Checking for ads going live today...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find ads that should go live today
      const adsGoingLive = await prisma.ad.findMany({
        where: {
          status: 'draft',
          payment_status: 'paid',
          reservations: {
            some: {
              date: {
                gte: today,
                lt: tomorrow,
              },
            },
          },
        },
        include: {
          reservations: {
            orderBy: { date: 'desc' },
          },
        },
      });

      debugLog(`[ad-go-live] Found ${adsGoingLive.length} ads going live today`);

      for (const ad of adsGoingLive) {
        // Update ad status to active
        await prisma.ad.update({
          where: { id: ad.id },
          data: { status: 'active' },
        });

        // Get the last reservation date
        const lastDate = ad.reservations[0]?.date;

        // Queue "Ad Goes Live" email
        await emailQueue.add('ads.goes_live', {
          to: ad.contact_email,
          advertiser_name: ad.contact_name,
          business_name: ad.business_name,
          ad_title: ad.business_name,
          target_zip: ad.target_zip_code,
          live_until: lastDate ? lastDate.toISOString() : '',
          analytics_dashboard_url: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/ads/${ad.id}/analytics`,
          ad_preview_url: ad.banner_url || undefined,
        });

        debugLog(`[ad-go-live] Sent notification for ad ${ad.id} (${ad.business_name})`);
      }

      debugLog('[ad-go-live] Check complete ✅');
    } catch (error) {
      console.error('[ad-go-live] Check failed:', error);
    }
  });

  debugLog('✅ Ad go-live check started (runs daily at midnight)');
}
