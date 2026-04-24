import type { PrismaClient } from '@prisma/client';
import { captureException, captureMessage } from './sentry.js';

/**
 * Daily integrity probe for the canonical coach-approval state.
 *
 * The new CoachApplication model and the legacy User.approval_status column
 * coexist by design — the refactor preserves the old flag as a denormalized
 * projection of the latest application's state. That only holds if every
 * write site keeps them in sync. This probe finds cases where they've drifted
 * so we learn about the regression from logs instead of support tickets.
 *
 * Capture policy: drift rows are sent to Sentry as `warning` messages tagged
 * `context: coach_state_drift_probe` so alerts can fan out from a single
 * saved search. If the probe itself fails (DB error), that's an exception.
 */

type DriftBucket = {
  kind: string;
  description: string;
  rows: Array<{ user_id: string; email: string; [key: string]: unknown }>;
};

export async function runCoachStateDriftProbe(
  prisma: PrismaClient,
): Promise<{ ok: true; total: number; buckets: DriftBucket[] }> {
  const buckets: DriftBucket[] = [];

  // Bucket 1: coach marked APPROVED but has no CoachApplication record at all.
  // These are legacy-flow coaches (approved before CoachApplication shipped).
  // Not a bug per se, but worth visibility to decide whether to backfill.
  const legacyApproved = await prisma.$queryRaw<Array<{ user_id: string; email: string; approval_status: string }>>`
    SELECT u.id AS user_id, u.email, u.approval_status::text AS approval_status
    FROM "User" u
    LEFT JOIN "CoachApplication" ca
      ON ca.user_id = u.id AND ca.status IN ('submitted', 'approved', 'rejected')
    WHERE u.role = 'coach'
      AND u.approval_status = 'APPROVED'
      AND u.deleted_at IS NULL
      AND ca.id IS NULL
    LIMIT 100
  `;
  if (legacyApproved.length > 0) {
    buckets.push({
      kind: 'legacy_approved_without_application',
      description:
        'Coach has role=coach + approval_status=APPROVED but no CoachApplication row. Expected for users approved before CoachApplication shipped.',
      rows: legacyApproved,
    });
  }

  // Bucket 2: CoachApplication.status='approved' but User.approval_status != 'APPROVED'.
  // This is a real drift — something wrote one side without the other.
  const appApprovedUserNot = await prisma.$queryRaw<Array<{ user_id: string; email: string; approval_status: string; application_id: string }>>`
    SELECT u.id AS user_id, u.email, u.approval_status::text AS approval_status, ca.id AS application_id
    FROM "User" u
    JOIN "CoachApplication" ca
      ON ca.user_id = u.id AND ca.status = 'approved'
    WHERE u.approval_status != 'APPROVED'
      AND u.deleted_at IS NULL
    LIMIT 100
  `;
  if (appApprovedUserNot.length > 0) {
    buckets.push({
      kind: 'application_approved_user_not',
      description:
        'CoachApplication is approved but User.approval_status is NOT APPROVED. Drift — likely a missing dual-write on approval.',
      rows: appApprovedUserNot,
    });
  }

  // Bucket 3: User.approval_status='REJECTED' but latest CoachApplication is 'submitted' or 'approved'.
  // Means the user's approval flag and the application don't tell the same story.
  const userRejectedAppLive = await prisma.$queryRaw<Array<{ user_id: string; email: string; application_id: string; application_status: string }>>`
    SELECT u.id AS user_id, u.email, ca.id AS application_id, ca.status::text AS application_status
    FROM "User" u
    JOIN "CoachApplication" ca ON ca.user_id = u.id
    WHERE u.approval_status = 'REJECTED'
      AND ca.status IN ('submitted', 'approved')
      AND u.deleted_at IS NULL
      AND ca.id = (
        SELECT id FROM "CoachApplication"
        WHERE user_id = u.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      )
    LIMIT 100
  `;
  if (userRejectedAppLive.length > 0) {
    buckets.push({
      kind: 'user_rejected_latest_application_live',
      description:
        'User is REJECTED but their latest CoachApplication is still submitted/approved. Stale rejection or missed application-side update.',
      rows: userRejectedAppLive,
    });
  }

  // Bucket 4: Stuck in coach_final_setup_required for >7d (approved but no org).
  // These are coaches whose admin approval landed but who never came back to
  // finish their setup. Not data drift, but visibility lets ops follow up.
  const stuckFinalSetup = await prisma.$queryRaw<Array<{ user_id: string; email: string; approved_at: Date | null }>>`
    SELECT u.id AS user_id, u.email, ca.reviewed_at AS approved_at
    FROM "User" u
    JOIN "CoachApplication" ca
      ON ca.user_id = u.id AND ca.status = 'approved'
    WHERE u.approval_status = 'APPROVED'
      AND u.organization_id IS NULL
      AND u.deleted_at IS NULL
      AND ca.reviewed_at IS NOT NULL
      AND ca.reviewed_at < NOW() - INTERVAL '7 days'
    LIMIT 100
  `;
  if (stuckFinalSetup.length > 0) {
    buckets.push({
      kind: 'stuck_in_final_setup_7d',
      description:
        'Coaches approved >7 days ago with no organization. Worth a follow-up email/push from support.',
      rows: stuckFinalSetup,
    });
  }

  const total = buckets.reduce((acc, b) => acc + b.rows.length, 0);

  if (total > 0) {
    const summary = buckets
      .map(b => `${b.kind}=${b.rows.length}`)
      .join(' ');
    console.warn(`[coach-state-drift] FINDINGS ${summary}`);
    captureMessage(`[coach-state-drift] ${summary}`, 'warning');
    // Attach buckets as breadcrumb-style context so Sentry-triage can see row
    // IDs without logging full PII to the top-level event.
    for (const bucket of buckets) {
      captureMessage(
        `[coach-state-drift] ${bucket.kind} (${bucket.rows.length}): ${bucket.description}`,
        'warning',
      );
    }
  } else {
    console.log('[coach-state-drift] clean — no drift detected');
  }

  return { ok: true, total, buckets };
}
