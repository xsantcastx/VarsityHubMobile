import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { describeDb } from './helpers/dbTestSuite.js';
import { randomUUID } from 'node:crypto';

let prisma: any;

describeDb('Post soft-delete Prisma scope', () => {
  let userId: string;
  let activePostId: string;
  let deletedPostId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    userId = randomUUID();
    await prisma.$executeRaw`
			INSERT INTO "User" (
				"id",
				"email",
				"password_hash",
				"display_name",
				"email_verified",
				"preferences",
				"created_at"
			) VALUES (
				${userId},
				${`soft-delete-scope-${Date.now()}@example.com`},
				${'test-hash'},
				${'Soft Delete Scope User'},
				${true},
				${JSON.stringify({ role: 'fan', onboarding_completed: true })}::jsonb,
				NOW()
			)
		`;

    const activePost = await prisma.post.create({
      data: {
        author_id: userId,
        title: 'Active post',
        content: 'Still visible',
        type: 'post',
      },
    });
    activePostId = activePost.id;

    const deletedPost = await prisma.post.create({
      data: {
        author_id: userId,
        title: 'Deleted post',
        content: 'Should be scoped out',
        type: 'post',
        deleted_at: new Date(),
      },
    });
    deletedPostId = deletedPost.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.$executeRaw`DELETE FROM "User" WHERE "id" = ${userId}`.catch(() => {});
    }
  });

  it('excludes soft-deleted posts from default reads', async () => {
    const active = await prisma.post.findUnique({ where: { id: activePostId } });
    const deleted = await prisma.post.findUnique({ where: { id: deletedPostId } });
    const count = await prisma.post.count({ where: { author_id: userId } });

    expect(active?.id).toBe(activePostId);
    expect(deleted).toBeNull();
    expect(count).toBe(1);
  });

  it('allows explicit deleted_at filters to reach deleted rows', async () => {
    const deleted = await prisma.post.findFirst({
      where: { id: deletedPostId, deleted_at: { not: null } },
    });
    const deletedCount = await prisma.post.count({
      where: { author_id: userId, deleted_at: { not: null } },
    });

    expect(deleted?.id).toBe(deletedPostId);
    expect(deletedCount).toBe(1);
  });
});
