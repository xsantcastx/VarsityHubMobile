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

export async function isOrganizationOwner(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<boolean> {
  if (!userId || !orgId) return false;
  const membership = await getOrganizationMembership(userId, orgId);
  if (membership?.status === 'active' && membership.role === ORGANIZATION_OWNER_ROLE) {
    return true;
  }
  // Legacy orgs created before owner membership rows existed record ownership
  // only on Organization.league_owner_id (no membership row). Honor that pointer
  // so a legacy owner isn't 403'd on every owner action — matching the existing
  // resend-approval-email check (organizations.ts:2776). Modern orgs always
  // write the owner membership row too, and transfer-ownership moves
  // league_owner_id atomically, so a demoted ex-owner never matches here.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { league_owner_id: true },
  });
  return !!org && org.league_owner_id === userId;
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
