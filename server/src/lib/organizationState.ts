import { prisma } from './prisma.js';

export type OrganizationStateRow = {
  id: string;
  name: string | null;
  location: string | null;
  status: string | null;
  admin_approved: boolean;
  league_owner_id: string | null;
};

export async function getOrganizationState(
  orgId: string | null | undefined
): Promise<OrganizationStateRow | null> {
  if (!orgId) return null;

  const rows = await prisma.$queryRaw<OrganizationStateRow[]>`
    SELECT
      id,
      name,
      location,
      status::text AS status,
      admin_approved,
      league_owner_id
    FROM "Organization"
    WHERE id = ${orgId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}
