import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type DbClientLike = {
  $queryRaw: typeof prisma.$queryRaw;
};

export type TeamStateRow = {
  id: string;
  name: string;
  organization_id: string | null;
  status: string | null;
  is_private: boolean;
};

export async function getTeamState(
  teamId: string | null | undefined,
  db: DbClientLike = prisma
): Promise<TeamStateRow | null> {
  if (!teamId) return null;

  const rows = await db.$queryRaw<TeamStateRow[]>`
    SELECT
      id,
      name,
      organization_id,
      status::text AS status,
      is_private
    FROM "Team"
    WHERE id = ${teamId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function listTeamStates(
  teamIds: Array<string | null | undefined>,
  db: DbClientLike = prisma
): Promise<TeamStateRow[]> {
  const filtered = [...new Set(teamIds.filter((teamId): teamId is string => Boolean(teamId)))];
  if (filtered.length === 0) return [];

  return db.$queryRaw<TeamStateRow[]>`
    SELECT
      id,
      name,
      organization_id,
      status::text AS status,
      is_private
    FROM "Team"
    WHERE id IN (${Prisma.join(filtered)})
  `;
}
