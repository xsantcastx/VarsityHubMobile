import { Prisma } from '@prisma/client';
import { getAuthorizedUsersPerTeam, getMaxRosterSizePerTeam, getMaxTeamsForPlan, resolvePlan } from './planLimits.js';
import { prisma } from './prisma.js';
import { getUserPlan } from '../middleware/subscription.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export const TEAM_MANAGEMENT_ROLES = ['owner', 'manager', 'coach', 'assistant_coach'] as const;
export const TEAM_AUTHORIZED_ROLES = ['manager', 'coach', 'assistant_coach', 'equipment', 'health_wellness'] as const;

type NullableLimit = number | null;

export interface TeamEntitlementState {
  teamId: string;
  teamLocked: boolean;
  ownerIds: string[];
  entitledOwnerIds: string[];
  ownerPlans: Record<string, string>;
  maxTeams: NullableLimit;
  maxRoster: NullableLimit;
  maxAuthorizedUsers: NullableLimit;
}

type MembershipMutationGuardResult =
  | { ok: true; entitlement: TeamEntitlementState }
  | { ok: false; status: number; body: Record<string, any> };

function mergeLargestLimit(current: NullableLimit | undefined, next: NullableLimit): NullableLimit {
  if (current === null || next === null) return null;
  return Math.max(current ?? 0, next ?? 0);
}

function compareTeamOwnership(a: { team_id: string; team: { created_at: Date } | null }, b: { team_id: string; team: { created_at: Date } | null }) {
  const aCreatedAt = a.team?.created_at?.getTime?.() ?? 0;
  const bCreatedAt = b.team?.created_at?.getTime?.() ?? 0;
  if (aCreatedAt !== bCreatedAt) return aCreatedAt - bCreatedAt;
  return a.team_id.localeCompare(b.team_id);
}

export function isManagementRole(role?: string | null): boolean {
  return (TEAM_MANAGEMENT_ROLES as readonly string[]).includes(String(role || ''));
}

export function isAuthorizedTeamRole(role?: string | null): boolean {
  return (TEAM_AUTHORIZED_ROLES as readonly string[]).includes(String(role || ''));
}

export function buildTeamPlanLockedError(entitlement: TeamEntitlementState) {
  const message = typeof entitlement.maxTeams === 'number'
    ? `This team is outside the owner's current plan allowance of ${entitlement.maxTeams} team${entitlement.maxTeams === 1 ? '' : 's'}. Upgrade or remove extra teams to manage it again.`
    : 'This team is outside the owner\'s current plan allowance. Upgrade or remove extra teams to manage it again.';

  return {
    error: 'TEAM_PLAN_LOCKED',
    code: 'TEAM_PLAN_LOCKED',
    message,
    upgrade_url: '/settings/manage-subscription',
    max_teams: entitlement.maxTeams,
  };
}

export function buildRosterLimitError(limit: number) {
  return {
    error: 'ROSTER_LIMIT_REACHED',
    code: 'ROSTER_LIMIT_REACHED',
    message: `This team has reached its roster limit of ${limit} members. Upgrade your plan for more.`,
  };
}

export function buildAuthorizedUserLimitError(limit: number) {
  return {
    error: 'USER_LIMIT_REACHED',
    code: 'USER_LIMIT_REACHED',
    message: `Plan limit reached for authorized users. This team allows ${limit} authorized user${limit === 1 ? '' : 's'}.`,
  };
}

export async function getTeamEntitlementState(db: DbClient, teamId: string): Promise<TeamEntitlementState> {
  const ownerMemberships = await db.teamMembership.findMany({
    where: { team_id: teamId, role: 'owner', status: 'active' },
    select: { user_id: true },
  });

  const ownerIds = Array.from(new Set(ownerMemberships.map((membership) => membership.user_id)));
  if (ownerIds.length === 0) {
    return {
      teamId,
      teamLocked: false,
      ownerIds: [],
      entitledOwnerIds: [],
      ownerPlans: {},
      maxTeams: null,
      maxRoster: null,
      maxAuthorizedUsers: null,
    };
  }

  const [ownerPlansEntries, ownershipRows] = await Promise.all([
    Promise.all(ownerIds.map(async (ownerId) => {
      const currentPlan = resolvePlan(await getUserPlan(ownerId));
      return [ownerId, currentPlan] as const;
    })),
    db.teamMembership.findMany({
      where: {
        user_id: { in: ownerIds },
        role: 'owner',
        status: 'active',
      },
      select: {
        user_id: true,
        team_id: true,
        team: {
          select: {
            created_at: true,
          },
        },
      },
    }),
  ]);

  const ownerPlans = Object.fromEntries(ownerPlansEntries);
  const entitledOwnerIds: string[] = [];
  let bestMaxTeams: NullableLimit | undefined;
  let bestMaxRoster: NullableLimit | undefined;
  let bestMaxAuthorizedUsers: NullableLimit | undefined;

  for (const ownerId of ownerIds) {
    const ownerPlan = ownerPlans[ownerId] || 'rookie';
    const maxTeams = getMaxTeamsForPlan(ownerPlan);
    const maxRoster = getMaxRosterSizePerTeam(ownerPlan);
    const maxAuthorizedUsers = getAuthorizedUsersPerTeam(ownerPlan);
    const ownedTeamIds = ownershipRows
      .filter((row) => row.user_id === ownerId)
      .sort(compareTeamOwnership)
      .map((row) => row.team_id);

    const teamIndex = ownedTeamIds.indexOf(teamId);
    const ownerEntitlesTeam = teamIndex !== -1 && (maxTeams === null || teamIndex < maxTeams);
    if (!ownerEntitlesTeam) continue;

    entitledOwnerIds.push(ownerId);
    bestMaxTeams = mergeLargestLimit(bestMaxTeams, maxTeams);
    bestMaxRoster = mergeLargestLimit(bestMaxRoster, maxRoster);
    bestMaxAuthorizedUsers = mergeLargestLimit(bestMaxAuthorizedUsers, maxAuthorizedUsers);
  }

  const teamLocked = entitledOwnerIds.length === 0;

  if (teamLocked) {
    for (const ownerId of ownerIds) {
      const ownerPlan = ownerPlans[ownerId] || 'rookie';
      bestMaxTeams = mergeLargestLimit(bestMaxTeams, getMaxTeamsForPlan(ownerPlan));
      bestMaxRoster = mergeLargestLimit(bestMaxRoster, getMaxRosterSizePerTeam(ownerPlan));
      bestMaxAuthorizedUsers = mergeLargestLimit(bestMaxAuthorizedUsers, getAuthorizedUsersPerTeam(ownerPlan));
    }
  }

  return {
    teamId,
    teamLocked,
    ownerIds,
    entitledOwnerIds,
    ownerPlans,
    maxTeams: bestMaxTeams ?? null,
    maxRoster: bestMaxRoster ?? null,
    maxAuthorizedUsers: bestMaxAuthorizedUsers ?? null,
  };
}

export async function guardTeamMembershipMutation(
  db: DbClient,
  {
    teamId,
    nextRole,
    existingMembership,
    nextStatus = 'active',
  }: {
    teamId: string;
    nextRole: string;
    existingMembership?: { role: string; status: string } | null;
    nextStatus?: string;
  }
): Promise<MembershipMutationGuardResult> {
  const entitlement = await getTeamEntitlementState(db, teamId);
  if (entitlement.teamLocked) {
    return { ok: false, status: 403, body: buildTeamPlanLockedError(entitlement) };
  }

  const existingActive = existingMembership?.status === 'active';
  const nextActive = nextStatus === 'active';

  if (entitlement.maxRoster !== null && (existingActive || nextActive)) {
    const currentActiveCount = await db.teamMembership.count({
      where: { team_id: teamId, status: 'active' },
    });
    const nextActiveCount = currentActiveCount + (nextActive ? 1 : 0) - (existingActive ? 1 : 0);
    if (nextActiveCount > entitlement.maxRoster) {
      return { ok: false, status: 403, body: buildRosterLimitError(entitlement.maxRoster) };
    }
  }

  const existingAuthorized = existingActive && isAuthorizedTeamRole(existingMembership?.role);
  const nextAuthorized = nextActive && isAuthorizedTeamRole(nextRole);

  if (entitlement.maxAuthorizedUsers !== null && (existingAuthorized || nextAuthorized)) {
    const currentAuthorizedCount = await db.teamMembership.count({
      where: {
        team_id: teamId,
        status: 'active',
        role: { in: [...TEAM_AUTHORIZED_ROLES] as any },
      },
    });
    const nextAuthorizedCount = currentAuthorizedCount + (nextAuthorized ? 1 : 0) - (existingAuthorized ? 1 : 0);
    if (nextAuthorizedCount > entitlement.maxAuthorizedUsers) {
      return { ok: false, status: 403, body: buildAuthorizedUserLimitError(entitlement.maxAuthorizedUsers) };
    }
  }

  return { ok: true, entitlement };
}
