/**
 * Notes 7/15 #3 + owner decision 2026-07-17 ("EVERYTHING IS DELETED NO 30
 * DAYS") — deleting an account must remove the user's social content AND the
 * user row itself, immediately. There is no anonymization window and no
 * "Deleted User" tombstone on the normal path. Comments are onDelete:SetNull
 * so they would otherwise linger orphaned; posts are hard-deleted explicitly
 * rather than left to the Post.author Cascade so the FK-restricted fallback
 * path removes them too.
 */
import { beforeAll, describe, expect, it } from '@jest/globals';
import { describeDb } from './helpers/dbTestSuite.js';
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'lib', 'accountDeletion.ts'), 'utf8');

describe('softDeleteUserAccount content cascade', () => {
  it('deletes the user comments (SetNull would orphan them)', () => {
    expect(src).toMatch(/tx\.comment\.deleteMany\(\{ where: \{ author_id: userId \} \}\)/);
  });
  it('purges poll and game votes', () => {
    expect(src).toMatch(/tx\.pollVote\.deleteMany/);
    expect(src).toMatch(/tx\.gameVote\.deleteMany/);
  });
  it('hard-deletes the user posts — never soft-deletes them', () => {
    expect(src).toMatch(/tx\.post\.deleteMany\(\{ where: \{ author_id: userId \} \}\)/);
    expect(src).not.toMatch(/tx\.post\.updateMany\(/);
  });
  it('runs the cascade inside the deletion transaction, before the row goes', () => {
    const txStart = src.indexOf('prisma.$transaction');
    const purgeCall = src.indexOf('await purgeUserOwnedRows(tx, userId)');
    const userDelete = src.indexOf('tx.user.delete({ where: { id: userId } })');
    expect(txStart).toBeGreaterThan(-1);
    expect(purgeCall).toBeGreaterThan(txStart);
    expect(purgeCall).toBeLessThan(userDelete);
  });
});

describe('softDeleteUserAccount leaves no tombstone', () => {
  it('hard-deletes the user row on the normal path', () => {
    expect(src).toMatch(/tx\.user\.delete\(\{ where: \{ id: userId \} \}\)/);
  });

  it('only ever writes a "Deleted User" tombstone on the FK-restricted fallback', () => {
    // The single remaining tombstone write must sit inside the
    // isRestrictedByForeignKey branch — i.e. after the catch that guards it.
    const guard = src.indexOf('if (!isRestrictedByForeignKey(err)) throw err;');
    const tombstone = src.indexOf("display_name: 'Deleted User'");
    expect(guard).toBeGreaterThan(-1);
    expect(tombstone).toBeGreaterThan(guard);

    // And there must be exactly one such write — no second anonymize path.
    const tombstoneWrites = src.match(/display_name: 'Deleted User'/g) ?? [];
    expect(tombstoneWrites).toHaveLength(1);
  });

  it('surfaces the fallback rather than silently anonymizing', () => {
    expect(src).toMatch(/\[accountDeletion\] Hard delete blocked by a Restrict FK/);
    expect(src).toMatch(/account_deletion_hard_delete_fk_restricted/);
  });
});

describe('softDeleteUserAccount media teardown', () => {
  it('pre-fetches post media_url AND poster_url before the transaction', () => {
    expect(src).toMatch(/select: \{ id: true, media_url: true, poster_url: true \}/);
    const prefetch = src.indexOf('userPostsForCleanup');
    const txStart = src.indexOf('prisma.$transaction');
    expect(prefetch).toBeGreaterThan(-1);
    expect(prefetch).toBeLessThan(txStart);
  });

  it('opts the post pre-fetch out of the soft-delete read scope', () => {
    // applyPostSoftDeleteScope (lib/prisma.ts) silently injects
    // `deleted_at: null` into any Post read whose where-clause does not name
    // `deleted_at`. A bare `{ author_id: userId }` pre-fetch would therefore
    // skip posts the user already soft-deleted — while post.deleteMany (a
    // write, unscoped) still removes them, orphaning their media forever.
    expect(src).toMatch(/where: \{ author_id: userId, deleted_at: undefined \}/);
  });

  it('tears media down from BOTH Cloudinary and R2', () => {
    expect(src).toMatch(/destroyCloudinaryAsset/);
    expect(src).toMatch(/deleteR2ObjectByUrl/);
  });

  it('captures a failed teardown sweep to Sentry with a [context] prefix', () => {
    expect(src).toMatch(/\[accountDeletion\] media cleanup sweep threw/);
    expect(src).toMatch(/account_deletion_media_cleanup_failed/);
  });
});

/**
 * The behavioural proof, against a real DB: after a self-deletion there is no
 * user row, no "Deleted User" tombstone, and no surviving post. The
 * source-level assertions above pin HOW; this pins THAT.
 */
describeDb('self-deletion leaves nothing behind (integration)', () => {
  let prisma: any;
  let softDeleteUserAccount: (userId: string) => Promise<{ deletedAt: Date }>;
  let userId: string;
  let postId: string;

  const ts = Date.now();

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ softDeleteUserAccount } = await import('../lib/accountDeletion.js'));

    const user = await prisma.user.create({
      data: {
        email: `selfdelete-${ts}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Soon Gone',
        username: `soongone${ts}`.slice(0, 20),
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;

    const post = await prisma.post.create({
      data: { author_id: userId, content: 'this must not survive', type: 'post' },
    });
    postId = post.id;
  });

  it('removes the user row entirely — no anonymized tombstone', async () => {
    await softDeleteUserAccount(userId);

    const row = await prisma.user.findUnique({ where: { id: userId } });
    expect(row).toBeNull();
  });

  it('removes the user posts rather than soft-deleting them', async () => {
    // Bypass the soft-delete-hiding Prisma middleware: a row that was merely
    // soft-deleted would still be found by a raw count, and must not be.
    const [{ count }] = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS count FROM "Post" WHERE id = $1',
      postId
    );
    expect(count).toBe(0);
  });

  it('leaves no "Deleted User" row for this account', async () => {
    const tombstones = await prisma.user.findMany({
      where: { display_name: 'Deleted User', email: { contains: `+${userId}@` } },
      select: { id: true },
      take: 5,
    });
    expect(tombstones).toHaveLength(0);
  });
});

describe('RSVP email date rendering', () => {
  const email = readFileSync(join(process.cwd(), 'src', 'lib', 'email.ts'), 'utf8');
  it('passes a timezone-aware event_date_display via formatEventTime', () => {
    expect(email).toMatch(
      /event_date_display: formatEventTime\(params\.eventDate, params\.timezone\)/
    );
  });
});
