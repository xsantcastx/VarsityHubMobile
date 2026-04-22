import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';

let prisma: any;
let runPostUpvoteReconciliation: (limit?: number) => Promise<{
  scanned: number;
  fixed: number;
  skipped: number;
}>;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Post upvote reconciliation', () => {
  const createdUserIds: string[] = [];
  let postId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ runPostUpvoteReconciliation } = await import('../lib/postUpvoteReconciliation.js'));

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const author = await prisma.user.create({
      data: {
        email: `post-reconcile-author-${Date.now()}@example.com`,
        password_hash: passwordHash,
        display_name: 'Post Reconcile Author',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
        preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
      },
    });
    const voterOne = await prisma.user.create({
      data: {
        email: `post-reconcile-voter-1-${Date.now()}@example.com`,
        password_hash: passwordHash,
        display_name: 'Post Reconcile Voter One',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
        preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
      },
    });
    const voterTwo = await prisma.user.create({
      data: {
        email: `post-reconcile-voter-2-${Date.now()}@example.com`,
        password_hash: passwordHash,
        display_name: 'Post Reconcile Voter Two',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
        preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
      },
    });

    createdUserIds.push(author.id, voterOne.id, voterTwo.id);

    const post = await prisma.post.create({
      data: {
        author_id: author.id,
        title: 'Reconcile me',
        content: 'Stored count will drift.',
        type: 'post',
        upvotes_count: 0,
      },
    });
    postId = post.id;

    await prisma.postUpvote.createMany({
      data: [
        { post_id: post.id, user_id: voterOne.id },
        { post_id: post.id, user_id: voterTwo.id },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdUserIds.length) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  it('repairs denormalized post counts from PostUpvote rows', async () => {
    await prisma.post.update({
      where: { id: postId },
      data: { upvotes_count: 0 },
    });

    const result = await runPostUpvoteReconciliation(25);
    const refreshed = await prisma.post.findUnique({
      where: { id: postId },
      select: { upvotes_count: true },
    });

    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(result.fixed).toBeGreaterThanOrEqual(1);
    expect(refreshed?.upvotes_count).toBe(2);
  });
});
