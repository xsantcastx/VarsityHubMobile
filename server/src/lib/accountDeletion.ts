import { prisma } from './prisma.js';
import { invalidateMeCacheForUser } from './userCache.js';
import { cleanupStripeBillingForDeletedUser } from './billingLifecycle.js';
import { captureException } from './sentry.js';

/**
 * Default retention for anonymized accounts before hard-delete. The soft-delete
 * / anonymize pass runs at self-serve time; the nightly cron picks up rows
 * whose `deleted_at` is older than this window. 30 days gives us a
 * dispute-reversal buffer and matches our privacy-policy disclosure.
 */
export const ANONYMIZED_USER_RETENTION_DAYS_DEFAULT = 30;

/**
 * Per-run cap. Keeps a single cron invocation from blocking the DB for an
 * unbounded time on first rollout when there might be a large backlog. The
 * next run picks up whatever didn't fit.
 */
const HARD_DELETE_PURGE_MAX_PER_RUN = 100;

/**
 * Hard-delete users whose account has been soft-deleted + anonymized for
 * longer than the retention window. Selector is strict and fail-closed:
 *
 *   deletion_anonymized = true
 *   AND deleted_at IS NOT NULL
 *   AND deleted_at < (now - retentionDays)
 *
 * Soft-deleted rows with `deletion_anonymized = false` are NEVER purged —
 * anonymization is the operator-verified proof that PII has been stripped.
 *
 * Per-row failures (e.g. the Prisma `Restrict` onDelete on
 * `ConsentAuditLog.actor_admin` preventing purge of an admin who ever
 * actioned parental consent) are caught, counted as `skipped`, and logged
 * at warn level without surfacing the user row's ID to stdout — we log
 * counts only so Railway doesn't accumulate identifiers for accounts that
 * just finished a right-to-be-forgotten request.
 *
 * Returns raw counts only. Callers (the cron) decide on Sentry alerts.
 */
export async function hardDeleteAnonymizedUsers(options?: {
  retentionDays?: number;
  maxPerRun?: number;
}): Promise<{ purged: number; skipped: number; scanned: number }> {
  const retentionDays = Math.max(
    1,
    options?.retentionDays ?? ANONYMIZED_USER_RETENTION_DAYS_DEFAULT
  );
  const maxPerRun = Math.max(
    1,
    options?.maxPerRun ?? HARD_DELETE_PURGE_MAX_PER_RUN
  );
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      deletion_anonymized: true,
      deleted_at: { not: null, lt: cutoff },
    } as any,
    select: { id: true },
    take: maxPerRun,
    orderBy: { deleted_at: 'asc' }, // oldest first — longest waiting
  });

  if (candidates.length === 0) {
    return { purged: 0, skipped: 0, scanned: 0 };
  }

  let purged = 0;
  let skipped = 0;

  for (const { id } of candidates) {
    try {
      await prisma.user.delete({ where: { id } });
      purged += 1;
    } catch (err) {
      // Most common cause: `Restrict` FK on ConsentAuditLog.actor_admin
      // preventing purge of an admin who ever actioned a parental consent.
      // That's correct accountability — skip without failing the whole run.
      skipped += 1;
      // Intentionally do NOT log the user ID. Counts only.
      console.warn(
        '[anonymized-purge] Skipped hard-delete due to FK or runtime error (id suppressed):',
        (err as any)?.code || (err as any)?.message || 'unknown'
      );
    }
  }

  return { purged, skipped, scanned: candidates.length };
}

function buildDeletedEmail(userId: string): string {
  return `deleted+${userId}@deleted.varsityhub.invalid`;
}

function buildDeletedUsername(userId: string): string {
  return `deleted-${userId.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`.slice(0, 20);
}

export async function assertCanSelfDeleteUser(userId: string): Promise<void> {
  const ownedOrgs = await prisma.organizationMembership.findMany({
    where: { user_id: userId, role: 'owner', status: 'active' },
    select: { organization_id: true },
    take: 100,
  });

  for (const { organization_id } of ownedOrgs) {
    const otherOwners = await prisma.organizationMembership.count({
      where: {
        organization_id,
        role: { in: ['owner', 'manager'] },
        status: 'active',
        NOT: { user_id: userId },
      },
    });
    if (otherOwners === 0) {
      const err = new Error('SOLE_ORG_OWNER');
      (err as any).code = 'SOLE_ORG_OWNER';
      (err as any).organization_id = organization_id;
      throw err;
    }
  }
}

export async function softDeleteUserAccount(userId: string): Promise<{
  deletedAt: Date;
  alreadyDeleted: boolean;
}> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      deleted_at: true,
      deletion_anonymized: true,
      stripe_customer_id: true,
      preferences: true,
    },
  });

  if (!existing) {
    const err = new Error('USER_NOT_FOUND');
    (err as any).code = 'USER_NOT_FOUND';
    throw err;
  }

  if (existing.deleted_at || existing.deletion_anonymized) {
    return {
      deletedAt: existing.deleted_at ?? new Date(),
      alreadyDeleted: true,
    };
  }

  const deletedAt = new Date();
  const storedSubscriptionId =
    existing.preferences &&
    typeof existing.preferences === 'object' &&
    !Array.isArray(existing.preferences) &&
    typeof (existing.preferences as Record<string, unknown>).subscription_id === 'string'
      ? String((existing.preferences as Record<string, unknown>).subscription_id)
      : null;

  // Capture Cloudinary-hosted media URLs the user will lose access to. We
  // fetch BEFORE the transaction because the transaction deletes the rows;
  // destroying the assets happens AFTER the DB is committed so a Cloudinary
  // hiccup cannot rollback the user's deletion.
  const [userAdsForCleanup, userStoriesForCleanup] = await Promise.all([
    prisma.ad.findMany({
      where: { user_id: userId },
      select: { id: true, banner_url: true },
    }),
    prisma.story.findMany({
      where: { user_id: userId },
      select: { id: true, media_url: true },
    }),
  ]);

  // Best-effort — a Stripe outage or transient 5xx must NOT block the user's
  // right to delete their account. The nightly reconciliation cron catches any
  // subscriptions that end up orphaned here (DB shows deleted, Stripe still
  // shows active → cron cancels + tombstones).
  try {
    await cleanupStripeBillingForDeletedUser({
      userId,
      stripeCustomerId: existing.stripe_customer_id,
      subscriptionId: storedSubscriptionId,
    });
  } catch (stripeErr) {
    console.error(
      '[accountDeletion] Stripe billing cleanup failed; local deletion proceeds anyway:',
      (stripeErr as any)?.message || stripeErr
    );
    captureException(
      stripeErr instanceof Error ? stripeErr : new Error(String(stripeErr)),
      {
        extra: {
          context: 'account_deletion_stripe_cleanup_failed',
          userId,
          stripeCustomerId: existing.stripe_customer_id,
          subscriptionId: storedSubscriptionId,
        },
      }
    );
  }

  await prisma.$transaction(async tx => {
    await tx.postUpvote.deleteMany({ where: { user_id: userId } });
    await tx.postBookmark.deleteMany({ where: { user_id: userId } });
    await tx.follows.deleteMany({
      where: {
        OR: [{ follower_id: userId }, { following_id: userId }],
      },
    });
    await tx.blockedUser.deleteMany({
      where: {
        OR: [{ blocker_id: userId }, { blocked_id: userId }],
      },
    });
    await tx.notification.deleteMany({
      where: {
        OR: [{ user_id: userId }, { actor_id: userId }],
      },
    });
    await tx.teamMembership.deleteMany({ where: { user_id: userId } });
    await tx.organizationMembership.deleteMany({ where: { user_id: userId } });
    await tx.organizationJoinRequest.deleteMany({ where: { user_id: userId } });
    await tx.refreshToken.deleteMany({ where: { user_id: userId } });

    // Ads, stories, and creator-owned events carry contact/location data that
    // should not survive self-serve erasure.
    await tx.ad.deleteMany({ where: { user_id: userId } });
    await tx.story.deleteMany({ where: { user_id: userId } });
    await tx.event.deleteMany({ where: { creator_id: userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: buildDeletedEmail(userId),
        display_name: 'Deleted User',
        username: buildDeletedUsername(userId),
        avatar_url: null,
        bio: null,
        password_hash: null,
        google_id: null,
        apple_id: null,
        email_verified: false,
        email_verification_code: null,
        email_verification_expires: null,
        password_reset_code: null,
        password_reset_expires: null,
        password_changed_at: deletedAt,
        stripe_customer_id: null,
        preferences: { deleted: true } as any,
        date_of_birth: null,
        dob_set_at: null,
        parent_email: null,
        parental_consent_status: 'not_required',
        parental_consent_at: null,
        banned: true,
        banned_until: null,
        ban_reason: 'Account deleted by user',
        deleted_at: deletedAt,
        deletion_anonymized: true,
        approval_status: 'REJECTED',
        rejected_at: deletedAt,
        rejection_reason: 'Account deleted by user',
      },
    });
  });

  await invalidateMeCacheForUser(userId).catch(() => {});

  // Destroy the user's Cloudinary-hosted ad banners and story media now that
  // the DB state is committed. Fire-and-forget — if Cloudinary fails, the
  // reconciliation cron (via generic orphan sweep, future work) or a one-off
  // cleanup script can pick up the stragglers.
  if (userAdsForCleanup.length > 0 || userStoriesForCleanup.length > 0) {
    void (async () => {
      try {
        const { extractCloudinaryPublicId, destroyCloudinaryAsset } = await import(
          './cloudinary.js'
        );
        const urls: Array<{ kind: string; entityId: string; url: string | null }> = [
          ...userAdsForCleanup.map(a => ({ kind: 'ad', entityId: a.id, url: a.banner_url })),
          ...userStoriesForCleanup.map(s => ({ kind: 'story', entityId: s.id, url: s.media_url })),
        ];
        for (const { kind, entityId, url } of urls) {
          if (!url) continue;
          const parsed = extractCloudinaryPublicId(url);
          if (!parsed) continue;
          destroyCloudinaryAsset(parsed.publicId, parsed.resourceType).catch(err =>
            console.warn(
              `[accountDeletion] Cloudinary destroy failed for ${kind} ${entityId}:`,
              err?.message || err
            )
          );
        }
      } catch (err) {
        console.warn('[accountDeletion] Cloudinary cleanup sweep threw:', err);
      }
    })();
  }

  return { deletedAt, alreadyDeleted: false };
}
