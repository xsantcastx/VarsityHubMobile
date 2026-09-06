import { releaseAdPurchaseHolds, releaseExpiredAdPurchaseHolds } from '../lib/adInventory.js';
import cron from 'node-cron';
import { debugLog } from '../lib/debugLog.js';
import { runStripeSubscriptionReconciliation } from '../lib/billingLifecycle.js';
import { runPostUpvoteReconciliation } from '../lib/postUpvoteReconciliation.js';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../jobs/queues.js';
import { captureException, captureMessage } from '../lib/sentry.js';
import { releaseExpiredPendingApprovalReservations } from '../lib/adReservationLifecycle.js';
import {
  hardDeleteAnonymizedUsers,
  ANONYMIZED_USER_RETENTION_DAYS_DEFAULT,
} from '../lib/accountDeletion.js';

export async function recoverSlotFullRefundReleaseFailures(referenceTime = new Date()) {
  const cutoff = new Date(referenceTime.getTime() - 60 * 60 * 1000);
  const candidates = await prisma.transactionLog.findMany({
    where: {
      transaction_type: 'AD_PURCHASE',
      status: 'NEEDS_REVIEW',
      order_id: { not: null },
      updated_at: { lt: cutoff },
    },
    orderBy: { updated_at: 'asc' },
    take: 200,
  });

  let recovered = 0;
  for (const tx of candidates) {
    const metadata = ((tx.metadata as Record<string, unknown> | null) || {}) as Record<
      string,
      unknown
    >;
    if (metadata.release_pending !== true) continue;
    if (!tx.order_id) continue;

    const reference = tx.stripe_session_id || tx.stripe_payment_intent_id;
    if (!reference) continue; // Legacy recovery needs an explicit purchase identity.
    await releaseAdPurchaseHolds(tx.order_id, reference);
    await prisma.transactionLog.update({
      where: { id: tx.id },
      data: {
        status: 'REFUNDED',
        metadata: {
          ...metadata,
          release_pending: false,
          release_recovered_at: new Date().toISOString(),
        },
      },
    });

    recovered += 1;
  }

  return recovered;
}

/**
 * Overnight monitoring task
 * Runs every 4 hours to check queue health and send alerts
 */
export function startOvernightMonitoring() {
  // Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    debugLog('[overnight] Running queue health check...');

    if (!emailQueue) {
      console.warn('[overnight] Email queue not initialized, skipping health check');
      return;
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        emailQueue.getWaitingCount(),
        emailQueue.getActiveCount(),
        emailQueue.getCompletedCount(),
        emailQueue.getFailedCount(),
      ]);

      console.log('[overnight] Queue status:', { waiting, active, completed, failed });

      // Alert if too many failures (lowered threshold: >5 to catch problems early)
      if (failed > 5) {
        console.error(`[overnight] HIGH FAILURE RATE: ${failed} failed jobs`);

        // Log first 5 failed jobs for debugging
        const failedJobs = await emailQueue.getFailed(0, 4);
        for (const job of failedJobs) {
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
      const delayedJobs = await emailQueue.getDelayed(0, 100);
      const stuckJobs = delayedJobs.filter(job => {
        const delay = job.opts?.delay || 0;
        const expectedTime = job.timestamp + (typeof delay === 'number' ? delay : 0);
        const now = Date.now();
        return now > expectedTime + 60 * 60 * 1000; // 1 hour past expected
      });

      if (stuckJobs.length > 0) {
        console.warn(`[overnight] ${stuckJobs.length} jobs stuck in delayed state`);
      }

      console.log('[overnight] Health check complete');
    } catch (error) {
      console.error('[overnight] Health check failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'overnight_health_check' },
      });
    }
  });

  console.log('Overnight monitoring started (runs every 4 hours)');
}

/**
 * Clean up old completed jobs
 * Runs daily at 3 AM to prevent queue bloat
 */
export function startQueueCleanup() {
  // Run daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    debugLog('[cleanup] Starting queue cleanup...');

    if (!emailQueue) {
      console.warn('[cleanup] Email queue not initialized, skipping cleanup');
      return;
    }

    try {
      // BullMQ clean(grace, limit, type): remove old completed/failed jobs
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      const [removedCompleted, removedFailed] = await Promise.all([
        emailQueue.clean(sevenDays, 1000, 'completed'),
        emailQueue.clean(thirtyDays, 1000, 'failed'),
      ]);

      console.log(
        `[cleanup] Removed ${removedCompleted.length} completed jobs, ${removedFailed.length} failed jobs`
      );
    } catch (error) {
      console.error('[cleanup] Cleanup failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'queue_cleanup' },
      });
    }
  });

  debugLog('Queue cleanup started (runs daily at 3 AM)');
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
            take: 1,
          },
        },
        take: 1000,
      });

      // Only notify if today is the FIRST reservation date (not a mid-run date)
      const firstDayAds = adsGoingLive.filter(ad => {
        const firstDate = ad.reservations[0]?.date;
        return firstDate && firstDate >= today && firstDate < tomorrow;
      });

      debugLog(`[ad-lifecycle] ${firstDayAds.length} ads starting today`);

      for (const ad of firstDayAds) {
        debugLog(
          `[ad-lifecycle] Go-live email removed; leaving ad ${ad.id} (${ad.business_name}) unmarked`
        );
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
        take: 1000,
      });

      if (expiredAds.length > 0) {
        await prisma.ad.updateMany({
          where: { id: { in: expiredAds.map(a => a.id) } },
          data: { status: 'archived' },
        });
        debugLog(`[ad-lifecycle] Archived ${expiredAds.length} expired ads`);
      }

      // Expire only the purchase's temporary rows; paid and ambiguous legacy dates survive.
      const staleHolds = await releaseExpiredAdPurchaseHolds();

      // 4. Release stale pending approvals that never progressed to checkout.
      const stalePendingApprovalCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const stalePendingApprovalAds = await prisma.ad.findMany({
        where: {
          status: 'pending',
          payment_status: 'pending_approval',
          updated_at: { lt: stalePendingApprovalCutoff },
        },
        select: { id: true },
        take: 1000,
      });
      if (stalePendingApprovalAds.length > 0) {
        const stalePendingApprovalIds = stalePendingApprovalAds.map(ad => ad.id);
        await prisma.$transaction(
          [
            prisma.adReservation.deleteMany({
              where: {
                ad_id: { in: stalePendingApprovalIds },
                ad: { status: 'pending', payment_status: 'pending_approval' },
              },
            }),
            prisma.ad.updateMany({
              where: {
                id: { in: stalePendingApprovalIds },
                status: 'pending',
                payment_status: 'pending_approval',
              },
              data: {
                status: 'draft',
                payment_status: 'unpaid',
                admin_note:
                  '[Auto] Ad approval request expired after 24 hours without payment. Re-submit to re-reserve dates.',
              },
            }),
          ],
          { isolationLevel: 'Serializable' }
        );
        debugLog(
          `[ad-lifecycle] Released ${stalePendingApprovalAds.length} stale pending approval ads (>24 hours)`
        );
      }

      // 5. Release expired dates from approved ads that are still awaiting payment.
      // Without this, an approved ad can keep past `pending_approval` reservations
      // forever, which makes the UI treat never-paid dates like completed runs.
      const expiredPendingApprovalReservations = await releaseExpiredPendingApprovalReservations(
        prisma,
        now
      );
      if (expiredPendingApprovalReservations.adsTouched > 0) {
        debugLog(
          `[ad-lifecycle] Released ${expiredPendingApprovalReservations.releasedDates} expired pending-approval reservation dates across ${expiredPendingApprovalReservations.adsTouched} ads`
        );
      }

      // 6. Recover refunded slot-full transactions whose inventory release failed after refund.
      const recoveredSlotFullReleaseFailures = await recoverSlotFullRefundReleaseFailures(now);
      if (recoveredSlotFullReleaseFailures > 0) {
        debugLog(
          `[ad-lifecycle] Recovered ${recoveredSlotFullReleaseFailures} refunded ad transactions with stuck inventory`
        );
      }

      // 7. Archive approved ads that were never paid (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const unpaidAds = await prisma.ad.findMany({
        where: {
          payment_status: 'unpaid',
          status: 'approved',
          updated_at: { lt: thirtyDaysAgo },
        },
        select: { id: true },
        take: 1000,
      });
      if (unpaidAds.length > 0) {
        const unpaidAdIds = unpaidAds.map(a => a.id);
        await prisma.$transaction(
          [
            prisma.adReservation.deleteMany({
              where: {
                ad_id: { in: unpaidAdIds },
                ad: { status: 'approved', payment_status: 'unpaid' },
              },
            }),
            prisma.ad.updateMany({
              where: { id: { in: unpaidAdIds }, status: 'approved', payment_status: 'unpaid' },
              data: { status: 'archived' },
            }),
          ],
          { isolationLevel: 'Serializable' }
        );
        debugLog(`[ad-lifecycle] Archived ${unpaidAds.length} unpaid approved ads (>30 days)`);
      }

      // 8. Clean up old ProcessedStripeEvent records (older than 30 days)
      const deletedEvents = await prisma.processedStripeEvent.deleteMany({
        where: { created_at: { lt: thirtyDaysAgo } },
      });
      if (deletedEvents.count > 0) {
        debugLog(`[ad-lifecycle] Cleaned up ${deletedEvents.count} old Stripe event dedup records`);
      }

      console.log(
        `[ad-lifecycle] Daily check complete ✅ ` +
          `expired_archived=${expiredAds.length} stale_holds=${staleHolds.count} ` +
          `stale_pending=${stalePendingApprovalAds.length} unpaid_archived=${unpaidAds.length} ` +
          `stripe_dedup_cleaned=${deletedEvents.count}`
      );
    } catch (error) {
      console.error('[ad-lifecycle] Check failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'ad_lifecycle_check' },
      });
    }
  });

  debugLog('✅ Ad lifecycle check started (runs daily at midnight)');
}

/**
 * Message cleanup — runs daily at 3:30 AM
 * Deletes messages older than 1 year to prevent unbounded table growth.
 * Direct messages between users are soft-deleted here; group chat messages follow the same rule.
 */
export function startMessageCleanup() {
  cron.schedule('30 3 * * *', async () => {
    debugLog('[message-cleanup] Starting old message cleanup...');
    try {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const deleted = await prisma.message.deleteMany({
        where: { created_at: { lt: oneYearAgo } },
      });
      if (deleted.count > 0) {
        console.log(`[message-cleanup] Deleted ${deleted.count} messages older than 1 year`);
      }
      console.log('[message-cleanup] Done ✅');
    } catch (error) {
      console.error('[message-cleanup] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'message_cleanup' },
      });
    }
  });
  debugLog('✅ Message cleanup started (runs daily at 3:30 AM)');
}

/**
 * Refresh token cleanup — runs daily at 3:45 AM.
 * Deletes RefreshToken rows whose expires_at is in the past. Expired tokens
 * are already rejected by the auth middleware, but leaving them in the table
 * causes unbounded growth and slows session lookups over time.
 */
export function startRefreshTokenCleanup() {
  cron.schedule('45 3 * * *', async () => {
    debugLog('[refresh-token-cleanup] Starting expired refresh token cleanup...');
    try {
      const deleted = await prisma.refreshToken.deleteMany({
        where: { expires_at: { lt: new Date() } },
      });
      if (deleted.count > 0) {
        console.log(`[refresh-token-cleanup] Deleted ${deleted.count} expired refresh tokens`);
      }
      console.log('[refresh-token-cleanup] Done ✅');
    } catch (error) {
      console.error('[refresh-token-cleanup] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'refresh_token_cleanup' },
      });
    }
  });
  debugLog('✅ Refresh token cleanup started (runs daily at 3:45 AM)');
}

/**
 * Notification cleanup — runs daily at 4:00 AM.
 * Deletes notifications older than NOTIFICATION_RETENTION_DAYS (default 90).
 * Prevents unbounded notification-table growth. Batches via Prisma's deleteMany
 * which is fine for Postgres; if the table grows past several million rows, a
 * chunked delete would be safer — revisit then.
 */
export function startNotificationCleanup() {
  cron.schedule('0 4 * * *', async () => {
    debugLog('[notification-cleanup] Starting old notification cleanup...');
    try {
      const retentionDays = Number(process.env.NOTIFICATION_RETENTION_DAYS) || 90;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const deleted = await prisma.notification.deleteMany({
        where: { created_at: { lt: cutoff } },
      });
      if (deleted.count > 0) {
        console.log(
          `[notification-cleanup] Deleted ${deleted.count} notifications older than ${retentionDays} days`
        );
      }
      console.log('[notification-cleanup] Done ✅');
    } catch (error) {
      console.error('[notification-cleanup] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'notification_cleanup' },
      });
    }
  });
  debugLog('✅ Notification cleanup started (runs daily at 4:00 AM)');
}

/**
 * Stripe subscription reconciliation — runs daily at 4:15 AM.
 * Webhooks are still the primary source of truth, but this catches drift from
 * dropped `customer.subscription.*` events and customer deletions.
 */
export function startStripeSubscriptionReconciliation() {
  cron.schedule('15 4 * * *', async () => {
    debugLog('[billing-reconcile] Starting nightly Stripe subscription reconciliation...');
    try {
      const result = await runStripeSubscriptionReconciliation();
      console.log(
        `[billing-reconcile] Done ✅ scanned=${result.scanned} updated=${result.updated} failed=${result.failed}`
      );

      // Alert policy (per the billing-cleanup design):
      //   - Per-fix drift lands in stdout (Railway logs) via runStripeSubscriptionReconciliation()
      //   - A summary Sentry event fires only when updated > threshold OR any failed.
      //     Silent on quiet nights; noisy when something real is moving.
      //   - `SUPPRESS_RECONCILIATION_ALERTS=1` silences the threshold alert for one deploy
      //     cycle — intended use: set on first-deploy so the baseline-cleanup burst doesn't
      //     wake anyone, then unset once Sentry noise returns to a real drift rate.
      const suppress = ['1', 'true', 'yes', 'on'].includes(
        String(process.env.SUPPRESS_RECONCILIATION_ALERTS || '').toLowerCase()
      );
      const threshold = Number(process.env.SUBSCRIPTION_RECONCILIATION_ALERT_THRESHOLD) || 10;
      if (!suppress && (result.updated > threshold || result.failed > 0)) {
        captureMessage(
          `Stripe reconciliation summary: updated=${result.updated}, failed=${result.failed}, scanned=${result.scanned}`,
          'warning',
          {
            extra: {
              context: 'stripe_subscription_reconciliation_summary',
              ...result,
            },
          }
        );
      }
    } catch (error) {
      console.error('[billing-reconcile] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'stripe_subscription_reconciliation_cron' },
      });
    }
  });
  debugLog('✅ Stripe subscription reconciliation started (runs daily at 4:15 AM)');
}

/**
 * Post upvote reconciliation — runs daily at 4:50 AM.
 * `Post.upvotes_count` is denormalized for feed ranking; this catches drift if
 * a write path ever misses the counter update.
 */
export function startPostUpvoteReconciliation() {
  cron.schedule('50 4 * * *', async () => {
    debugLog('[post-upvote-reconcile] Starting nightly post upvote reconciliation...');
    try {
      const result = await runPostUpvoteReconciliation();
      console.log(
        `[post-upvote-reconcile] Done ✅ scanned=${result.scanned} fixed=${result.fixed} skipped=${result.skipped}`
      );
    } catch (error) {
      console.error('[post-upvote-reconcile] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'post_upvote_reconciliation_cron' },
      });
    }
  });
  debugLog('✅ Post upvote reconciliation started (runs daily at 4:50 AM)');
}

/**
 * Parental consent auto-expiry — runs daily at 4:30 AM.
 *
 * Any user whose `parental_consent_requested_at` is older than 14 days and
 * still `pending` flips to `denied` + `banned=true`. Mirrors the COPPA
 * industry norm: if a parent hasn't approved within two weeks, treat it as
 * implicit deny. The minor can still contact support to reset.
 *
 * The hashed token is preserved so old email links can still render an
 * explicit expired page instead of collapsing to "invalid". Refresh tokens
 * are revoked to match `recordConsentDenial` semantics.
 */
export function startParentalConsentExpiry() {
  cron.schedule('30 4 * * *', async () => {
    debugLog('[consent-expiry] Starting parental consent auto-expiry sweep...');
    try {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      // Pull the expiring users first so we can revoke their refresh tokens
      // in the same sweep. A partial index supports the where clause.
      const expiring = await prisma.user.findMany({
        where: {
          parental_consent_status: 'pending',
          parental_consent_requested_at: { lt: cutoff },
        } as any,
        select: { id: true } as any,
        take: 500,
      });
      if (expiring.length === 0) {
        console.log('[consent-expiry] Nothing to do ✅');
        return;
      }
      const ids = (expiring as any[]).map(u => u.id);
      await prisma.$transaction([
        prisma.user.updateMany({
          where: { id: { in: ids } } as any,
          data: {
            parental_consent_status: 'denied',
            parental_consent_at: new Date(),
            banned: true,
            ban_reason: 'Parental consent not received within 14 days',
          } as any,
        }),
        prisma.refreshToken.deleteMany({ where: { user_id: { in: ids } } }),
      ]);
      console.log(
        `[consent-expiry] Auto-denied ${ids.length} accounts past the 14-day consent window`
      );
    } catch (error) {
      console.error('[consent-expiry] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'parental_consent_expiry_cron' },
      });
    }
  });
  debugLog('✅ Parental consent expiry started (runs daily at 4:30 AM)');
}

/**
 * Anonymized-user hard-delete purge — runs daily at 4:45 AM.
 *
 * Self-serve account deletion anonymizes PII immediately and stamps
 * `deleted_at` + `deletion_anonymized = true`. This cron finalizes the
 * erasure by hard-deleting rows older than the retention window (default
 * 30 days). The delay preserves referential integrity during any brief
 * dispute-reversal window and aligns with our privacy-policy disclosure.
 *
 * Selector is strict and fail-closed: only rows with both
 * `deletion_anonymized = true` AND `deleted_at < cutoff` are eligible.
 * Rows missing the anonymized flag are NEVER purged even if `deleted_at`
 * is ancient — anonymization is the operator-verified proof that PII was
 * actually stripped.
 *
 * Override the window via `ANONYMIZED_USER_RETENTION_DAYS` env var.
 *
 * Per-row failures (e.g. Prisma `Restrict` FK preventing purge of an admin
 * who actioned parental consent) are skipped with a count-only warn log;
 * user IDs are intentionally NOT logged to avoid keeping identifiers for
 * accounts that just completed right-to-be-forgotten.
 */
export function startAnonymizedUserPurge() {
  cron.schedule('45 4 * * *', async () => {
    debugLog('[anonymized-purge] Starting hard-delete sweep for anonymized users...');
    try {
      const retentionDays =
        Number(process.env.ANONYMIZED_USER_RETENTION_DAYS) ||
        ANONYMIZED_USER_RETENTION_DAYS_DEFAULT;
      const result = await hardDeleteAnonymizedUsers({ retentionDays });
      if (result.scanned > 0) {
        console.log(
          `[anonymized-purge] Done ✅ purged=${result.purged} skipped=${result.skipped} scanned=${result.scanned} retentionDays=${retentionDays}`
        );
      } else {
        console.log('[anonymized-purge] Nothing to do ✅');
      }
      // Surface skipped rows as a Sentry warning so we notice if the admin
      // accountability FK is producing a growing backlog of un-purgeable
      // accounts. Small counts are normal; a persistent nonzero run-over-run
      // signals a class of account we can't finalize.
      if (result.skipped > 0) {
        captureMessage(
          `anonymized-purge skipped ${result.skipped} of ${result.scanned} users (likely FK restrict)`,
          'warning',
          {
            extra: {
              context: 'anonymized_user_purge_skipped',
              purged: result.purged,
              skipped: result.skipped,
              scanned: result.scanned,
              retentionDays,
            },
          }
        );
      }
    } catch (error) {
      console.error('[anonymized-purge] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'anonymized_user_purge_cron' },
      });
    }
  });
  debugLog('✅ Anonymized user purge started (runs daily at 4:45 AM)');
}

/**
 * Run one pass of the data-export cleanup sweep. Exposed so tests can pin
 * the behavior (especially the stuck-build reaper) without faking the
 * node-cron scheduler.
 *
 * Two sweeps per call:
 *
 *   1. Expire ready archives past their TTL. Deletes the underlying
 *      object from storage and flips status='ready' → 'expired', clears
 *      storage_key + size_bytes. Row is kept as a metadata-only audit
 *      record (user can see "export X expired on date Y").
 *
 *   2. Reap stuck builds. A row still in 'building' two hours after
 *      started_at is effectively dead (worker crashed mid-build, process
 *      killed before status could flip to 'failed'). Mark as failed with
 *      error_category='stuck_build_reaped' so users can request a new one.
 *
 * Both sweeps are bounded — this is defensive cleanup, not bulk batch.
 */
export { runDataExportCleanupSweep } from '../lib/dataExport/cleanup.js';
import { runDataExportCleanupSweep } from '../lib/dataExport/cleanup.js';

/**
 * Data export cleanup — runs daily at 5:00 AM. Thin scheduler wrapper around
 * runDataExportCleanupSweep() so the sweep logic stays unit-testable.
 */
export function startDataExportCleanup() {
  cron.schedule('0 5 * * *', async () => {
    debugLog('[data-export-cleanup] Starting cleanup sweep...');
    try {
      const result = await runDataExportCleanupSweep();
      if (result.expiredCleaned > 0 || result.stuckReaped > 0 || result.storageDeleteFailed > 0) {
        console.log(
          `[data-export-cleanup] Done ✅ expired=${result.expiredCleaned} stuck_reaped=${result.stuckReaped} storage_delete_failed=${result.storageDeleteFailed}`
        );
      } else {
        console.log('[data-export-cleanup] Nothing to do ✅');
      }
    } catch (error) {
      console.error('[data-export-cleanup] Failed:', error);
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'data_export_cleanup_cron' },
      });
    }
  });
  debugLog('✅ Data export cleanup started (runs daily at 5:00 AM)');
}
