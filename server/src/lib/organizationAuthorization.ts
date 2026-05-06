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
  orgId: string | null | undefined,
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

export async function isOrganizationOwner(
  userId: string | null | undefined,
  orgId: string | null | undefined,
): Promise<boolean> {
  const membership = await getOrganizationMembership(userId, orgId);
  return membership?.status === 'active' && membership.role === ORGANIZATION_OWNER_ROLE;
}

export async function isOrganizationAdmin(
  userId: string | null | undefined,
  orgId: string | null | undefined,
): Promise<boolean> {
  const membership = await getOrganizationMembership(userId, orgId);
  return (
    membership?.status === 'active' &&
    ORGANIZATION_ADMIN_ROLES.includes(
      String(membership?.role || '') as (typeof ORGANIZATION_ADMIN_ROLES)[number]
    )
  );
}
