/**
 * Team-scoped authorization helpers — single source of truth.
 *
 * Why this file exists:
 *   Authorization checks for team-scoped resources used to be duplicated
 *   across every route file. The org-admin fallback was added piecemeal,
 *   leading to inconsistencies (some endpoints honored org owner/manager
 *   roles, others didn't). Six bugs of this shape were caught one-at-a-time
 *   over the audit pass before this helper landed.
 *
 *   Every route that needs to ask "can this user manage this team?" should
 *   call `canManageTeam` here. Every route that needs "is this user an admin
 *   of this org?" should call `isOrgAdmin`. New role rules go in this file
 *   and propagate everywhere.
 *
 * Behavior:
 *   - canManageTeam: TRUE if user has direct team staff role
 *     (owner/manager/coach/assistant_coach) OR if user is owner/manager of
 *     the team's organization.
 *   - isOrgAdmin: TRUE if user has owner or manager role in the specified
 *     organization, with active status.
 *   - canApproveTeamGame: TRUE if user can approve games involving the team
 *     (team coach/manager/owner OR org admin of the team's org).
 *
 * All helpers fail closed — null/undefined inputs return false.
 */

import { prisma } from './prisma.js';
import { isOrganizationOwner } from './organizationAuthorization.js';

export const TEAM_STAFF_ROLES = ['owner', 'manager', 'coach', 'assistant_coach'] as const;
export const ORG_ADMIN_ROLES = ['owner', 'manager'] as const;
// Role-barrier model (2026-07-06): full team administration is reserved for the
// team owner and head coach; managers/assistant coaches are "authorized users"
// whose ONLY admin functions are approve/deny roster and create/approve/deny
// events (they keep canManageTeam, which now gates only those functions).
export const TEAM_ADMIN_ROLES = ['owner', 'coach'] as const;

/**
 * Can `userId` manage members + settings of `teamId`?
 *
 * Direct check: user has an active team-staff membership on the team.
 * Fallback: user is an active owner/manager of the team's organization.
 */
export async function canManageTeam(
  userId: string | null | undefined,
  teamId: string
): Promise<boolean> {
  return canManageAnyTeam(userId, [teamId]);
}

/**
 * Can `userId` manage ANY of the supplied team IDs?
 *
 * Direct check: active team-staff membership on at least one team.
 * Fallback: active owner/manager membership in an organization that owns at
 * least one of the teams.
 */
export async function canManageAnyTeam(
  userId: string | null | undefined,
  teamIds: Array<string | null | undefined>
): Promise<boolean> {
  if (!userId) return false;
  const filteredTeamIds = [...new Set(teamIds.filter((id): id is string => Boolean(id)))];
  if (filteredTeamIds.length === 0) return false;

  const membership = await prisma.teamMembership.findFirst({
    where: {
      team_id: { in: filteredTeamIds },
      user_id: userId,
      role: { in: [...TEAM_STAFF_ROLES] },
      status: 'active',
    },
  });
  if (membership) return true;

  const teams = await prisma.team.findMany({
    where: { id: { in: filteredTeamIds } },
    select: { organization_id: true },
    take: filteredTeamIds.length,
  });
  const organizationIds = teams
    .map(team => team.organization_id)
    .filter((id): id is string => Boolean(id));
  if (organizationIds.length === 0) return false;
  return isAdminOfAnyOrg(userId, organizationIds);
}

/**
 * Can `userId` archive/delete `teamId`?
 *
 * Deliberately STRICTER than canManageTeam: archiving a team cascades
 * (memberships, invites, follows, chat unlinks) — a full-administration
 * action. Same boundary as `canAdministerTeam` (team owner/coach, or org
 * owner). Managers pass `canManageTeam` but MUST NOT be able to archive
 * teams under the role-barrier model.
 */
export async function canArchiveTeam(
  userId: string | null | undefined,
  teamId: string
): Promise<boolean> {
  return canAdministerTeam(userId, teamId);
}

/**
 * Is `userId` an active admin (owner OR manager) of `orgId`?
 */
export async function isOrgAdmin(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<boolean> {
  if (!userId || !orgId) return false;
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organization_id: orgId,
      user_id: userId,
      role: { in: [...ORG_ADMIN_ROLES] },
      status: 'active',
    },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * Is `userId` the OWNER (not manager) of `orgId`? Stricter than `isOrgAdmin`
 * — used for the org-level actions the role-barrier model reserves for the
 * owner alone (org edit, org invite create/revoke, team-admin-tier fallback).
 */
export async function isOrgOwner(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<boolean> {
  // Share ownership precedence with organization writes, email recipients and
  // review audit attribution. A stale legacy pointer cannot add a second owner.
  return isOrganizationOwner(userId, orgId);
}

/**
 * Can `userId` ADMINISTER `teamId` — team settings, invite creation, roster
 * add/remove/role-change, ownership transfer?
 *
 * Role-barrier model (2026-07-06, user-directed): full team administration —
 * billing, exclusive info, settings, transfers — is reserved for the team
 * owner and head coach (or the org owner). Managers and assistant_coaches
 * remain "authorized users": they pass `canManageTeam` (so they keep roster
 * approve/deny and event approve/deny + create) but MUST NOT pass this
 * stricter check. Fails closed on null user.
 */
export async function canAdministerTeam(
  userId: string | null | undefined,
  teamId: string
): Promise<boolean> {
  if (!userId) return false;
  const membership = await prisma.teamMembership.findFirst({
    where: {
      team_id: teamId,
      user_id: userId,
      role: { in: [...TEAM_ADMIN_ROLES] },
      status: 'active',
    },
    select: { id: true },
  });
  if (membership) return true;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organization_id: true },
  });
  return isOrgOwner(userId, team?.organization_id ?? null);
}

/**
 * Can `userId` approve a game involving `teamId`?
 *
 * Same boundary as `canManageTeam` — team staff OR org admin. Provided as a
 * named helper so call sites read clearly at the approval endpoint.
 */
export async function canApproveTeamGame(
  userId: string | null | undefined,
  teamId: string
): Promise<boolean> {
  return canManageTeam(userId, teamId);
}

/**
 * Can `userId` assign `targetRole` within `teamId`? Single source of truth for
 * role-tier rules across EVERY team-role write path (POST /teams/:id/invite,
 * POST /team-invites, PATCH /team-memberships/:id). Callers MUST already have
 * gated on `canManageTeam` — this only adds the tier restriction on top.
 *
 *   - `owner`   → never assignable here (only via team creation / transfer-ownership).
 *   - `manager` → only a team OWNER, or an org admin (owner/manager of the team's
 *                 org), may grant it. Coaches/assistant_coaches pass canManageTeam
 *                 but must NOT be able to mint managers — that is a privilege
 *                 escalation (a coach could otherwise promote peers or self).
 *   - any lower role → allowed (caller already passed canManageTeam).
 *
 * Fails closed on null user. The org-admin path is verified explicitly rather
 * than inferred from a null direct membership, so an org admin who *also* holds
 * a non-owner direct team role is still allowed to grant manager.
 */
export async function canAssignTeamRole(
  userId: string | null | undefined,
  teamId: string,
  targetRole: string
): Promise<boolean> {
  if (!userId) return false;
  if (targetRole === 'owner') return false;
  if (targetRole !== 'manager') return true;

  const callerMembership = await prisma.teamMembership.findFirst({
    where: { team_id: teamId, user_id: userId, status: 'active' },
    select: { role: true },
  });
  if (callerMembership?.role === 'owner') return true;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organization_id: true },
  });
  return isOrgAdmin(userId, team?.organization_id ?? null);
}

/**
 * Can `userId` see a private team's roster + full profile?
 *
 * Public teams (`is_private = false`) are always viewable. For private teams,
 * the viewer must be one of:
 *   - active team member (any role)
 *   - team follower
 *   - org owner/manager (via canManageTeam fallback)
 *   - platform admin (callers should check separately and short-circuit)
 *
 * Returns false for unauthenticated viewers attempting to access a private
 * team, and false for any user not on the access list above.
 */
export async function canViewTeam(
  userId: string | null | undefined,
  teamId: string
): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { is_private: true, organization_id: true } as any,
  });
  if (!team) return false;
  if (!(team as any).is_private) return true;
  if (!userId) return false;

  const [teamMembership, teamFollow] = await Promise.all([
    prisma.teamMembership.findFirst({
      where: { team_id: teamId, user_id: userId, status: 'active' },
      select: { id: true },
    }),
    prisma.teamFollow.findFirst({
      where: { team_id: teamId, user_id: userId },
      select: { team_id: true },
    }),
  ]);
  if (teamMembership || teamFollow) return true;

  // Org-admin fallback — same boundary as canManageTeam
  return isOrgAdmin(userId, (team as any).organization_id);
}

/**
 * For batch list/search filtering use `getExcludedPrivateTeamIds(viewerId)`
 * from `lib/privacyUtils.js` instead — it returns the IDs to put in a
 * `notIn` clause and uses a 60s cache for fanout-friendly cost.
 */

/**
 * Convenience: check whether `userId` is admin (owner or manager) in ANY of
 * the supplied org IDs. Used by game-approval to check across home/away orgs.
 */
export async function isAdminOfAnyOrg(
  userId: string | null | undefined,
  orgIds: string[]
): Promise<boolean> {
  if (!userId || orgIds.length === 0) return false;
  const filtered = orgIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (filtered.length === 0) return false;
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organization_id: { in: filtered },
      user_id: userId,
      role: { in: [...ORG_ADMIN_ROLES] },
      status: 'active',
    },
    select: { id: true },
  });
  return Boolean(membership);
}
