#!/usr/bin/env npx tsx
/**
 * purge-legacy-anonymized-users.ts
 *
 * Owner decision 2026-07-17: "EVERYTHING IS DELETED NO 30 DAYS". Self-serve
 * deletion now hard-deletes immediately (see src/lib/accountDeletion.ts), but
 * accounts deleted BEFORE that change were only anonymized: their User row
 * still exists with `deletion_anonymized = true`, and their posts are still
 * live in feeds attributed to "Deleted User".
 *
 * This script clears that backlog. For every `deletion_anonymized = true` user
 * it deletes the user's content rows and the User row itself, then destroys
 * the associated media from BOTH storage backends (Cloudinary and R2) so the
 * objects stop being publicly retrievable by URL.
 *
 * Unlike the nightly `startAnonymizedUserPurge` cron, this ignores the
 * retention window entirely — that window no longer reflects policy.
 *
 * Rows pinned by the `ConsentAuditLog.actor_admin` Restrict FK (a platform
 * admin who actioned a parental-consent request) CANNOT be deleted without
 * destroying another user's COPPA audit trail. They are reported as `skipped`
 * and left alone. That is deliberate.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --apply.
 *   cd server
 *   npx tsx scripts/purge-legacy-anonymized-users.ts            # dry run
 *   npx tsx scripts/purge-legacy-anonymized-users.ts --apply
 */
import { destroyCloudinaryAsset, extractCloudinaryPublicId } from '../src/lib/cloudinary.js';
import { prisma } from '../src/lib/prisma.js';
import { deleteR2ObjectByUrl } from '../src/lib/r2.js';

const apply = process.argv.includes('--apply');
const TAG = '[legacy-anon-purge]';

type MediaRef = { kind: string; entityId: string; url: string };

async function collectMedia(userId: string): Promise<MediaRef[]> {
  const [ads, stories, posts] = await Promise.all([
    prisma.ad.findMany({ where: { user_id: userId }, select: { id: true, banner_url: true } }),
    prisma.story.findMany({ where: { user_id: userId }, select: { id: true, media_url: true } }),
    prisma.post.findMany({
      // Naming `deleted_at` opts out of the soft-delete scope the Prisma
      // middleware injects (applyPostSoftDeleteScope in src/lib/prisma.ts);
      // `undefined` keeps it a no-op filter. Legacy anonymized users had ALL
      // their posts soft-deleted, so without this the sweep sees zero posts
      // and leaves every media object orphaned.
      where: { author_id: userId, deleted_at: undefined },
      select: { id: true, media_url: true, poster_url: true },
    }),
  ]);

  const refs: Array<{ kind: string; entityId: string; url: string | null }> = [
    ...ads.map(a => ({ kind: 'ad', entityId: a.id, url: a.banner_url })),
    ...stories.map(s => ({ kind: 'story', entityId: s.id, url: s.media_url })),
    ...posts.flatMap(p => [
      { kind: 'post', entityId: p.id, url: (p as any).media_url as string | null },
      { kind: 'post_poster', entityId: p.id, url: (p as any).poster_url as string | null },
    ]),
  ];
  return refs.filter((r): r is MediaRef => Boolean(r.url));
}

async function destroyMedia(refs: MediaRef[]): Promise<{ destroyed: number; failed: number }> {
  let destroyed = 0;
  let failed = 0;
  for (const { kind, entityId, url } of refs) {
    try {
      const parsed = extractCloudinaryPublicId(url);
      if (parsed) {
        const result = await destroyCloudinaryAsset(parsed.publicId, parsed.resourceType);
        if (result.ok) destroyed += 1;
        else {
          failed += 1;
          console.warn(`${TAG} Cloudinary destroy failed for ${kind} ${entityId}:`, result.error);
        }
        continue;
      }
      await deleteR2ObjectByUrl(url);
      destroyed += 1;
    } catch (err) {
      failed += 1;
      console.warn(`${TAG} media destroy threw for ${kind} ${entityId}:`, (err as any)?.message);
    }
  }
  return { destroyed, failed };
}

async function main() {
  const candidates = await prisma.user.findMany({
    where: { deletion_anonymized: true } as any,
    select: { id: true, deleted_at: true },
    take: 10000,
    orderBy: { deleted_at: 'asc' },
  });

  console.log(
    `${TAG} ${apply ? 'APPLY' : 'DRY RUN'} — found ${candidates.length} anonymized user(s).`
  );
  if (candidates.length === 0) return;

  let purged = 0;
  let skipped = 0;
  let mediaDestroyed = 0;
  let mediaFailed = 0;
  let plannedPosts = 0;
  let plannedComments = 0;
  let plannedMedia = 0;

  for (const { id, deleted_at } of candidates) {
    const media = await collectMedia(id);

    if (!apply) {
      const [postCount, commentCount] = await Promise.all([
        // `deleted_at: undefined` — see collectMedia. `count` is scoped by the
        // same middleware, so without it the dry run reports 0 posts for
        // exactly the legacy rows this script exists to clean up.
        prisma.post.count({ where: { author_id: id, deleted_at: undefined } }),
        prisma.comment.count({ where: { author_id: id } }),
      ]);
      plannedPosts += postCount;
      plannedComments += commentCount;
      plannedMedia += media.length;
      console.log(
        `${TAG} would purge user ${id} (anonymized ${deleted_at?.toISOString() ?? 'unknown'}) — ` +
          `${postCount} post(s), ${commentCount} comment(s), ${media.length} media object(s)`
      );
      continue;
    }

    try {
      await prisma.$transaction(async tx => {
        await tx.postUpvote.deleteMany({ where: { user_id: id } });
        await tx.postBookmark.deleteMany({ where: { user_id: id } });
        await tx.follows.deleteMany({
          where: { OR: [{ follower_id: id }, { following_id: id }] },
        });
        await tx.blockedUser.deleteMany({
          where: { OR: [{ blocker_id: id }, { blocked_id: id }] },
        });
        await tx.notification.deleteMany({ where: { OR: [{ user_id: id }, { actor_id: id }] } });
        await tx.teamMembership.deleteMany({ where: { user_id: id } });
        await tx.organizationMembership.deleteMany({ where: { user_id: id } });
        await tx.organizationJoinRequest.deleteMany({ where: { user_id: id } });
        await tx.refreshToken.deleteMany({ where: { user_id: id } });
        await tx.comment.deleteMany({ where: { author_id: id } });
        await tx.pollVote.deleteMany({ where: { user_id: id } });
        await tx.gameVote.deleteMany({ where: { user_id: id } });
        await tx.post.deleteMany({ where: { author_id: id } });
        await tx.ad.deleteMany({ where: { user_id: id } });
        await tx.story.deleteMany({ where: { user_id: id } });
        await tx.event.deleteMany({ where: { creator_id: id } });
        await tx.user.delete({ where: { id } });
      });
      purged += 1;
    } catch (err) {
      // Most common cause: the ConsentAuditLog.actor_admin Restrict FK.
      skipped += 1;
      console.warn(
        `${TAG} skipped user (id suppressed):`,
        (err as any)?.code || (err as any)?.message
      );
      continue;
    }

    // Only tear down media once the DB row is actually gone.
    const result = await destroyMedia(media);
    mediaDestroyed += result.destroyed;
    mediaFailed += result.failed;
  }

  if (!apply) {
    console.log(
      `${TAG} DRY RUN summary — ${candidates.length} user(s), ${plannedPosts} post(s), ` +
        `${plannedComments} comment(s), ${plannedMedia} media object(s) would be destroyed.`
    );
    console.log(`${TAG} Re-run with --apply to write.`);
    return;
  }

  console.log(
    `${TAG} done: purged=${purged} skipped=${skipped} ` +
      `media_destroyed=${mediaDestroyed} media_failed=${mediaFailed}`
  );
}

main()
  .catch(err => {
    console.error(`${TAG} failed:`, err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
