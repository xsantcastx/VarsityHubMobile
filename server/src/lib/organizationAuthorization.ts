import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export const ORGANIZATION_OWNER_ROLE = 'owner' as const;
export const ORGANIZATION_ADMIN_ROLES = ['owner', 'manager'] as const;

type OrganizationMembershipShape = {
  role: string | null;
  status: string | null;
  id?: string;
};

export async function getOrganizationMembership(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<OrganizationMembershipShape | null> {
  if (!userId || !orgId) return null;

  const rows = await prisma.$queryRaw<OrganizationMembershipShape[]>`
    SELECT
      id,
      role::text AS role,
      status::text AS status
    FROM "OrganizationMembership"
    WHERE organization_id = ${orgId}
      AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

/** One owner resolver for authorization, review recipients, and audit attribution.
 * Active owner membership is canonical; pre-membership organizations fall back
 * to league_owner_id. A stale pointer never adds a second owner.
 */
export async function getOrganizationOwner(
  orgId: string | null | undefined,
  db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma
): Promise<{ id: string; email: string | null; display_name: string | null } | null> {
  if (!orgId) return null;
  const rows = await db.$queryRaw<
    { id: string; email: string | null; display_name: string | null }[]
  >`
    SELECT u.id, u.email, u.display_name
    FROM "Organization" o
    JOIN "User" u ON u.id = COALESCE(
      (SELECT m.user_id FROM "OrganizationMembership" m
       WHERE m.organization_id = o.id AND m.role = 'owner' AND m.status = 'active'
       ORDER BY m.created_at, m.id LIMIT 1),
      o.league_owner_id
    )
    WHERE o.id = ${orgId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Resolve a bounded candidate set with exactly the same precedence as above. */
export async function getOwnedOrganizationIds(
  userId: string,
  organizationIds: string[],
  db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma
): Promise<string[]> {
  if (!organizationIds.length) return [];
  if (organizationIds.length > 5000)
    throw new Error('Organization owner lookup exceeds 5000 candidates');
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT o.id FROM "Organization" o
    WHERE o.id = ANY(${organizationIds}::text[])
      AND COALESCE(
        (SELECT m.user_id FROM "OrganizationMembership" m
         WHERE m.organization_id = o.id AND m.role = 'owner' AND m.status = 'active'
         ORDER BY m.created_at, m.id LIMIT 1),
        o.league_owner_id
      ) = ${userId}
  `;
  return rows.map(row => row.id);
}

export async function isOrganizationOwner(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<boolean> {
  if (!userId || !orgId) return false;
  return (await getOrganizationOwner(orgId))?.id === userId;
}

export async function isOrganizationAdmin(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<boolean> {
  const membership = await getOrganizationMembership(userId, orgId);
  return (
    membership?.status === 'active' &&
    ORGANIZATION_ADMIN_ROLES.includes(
      String(membership?.role || '') as (typeof ORGANIZATION_ADMIN_ROLES)[number]
    )
  );
}
