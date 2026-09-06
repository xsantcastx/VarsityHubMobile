import type { PrismaClient } from '@prisma/client';
import { ORG_ADMIN_ROLES, TEAM_STAFF_ROLES } from './teamAuthorization.js';

const SCOPE_TAKE = 5000;

export type ViewerTeamScope = {
  allTeamIds: Set<string>;
  managedTeamIds: Set<string>;
};

/**
 * The set of team ids a viewer follows or manages. "Manages" mirrors
 * /teams/managed: an active staff TeamMembership (TEAM_STAFF_ROLES) OR being an
 * org admin (ORG_ADMIN_ROLES) of the team's organization. Query-builder based
 * (not the route's raw SQL) so it composes with the discovery pipeline and is
 * mockable in the same style as eventDiscovery's tests.
 */
export async function getViewerTeamScopeDetails(
  db: PrismaClient,
  viewerId: string | null | undefined
): Promise<ViewerTeamScope> {
  if (!viewerId) return { allTeamIds: new Set(), managedTeamIds: new Set() };
  const [follows, staff, orgAdmin] = await Promise.all([
    db.teamFollow.findMany({
      where: { user_id: viewerId },
      select: { team_id: true },
      take: SCOPE_TAKE,
    }),
    db.teamMembership.findMany({
      where: { user_id: viewerId, status: 'active', role: { in: [...TEAM_STAFF_ROLES] } as any },
      select: { team_id: true },
      take: SCOPE_TAKE,
    }),
    db.organizationMembership.findMany({
      where: { user_id: viewerId, status: 'active', role: { in: [...ORG_ADMIN_ROLES] } as any },
      select: { organization_id: true },
      take: SCOPE_TAKE,
    }),
  ]);

  const followedTeamIds = new Set<string>();
  const managedTeamIds = new Set<string>();
  for (const row of follows) followedTeamIds.add(row.team_id);
  for (const row of staff) managedTeamIds.add(row.team_id);

  const orgIds = orgAdmin.map((row: any) => row.organization_id).filter(Boolean);
  if (orgIds.length > 0) {
    const orgTeams = await db.team.findMany({
      where: { organization_id: { in: orgIds }, status: 'active' },
      select: { id: true },
      take: SCOPE_TAKE,
    });
    for (const row of orgTeams) managedTeamIds.add(row.id);
  }
  return {
    allTeamIds: new Set([...followedTeamIds, ...managedTeamIds]),
    managedTeamIds,
  };
}

export async function getViewerTeamScope(
  db: PrismaClient,
  viewerId: string | null | undefined
): Promise<Set<string>> {
  return (await getViewerTeamScopeDetails(db, viewerId)).allTeamIds;
}
