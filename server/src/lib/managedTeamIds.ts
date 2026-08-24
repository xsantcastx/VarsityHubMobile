import { prisma } from './prisma.js';
import { ORG_ADMIN_ROLES, TEAM_STAFF_ROLES } from './teamAuthorization.js';

/**
 * Team ids `userId` can manage: direct staff membership (owner/manager/coach/
 * assistant_coach) OR any team under an org where the user is owner/manager.
 * Mirrors the `canManageAnyTeam` boundary — kept as a single source so
 * "teams I manage" scoping (e.g. the Discover calendar) can never drift from
 * the gate that gave the user event/game rights on those teams.
 */
export async function getManagedTeamIds(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];

  const [staffMemberships, orgAdminMemberships] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { user_id: userId, role: { in: [...TEAM_STAFF_ROLES] }, status: 'active' },
      select: { team_id: true },
      take: 500,
    }),
    prisma.organizationMembership.findMany({
      where: { user_id: userId, role: { in: [...ORG_ADMIN_ROLES] }, status: 'active' },
      select: { organization_id: true },
      take: 500,
    }),
  ]);

  const directTeamIds = staffMemberships.map(m => m.team_id);
  const orgIds = orgAdminMemberships.map(m => m.organization_id);
  const orgTeams = orgIds.length
    ? await prisma.team.findMany({
        where: { organization_id: { in: orgIds }, status: 'active' },
        select: { id: true },
        take: 500,
      })
    : [];

  return [...new Set([...directTeamIds, ...orgTeams.map(t => t.id)])];
}
