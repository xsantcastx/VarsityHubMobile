import type { PrismaClient } from '@prisma/client';

export type CoachApprovalDriftRow = {
  user_id: string;
  application_id: string;
  application_status: string;
  approval_status: string | null;
};

export async function findCoachApprovalDrift(
  prisma: PrismaClient,
  limit = 50
): Promise<CoachApprovalDriftRow[]> {
  return prisma.$queryRaw<CoachApprovalDriftRow[]>`
    WITH latest_app AS (
      SELECT DISTINCT ON ("user_id")
        "id" AS application_id,
        "user_id",
        "status" AS application_status,
        "created_at"
      FROM "CoachApplication"
      WHERE "status" IN ('submitted', 'approved', 'rejected')
      ORDER BY "user_id", "created_at" DESC, "id" DESC
    )
    SELECT
      latest_app.user_id,
      latest_app.application_id,
      latest_app.application_status,
      "User"."approval_status"
    FROM latest_app
    JOIN "User" ON "User"."id" = latest_app.user_id
    WHERE
      (latest_app.application_status = 'submitted' AND "User"."approval_status" IS DISTINCT FROM 'PENDING')
      OR (latest_app.application_status = 'approved' AND "User"."approval_status" IS DISTINCT FROM 'APPROVED')
      OR (latest_app.application_status = 'rejected' AND "User"."approval_status" IS DISTINCT FROM 'REJECTED')
    ORDER BY latest_app.created_at DESC
    LIMIT ${limit}
  `;
}
