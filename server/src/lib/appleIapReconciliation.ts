/**
 * Apple IAP reconciliation probe.
 *
 * Apple's App Store Server API (which would let us poll for missed
 * transactions in a Stripe-style reconciliation) requires a JWT signed
 * with our P8 private key + APPLE_KEY_ID + APPLE_ISSUER_ID. Those are
 * NOT currently configured. So this probe works with local data only,
 * leveraging the existing TransactionLog + Apple S2S notification dedup.
 *
 * Two probes, both alert via Sentry:
 *
 *   PROBE A — stuck PENDING IAP transactions:
 *     IAP rows with apple_transaction_id set but status='PENDING' for
 *     longer than the threshold are likely orphans where the receipt
 *     was verified client-side but server finalization never completed.
 *
 *   PROBE B — Apple S2S notifications missing entirely:
 *     If we have not received any APPLE_S2S_NOTIFICATION rows in the
 *     last 24h, the webhook URL configured in App Store Connect is
 *     likely broken (wrong URL, expired cert, etc.). This catches the
 *     "all Apple webhooks silently failing" case before it metastasizes.
 *
 * KNOWN GAP this probe does NOT close:
 *   "Apple charged the user, S2S notification never arrived AND client
 *    never called /payments/apple/verify-ad-receipt." That orphan has
 *    no local evidence at all and requires the App Store Server API to
 *    detect. Document this for the operator; ship the App Store Server
 *    API integration separately when APPLE_KEY_ID is provisioned.
 */

import { prisma } from './prisma.js';
import { captureMessage } from './sentry.js';

const PENDING_STALE_THRESHOLD_MIN = 30;
const NOTIFICATION_DRYSPELL_HOURS = 24;
const STUCK_ROW_REPORT_LIMIT = 50;

export type AppleIapReconciliationResult = {
  stuckPending: number;
  s2sNotificationsLast24h: number;
  notificationDrySpell: boolean;
  durationMs: number;
};

export async function reconcileAppleIapOrphans(): Promise<AppleIapReconciliationResult> {
  const startedAt = Date.now();
  const pendingCutoff = new Date(Date.now() - PENDING_STALE_THRESHOLD_MIN * 60 * 1000);
  const dryspellCutoff = new Date(Date.now() - NOTIFICATION_DRYSPELL_HOURS * 60 * 60 * 1000);

  // PROBE A — IAP transactions stuck PENDING past the threshold.
  // Excludes APPLE_S2S_NOTIFICATION rows (those are dedup markers, not
  // user-facing purchases — they live in PENDING/RECEIVED state by design).
  const stuck = await prisma.transactionLog.findMany({
    where: {
      apple_transaction_id: { not: null },
      status: 'PENDING',
      created_at: { lt: pendingCutoff },
      transaction_type: { not: 'APPLE_S2S_NOTIFICATION' },
    },
    select: {
      id: true,
      apple_transaction_id: true,
      transaction_type: true,
      user_id: true,
      user_email: true,
      total_cents: true,
      created_at: true,
      order_id: true,
    },
    orderBy: { created_at: 'asc' },
    take: STUCK_ROW_REPORT_LIMIT,
  });

  for (const row of stuck) {
    const ageMin = Math.round((Date.now() - row.created_at.getTime()) / 60000);
    captureMessage(
      'Apple IAP transaction stuck PENDING — likely orphaned finalization',
      'error',
      {
        context: 'apple_iap_reconciliation_stuck_pending',
        transaction_log_id: row.id,
        apple_transaction_id: row.apple_transaction_id,
        transaction_type: row.transaction_type,
        user_id: row.user_id,
        user_email: row.user_email,
        total_cents: row.total_cents,
        order_id: row.order_id,
        age_minutes: ageMin,
      }
    );
    console.error(
      `[apple-iap-reconcile] STUCK ${row.transaction_type} txlog=${row.id} apple_tx=${row.apple_transaction_id} age=${ageMin}min`
    );
  }

  // PROBE B — Apple S2S notification dry-spell.
  // If we have NOT received any S2S notifications in the last 24h, the
  // webhook config is likely broken in App Store Connect.
  const s2sCount = await prisma.transactionLog.count({
    where: {
      transaction_type: 'APPLE_S2S_NOTIFICATION',
      created_at: { gte: dryspellCutoff },
    },
  });

  const notificationDrySpell = s2sCount === 0;
  if (notificationDrySpell) {
    captureMessage(
      `No Apple S2S notifications received in last ${NOTIFICATION_DRYSPELL_HOURS}h — webhook URL may be misconfigured`,
      'error',
      {
        context: 'apple_iap_reconciliation_notification_dryspell',
        lookback_hours: NOTIFICATION_DRYSPELL_HOURS,
        notifications_seen: s2sCount,
      }
    );
    console.error(
      `[apple-iap-reconcile] DRYSPELL no APPLE_S2S_NOTIFICATION rows in last ${NOTIFICATION_DRYSPELL_HOURS}h — check App Store Connect webhook URL`
    );
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[apple-iap-reconcile] stuck_pending=${stuck.length} s2s_24h=${s2sCount} dryspell=${notificationDrySpell} duration_ms=${durationMs}`
  );

  return {
    stuckPending: stuck.length,
    s2sNotificationsLast24h: s2sCount,
    notificationDrySpell,
    durationMs,
  };
}
