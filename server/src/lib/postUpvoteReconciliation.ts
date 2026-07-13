import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

const DEFAULT_RECONCILE_LIMIT = 500;

type DbClient = Prisma.TransactionClient | typeof prisma;

type UpvoteDriftRow = {
  id: string;
  stored_count: number;
  actual_count: number;
};

export async function findPostUpvoteCountDrift(
  limit = DEFAULT_RECONCILE_LIMIT,
  db: DbClient = prisma
): Promise<UpvoteDriftRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 5000));
  return db.$queryRaw<UpvoteDriftRow[]>`
    SELECT
      p.id,
      p.upvotes_count::int AS stored_count,
      COALESCE(u.actual_count, 0)::int AS actual_count
    FROM "Post" p
    LEFT JOIN (
      SELECT post_id, COUNT(*)::int AS actual_count
      FROM "PostUpvote"
      GROUP BY post_id
    ) u ON u.post_id = p.id
    WHERE p.upvotes_count IS DISTINCT FROM COALESCE(u.actual_count, 0)
    ORDER BY p.created_at ASC
    LIMIT ${safeLimit}
  `;
}

export async function runPostUpvoteReconciliation(
  limit = DEFAULT_RECONCILE_LIMIT,
  db: DbClient = prisma
): Promise<{
  scanned: number;
  fixed: number;
  skipped: number;
}> {
  const drift = await findPostUpvoteCountDrift(limit, db);
  let fixed = 0;
  let skipped = 0;

  for (const row of drift) {
    const result = await db.post.updateMany({
      where: {
        id: row.id,
        upvotes_count: row.stored_count,
      },
      data: {
        upvotes_count: row.actual_count,
      },
    });

    if (result.count === 1) fixed += 1;
    else skipped += 1;
  }

  return {
    scanned: drift.length,
    fixed,
    skipped,
  };
}
