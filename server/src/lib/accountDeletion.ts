import { prisma } from './prisma.js';
import { captureException, captureMessage } from './sentry.js';
import { invalidateMeCacheForUser } from './userCache.js';

async function cleanupStripeBillingForDeletedUserLazy(params: {
  userId: string;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
}) {
  const { cleanupStripeBillingForDeletedUser } = await import('./billingLifecycle.js');
  return cleanupStripeBillingForDeletedUser(params);
}

/**
 * Retention for LEGACY anonymized accounts before hard-delete.
 *
 * Self-serve deletion no longer anonymizes — it hard-deletes immediately
 * (owner decision 2026-07-17: "EVERYTHING IS DELETED NO 30 DAYS"). This
 * constant now only governs the backstop cron, which sweeps two residual
 * classes of row:
 *
 *   1. The pre-2026-07-17 backlog of `deletion_anonymized = true` rows.
 *   2. The rare admin whose immediate hard-delete was blocked by the
 *      `ConsentAuditLog.actor_admin` Restrict FK and fell back to
 *      anonymization (see `softDeleteUserAccount`).
 *
 * Class 2 will keep being skipped by the cron for as long as the FK holds —
 * that is deliberate accountability, not a bug. Note: the privacy policy
 * separately discloses that residual backup copies are purged within 90 days —
 * that is a distinct, longer window for backup systems, not this cron.
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
  const maxPerRun = Math.max(1, options?.maxPerRun ?? HARD_DELETE_PURGE_MAX_PER_RUN);
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
  // Orgs owned via a membership row.
  const ownedOrgs = await prisma.organizationMembership.findMany({
    where: { user_id: userId, role: 'owner', status: 'active' },
    select: { organization_id: true },
    take: 100,
  });

  for (const { organization_id } of ownedOrgs) {
    // A successor must be another OWNER — a manager has no org-admin power under
    // the role-barrier model and cannot inherit the org.
    const otherOwners = await prisma.organizationMembership.count({
      where: {
        organization_id,
        role: 'owner',
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

  // Legacy owners recorded only via Organization.league_owner_id (no owner
  // membership row) — deleting them would orphan the org with no recoverable
  // owner. Block unless there is a distinct active owner membership.
  const legacyOwnedOrgs = await prisma.organization.findMany({
    where: { league_owner_id: userId },
    select: { id: true },
    take: 100,
  });
  for (const { id: organization_id } of legacyOwnedOrgs) {
    const otherOwners = await prisma.organizationMembership.count({
      where: { organization_id, role: 'owner', status: 'active', NOT: { user_id: userId } },
    });
    if (otherOwners === 0) {
      const err = new Error('SOLE_ORG_OWNER');
      (err as any).code = 'SOLE_ORG_OWNER';
      (err as any).organization_id = organization_id;
      throw err;
    }
  }

  // Teams: a sole owner leaving strands the team (no owner → uncapped
  // entitlements + bricked ownership transfer). Require another active owner.
  const ownedTeams = await prisma.teamMembership.findMany({
    where: { user_id: userId, role: 'owner', status: 'active' },
    select: { team_id: true },
    take: 200,
  });
  for (const { team_id } of ownedTeams) {
    const otherOwners = await prisma.teamMembership.count({
      where: { team_id, role: 'owner', status: 'active', NOT: { user_id: userId } },
    });
    if (otherOwners === 0) {
      const err = new Error('SOLE_TEAM_OWNER');
      (err as any).code = 'SOLE_TEAM_OWNER';
      (err as any).team_id = team_id;
      throw err;
    }
  }
}

/**
 * Rows the deleted user owns that must go regardless of which final path we
 * take (hard-delete or the FK-blocked anonymize fallback). Everything here is
 * `deleteMany` — idempotent, so re-running after a rolled-back transaction is
 * safe.
 *
 * Posts are deleted EXPLICITLY rather than left to the `Post.author` Cascade:
 * the fallback path never deletes the User row, and the owner's rule is that a
 * deleted account leaves no content behind on either path.
 */
async function purgeUserOwnedRows(tx: any, userId: string): Promise<void> {
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

  // Comments are onDelete:SetNull, so they survive orphaned unless we remove
  // them here; votes are cheap to purge.
  await tx.comment.deleteMany({ where: { author_id: userId } });
  await tx.pollVote.deleteMany({ where: { user_id: userId } });
  await tx.gameVote.deleteMany({ where: { user_id: userId } });
  await tx.post.deleteMany({ where: { author_id: userId } });

  // Ads, stories, and creator-owned events carry contact/location data that
  // must not survive erasure.
  await tx.ad.deleteMany({ where: { user_id: userId } });
  await tx.story.deleteMany({ where: { user_id: userId } });
  await tx.event.deleteMany({ where: { creator_id: userId } });
}

/**
 * True when Prisma refused a delete because a foreign key with
 * `onDelete: Restrict` still points at the row. On the User model the only
 * such FK is `ConsentAuditLog.actor_admin` — a platform admin who ever
 * actioned a parental-consent request cannot be hard-deleted, because that
 * would destroy the COPPA audit trail for OTHER users' consent decisions.
 */
function isRestrictedByForeignKey(err: unknown): boolean {
  return (err as any)?.code === 'P2003' || (err as any)?.code === 'P2014';
}

/**
 * Self-serve account deletion. Despite the legacy name, this is an IMMEDIATE
 * HARD DELETE (owner decision 2026-07-17: "EVERYTHING IS DELETED NO 30 DAYS").
 * There is no anonymization window and no "Deleted User" tombstone: the user's
 * content is deleted and the User row itself is removed.
 *
 * The one exception is the `ConsentAuditLog.actor_admin` Restrict FK described
 * on `isRestrictedByForeignKey`. When it blocks the row delete we still purge
 * ALL of the user's content and then anonymize the bare User row, logging +
 * alerting so it is visible rather than silent. Callers must run
 * `assertCanSelfDeleteUser` first — this function does not re-check ownership.
 */
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

  // Capture the stored media URLs the user will lose access to. We fetch
  // BEFORE the transaction because the transaction deletes the rows;
  // destroying the assets happens AFTER the DB is committed so a storage
  // hiccup cannot rollback the user's deletion.
  const [userAdsForCleanup, userStoriesForCleanup, userPostsForCleanup] = await Promise.all([
    // audit-allow unbounded: account deletion must enumerate all user-owned ads for cleanup
    prisma.ad.findMany({
      where: { user_id: userId },
      select: { id: true, banner_url: true },
    }),
    // audit-allow unbounded: account deletion must enumerate all user-owned stories for cleanup
    prisma.story.findMany({
      where: { user_id: userId },
      select: { id: true, media_url: true },
    }),
    // audit-allow unbounded: account deletion must enumerate all user-owned posts for cleanup
    prisma.post.findMany({
      // `deleted_at: undefined` is a no-op filter for Prisma, but naming the
      // key opts OUT of the soft-delete scope the client middleware would
      // otherwise inject (see applyPostSoftDeleteScope in lib/prisma.ts).
      // Without it this read is silently scoped to `deleted_at: null` and
      // misses posts the user already soft-deleted themselves — while the
      // deleteMany below still removes those rows, orphaning their media in
      // Cloudinary/R2 forever.
      where: { author_id: userId, deleted_at: undefined },
      select: { id: true, media_url: true, poster_url: true },
    }),
  ]);

  // Best-effort — a Stripe outage or transient 5xx must NOT block the user's
  // right to delete their account. The nightly reconciliation cron catches any
  // subscriptions that end up orphaned here (DB shows deleted, Stripe still
  // shows active → cron cancels + tombstones).
  try {
    await cleanupStripeBillingForDeletedUserLazy({
      userId,
      stripeCustomerId: existing.stripe_customer_id,
      subscriptionId: storedSubscriptionId,
    });
  } catch (stripeErr) {
    console.error(
      '[accountDeletion] Stripe billing cleanup failed; local deletion proceeds anyway:',
      (stripeErr as any)?.message || stripeErr
    );
    captureException(stripeErr instanceof Error ? stripeErr : new Error(String(stripeErr)), {
      extra: {
        context: 'account_deletion_stripe_cleanup_failed',
        userId,
        stripeCustomerId: existing.stripe_customer_id,
        subscriptionId: storedSubscriptionId,
      },
    });
  }

  try {
    await prisma.$transaction(async tx => {
      await purgeUserOwnedRows(tx, userId);
      // The row itself goes. No tombstone, no anonymization window — every
      // remaining User-owned row is `onDelete: Cascade` or `SetNull`, so this
      // finishes the erasure in one commit.
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (err) {
    if (!isRestrictedByForeignKey(err)) throw err;

    // A Restrict FK (ConsentAuditLog.actor_admin) pins this User row. The
    // transaction above rolled back, so re-run the content purge and then
    // anonymize the bare row. All of the user's CONTENT is still gone; only
    // the identity-stripped row remains, held by the COPPA audit trail.
    console.error(
      '[accountDeletion] Hard delete blocked by a Restrict FK; falling back to anonymize for user:',
      userId
    );
    captureMessage('Account hard-delete blocked by Restrict FK; anonymized instead', 'warning', {
      extra: {
        context: 'account_deletion_hard_delete_fk_restricted',
        userId,
        prismaCode: (err as any)?.code,
      },
    });

    await prisma.$transaction(async tx => {
      await purgeUserOwnedRows(tx, userId);
      // cache-invalidation-exempt: updateUserAndInvalidate() runs on the
      // top-level `prisma` client, so calling it here would drop this write out
      // of the surrounding $transaction and break the purge's atomicity. The
      // cache is invalidated immediately after the transaction commits, via
      // invalidateMeCacheForUser() below — which is also the correct ordering:
      // invalidating before the commit could repopulate the cache from a
      // concurrent read of the pre-delete row.
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
          // The overwrite to `{ deleted: true }` intentionally drops all stored preferences
          // including push_token. This is the correct behaviour — after deletion no device
          // should receive push notifications for this account. The key is explicitly not
          // preserved so any in-flight Expo delivery will fail silently once the token is gone.
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
  }

  await invalidateMeCacheForUser(userId).catch(err => {
    console.warn('[account-deletion] failed to invalidate deleted user cache', {
      user_id: userId,
      reason: (err as Error)?.message || String(err),
    });
  });

  // Destroy the user's stored media now that the DB state is committed.
  // Handles BOTH storage backends — Cloudinary assets and R2 objects (media
  // migrated to R2 2026-07; a Cloudinary-only sweep leaves R2 objects
  // publicly retrievable by URL forever). Mirrors the per-post teardown in
  // routes/posts.ts. Fire-and-forget: the DB is already committed, so a
  // storage failure must never fail or roll back the user's deletion — but it
  // IS logged and captured so orphaned objects are visible rather than silent.
  const mediaForCleanup: Array<{ kind: string; entityId: string; url: string | null }> = [
    ...userAdsForCleanup.map(a => ({ kind: 'ad', entityId: a.id, url: a.banner_url })),
    ...userStoriesForCleanup.map(s => ({ kind: 'story', entityId: s.id, url: s.media_url })),
    ...userPostsForCleanup.flatMap(p => [
      { kind: 'post', entityId: p.id, url: (p as any).media_url as string | null },
      { kind: 'post_poster', entityId: p.id, url: (p as any).poster_url as string | null },
    ]),
  ].filter(m => Boolean(m.url));

  if (mediaForCleanup.length > 0) {
    void (async () => {
      try {
        const [{ extractCloudinaryPublicId, destroyCloudinaryAsset }, { deleteR2ObjectByUrl }] =
          await Promise.all([import('./cloudinary.js'), import('./r2.js')]);
        for (const { kind, entityId, url } of mediaForCleanup) {
          if (!url) continue;
          try {
            const parsed = extractCloudinaryPublicId(url);
            if (parsed) {
              const result = await destroyCloudinaryAsset(parsed.publicId, parsed.resourceType);
              if (!result.ok) {
                console.warn(
                  `[accountDeletion] Cloudinary destroy failed for ${kind} ${entityId}:`,
                  result.error
                );
              }
              continue;
            }
            // Not a Cloudinary URL — try R2 (no-op if not an R2 URL).
            await deleteR2ObjectByUrl(url);
          } catch (err) {
            console.warn(
              `[accountDeletion] media destroy threw for ${kind} ${entityId}:`,
              (err as any)?.message || err
            );
          }
        }
      } catch (err) {
        console.error('[accountDeletion] media cleanup sweep threw:', err);
        captureException(err instanceof Error ? err : new Error(String(err)), {
          extra: { context: 'account_deletion_media_cleanup_failed', userId },
        });
      }
    })();
  }

  return { deletedAt, alreadyDeleted: false };
}
