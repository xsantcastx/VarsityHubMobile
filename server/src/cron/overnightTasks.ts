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
 * Ad lifecycle tasks — runs daily at midnight:
 * 1. Send go-live notifications for active+paid ads whose first reservation starts today
 * 2. Archive expired ads (all reservations in the past)
 * 3. Clean up stale payment holds (older than 1 hour)
 */
export function startAdGoLiveCheck() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    debugLog('[ad-lifecycle] Running daily ad lifecycle checks...');

    try {
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // 1. Go-live notifications: active+paid ads with their earliest reservation starting today
      //    Filter out ads that have already been notified (go_live_notified_at is set)
      const adsGoingLive = await prisma.ad.findMany({
        where: {
          status: 'active',
          payment_status: 'paid',
          go_live_notified_at: null,
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
            orderBy: { date: 'asc' },
          },
        },
      });

      // Only notify if today is the FIRST reservation date (not a mid-run date)
      const firstDayAds = adsGoingLive.filter(ad => {
        const firstDate = ad.reservations[0]?.date;
        return firstDate && firstDate >= today && firstDate < tomorrow;
      });

      debugLog(`[ad-lifecycle] ${firstDayAds.length} ads starting today`);

      for (const ad of firstDayAds) {
        const lastDate = ad.reservations[ad.reservations.length - 1]?.date;

        await emailQueue.add('ads.goes_live', {
          to: ad.contact_email,
          advertiser_name: ad.contact_name,
          business_name: ad.business_name,
          ad_title: ad.business_name,
          target_zip: ad.target_zip_code,
          live_until: lastDate ? lastDate.toISOString() : '',
          analytics_dashboard_url: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/ads/${ad.id}`,
          ad_preview_url: ad.banner_url || undefined,
        });

        await prisma.ad.update({
          where: { id: ad.id },
          data: { go_live_notified_at: new Date() },
        });

        debugLog(`[ad-lifecycle] Go-live notification sent for ad ${ad.id} (${ad.business_name})`);
      }

      // 2. Archive expired ads: active+paid but ALL reservations are in the past
      const expiredAds = await prisma.ad.findMany({
        where: {
          status: 'active',
          payment_status: 'paid',
          reservations: {
            every: {
              date: { lt: today },
            },
          },
        },
      });

      if (expiredAds.length > 0) {
        await prisma.ad.updateMany({
          where: { id: { in: expiredAds.map(a => a.id) } },
          data: { status: 'archived' },
        });
        debugLog(`[ad-lifecycle] Archived ${expiredAds.length} expired ads`);
      }

      // 3. Clean up stale holds (older than 1 hour since last status change)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const staleHoldAds = await prisma.ad.findMany({
        where: {
          payment_status: 'hold',
          updated_at: { lt: oneHourAgo },
        },
        select: { id: true },
      });
      if (staleHoldAds.length > 0) {
        const staleAdIds = staleHoldAds.map(a => a.id);
        // Idempotent: only update ads still in 'hold' status (prevents double-processing on retry)
        await prisma.$transaction([
          prisma.adReservation.deleteMany({ where: { ad_id: { in: staleAdIds } } }),
          prisma.ad.updateMany({
            where: { id: { in: staleAdIds }, payment_status: 'hold' },
            data: { payment_status: 'unpaid' },
          }),
        ]);
      }
      const staleHolds = { count: staleHoldAds.length };
      if (staleHolds.count > 0) {
        debugLog(`[ad-lifecycle] Released ${staleHolds.count} stale ad holds`);
      }

      // 4. Archive approved ads that were never paid (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const unpaidAds = await prisma.ad.findMany({
        where: {
          payment_status: 'unpaid',
          status: 'approved',
          updated_at: { lt: thirtyDaysAgo },
        },
        select: { id: true },
      });
      if (unpaidAds.length > 0) {
        const unpaidAdIds = unpaidAds.map(a => a.id);
        await prisma.$transaction([
          prisma.adReservation.deleteMany({ where: { ad_id: { in: unpaidAdIds } } }),
          prisma.ad.updateMany({
            where: { id: { in: unpaidAdIds } },
            data: { status: 'archived' },
          }),
        ]);
        debugLog(`[ad-lifecycle] Archived ${unpaidAds.length} unpaid approved ads (>30 days)`);
      }

      // 5. Clean up old ProcessedStripeEvent records (older than 30 days)
      const deletedEvents = await prisma.processedStripeEvent.deleteMany({
        where: { created_at: { lt: thirtyDaysAgo } },
      });
      if (deletedEvents.count > 0) {
        debugLog(`[ad-lifecycle] Cleaned up ${deletedEvents.count} old Stripe event dedup records`);
      }

      debugLog('[ad-lifecycle] Daily check complete ✅');
    } catch (error) {
      console.error('[ad-lifecycle] Check failed:', error);
    }
  });

  debugLog('✅ Ad lifecycle check started (runs daily at midnight)');
}
