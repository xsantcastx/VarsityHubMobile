import { MembershipStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { isOrganizationApproved } from '../lib/approvalService.js';
import { debugLog } from '../lib/debugLog.js';
import { withDistributedLock } from '../lib/distributedLock.js';
import { sendStaffMemberJoinedEmail, sendTeamInviteEmail } from '../lib/email.js';
import { sendError } from '../lib/http/sendError.js';
import { getOrganizationMembership } from '../lib/organizationAuthorization.js';
import { getOrganizationState } from '../lib/organizationState.js';
import { getVeteranTotalTeamAllowance } from '../lib/paymentInternals.js';
import { SERVER_ROOKIE_TEAM_LIMIT } from '../lib/planDefinitions.js';
import { getMaxTeamsForPlan, planSupportsExtracurricular } from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';
import { getExcludedPrivateTeamIds, isTeamHiddenFromViewer } from '../lib/privacyUtils.js';
import { sendPushNotification } from '../lib/pushNotifications.js';
import { stripHtml } from '../lib/sanitizeHtml.js';
import { buildTeamSerializeSelect, serializeTeam } from '../lib/serializeTeam.js';
import {
    canManageTeam as canManageTeamScoped,
    canAssignTeamRole as canAssignTeamRoleScoped,
    isOrgAdmin as isOrgAdminScoped,
} from '../lib/teamAuthorization.js';
import { logAdminActivityFromReq } from '../lib/adminActivityLogger.js';
import {
    buildTeamPlanLockedError,
    getTeamEntitlementState,
    getTeamEntitlementStates,
    isAuthorizedTeamRole,
    isManagementRole,
    TEAM_AUTHORIZED_ROLES,
} from '../lib/teamEntitlements.js';
import { getTeamState, listTeamStates } from '../lib/teamState.js';
import { getCanonicalUserRole, isUserOnboardingComplete } from '../lib/userAuthState.js';
import { getEffectiveEntitledPlan } from '../lib/userBillingState.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { followLimiter, inviteLimiter, teamCreationLimiter } from '../middleware/rateLimiters.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { requirePlan } from '../middleware/subscription.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const teamsRouter = Router();
registerIdValidation(teamsRouter);
const teamGroupChatLocks = new Map<string, Promise<any>>();

type ManagedTeamCursor = {
  orgName: string;
  teamName: string;
  teamId: string;
};

const encodeManagedTeamCursor = (cursor: ManagedTeamCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

const parseManagedTeamCursor = (raw: string): ManagedTeamCursor | null => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<ManagedTeamCursor>;
    if (
      typeof parsed.orgName !== 'string' ||
      typeof parsed.teamName !== 'string' ||
      typeof parsed.teamId !== 'string' ||
      parsed.orgName.length === 0 ||
      parsed.teamName.length === 0 ||
      parsed.teamId.length === 0
    ) {
      return null;
    }
    return {
      orgName: parsed.orgName,
      teamName: parsed.teamName,
      teamId: parsed.teamId,
    };
  } catch {
    return null;
  }
};

async function ensureTeamGroupChatMembership(teamId: string, userId: string) {
  return withDistributedLock(
    {
      namespace: 'team-group-chat',
      key: teamId,
      localLocks: teamGroupChatLocks,
      ttlMs: 5_000,
      acquireTimeoutMs: 5_000,
    },
    async () => {
      let groupChat = await prisma.groupChat.findFirst({
        where: { team_id: teamId },
        orderBy: { created_at: 'asc' },
      });

      if (!groupChat) {
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { name: true },
        });
        const allMembers = await prisma.teamMembership.findMany({
          where: { team_id: teamId, status: 'active' },
          select: { user_id: true },
          take: 500,
        });

        groupChat = await prisma.groupChat.create({
          data: {
            name: `${team?.name || 'Team'} Chat`,
            team_id: teamId,
            created_by: userId,
            members: {
              create: allMembers.map(member => ({ user_id: member.user_id })),
            },
          },
        });
      } else {
        const existingMember = await prisma.groupChatMember.findFirst({
          where: { chat_id: groupChat.id, user_id: userId },
        });

        if (!existingMember) {
          await prisma.groupChatMember.create({
            data: { chat_id: groupChat.id, user_id: userId },
          });
        }
      }

      return groupChat;
    }
  );
}

async function loadTeamViewerAccess(teamId: string, viewerId: string | null) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: buildTeamSerializeSelect({
      includeCounts: true,
      includeOrganization: true,
    }),
  });
  if (!team) return null;

  const teamState = await getTeamState(teamId);
  const isAdmin = viewerId ? await getIsAdmin({ user: { id: viewerId } } as any) : false;

  let membership: { role: string } | null = null;
  let isOrgAdmin = false;
  if (viewerId) {
    const [resolvedMembership, orgMembership] = await Promise.all([
      prisma.teamMembership.findFirst({
        where: { team_id: teamId, user_id: viewerId, status: 'active' },
        select: { role: true },
      }),
      team.organization_id
        ? prisma.organizationMembership.findFirst({
            where: {
              organization_id: team.organization_id,
              user_id: viewerId,
              role: { in: ['owner', 'manager'] },
              status: 'active',
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    membership = resolvedMembership;
    isOrgAdmin = !!orgMembership;
  }

  return {
    team: {
      ...team,
      status: teamState?.status ?? null,
    },
    membership,
    isAdmin,
    isOrgAdmin,
  };
}

function serializeTeamMember(member: any, includeEmail: boolean) {
  const prefs = (member?.user?.preferences || {}) as any;
  return {
    id: member.id,
    role: member.role,
    status: member.status,
    position: member.custom_position || null,
    jersey_number: prefs?.jersey_number || null,
    user: {
      id: member.user_id,
      display_name: member?.user?.display_name || null,
      avatar_url: member?.user?.avatar_url || null,
      username: member?.user?.username || null,
      ...(includeEmail ? { email: member?.user?.email || null } : {}),
    },
  };
}

function buildTeamCreateOrganizationError(status: number, error: string, message: string) {
  return {
    status,
    body: {
      error,
      message,
      code: error,
    },
  };
}

async function resolveOrganizationIdForTeamCreate(input: {
  organization_id?: string;
  organization_name?: string;
}) {
  const explicitOrganizationId =
    typeof input.organization_id === 'string' ? input.organization_id.trim() : '';
  if (explicitOrganizationId) {
    return { organizationId: explicitOrganizationId };
  }

  const requestedOrganizationName =
    typeof input.organization_name === 'string' ? input.organization_name.trim() : '';
  if (requestedOrganizationName) {
    const existingOrganization = await prisma.organization.findFirst({
      where: {
        name: { equals: requestedOrganizationName, mode: 'insensitive' },
        status: 'active',
      },
      select: { id: true },
    });
    if (existingOrganization) {
      return { organizationId: existingOrganization.id };
    }
  }

  return buildTeamCreateOrganizationError(
    400,
    'ORGANIZATION_REQUIRED',
    'Select an existing organization before creating a team.'
  );
}

async function validateTeamCreateOrganizationAccess(
  userId: string,
  organizationId: string,
  _onboardingComplete: boolean
) {
  const organization = await getOrganizationState(organizationId);
  if (!organization || organization.status !== 'active') {
    return buildTeamCreateOrganizationError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'The specified organization does not exist or is not active.'
    );
  }

  const orgMembership = await getOrganizationMembership(userId, organizationId);
  if (!orgMembership || orgMembership.status !== 'active') {
    return buildTeamCreateOrganizationError(
      403,
      'ORGANIZATION_MEMBERSHIP_REQUIRED',
      'You must be an active member of this organization to create a team under it.'
    );
  }

  return { ok: true as const };
}

type TeamCreatePayload = {
  name: string;
  description?: string;
  sport?: string;
  club_type?: 'sport' | 'extracurricular';
  extracurricular_category?: string;
  season?: string;
  primary_color?: string;
  season_start?: string;
  season_end?: string;
  organization_id?: string;
  organization_name?: string;
  logo_url?: string;
  city?: string;
  state?: string;
  league?: string;
  venue_place_id?: string;
  venue_lat?: number;
  venue_lng?: number;
  venue_address?: string;
  authorized_users?: Array<{
    email?: string;
    user_id?: string;
    role?: string;
    assign_team?: string;
  }>;
  onboarding?: boolean;
};

type TeamCreateBillingContext = {
  effectivePlan: string | null | undefined;
  effectiveSubscriptionId?: string;
  teamCountSource: 'user' | 'org';
  orgIdForTeamCount?: string;
};

async function buildTeamCreateBillingContext(
  userId: string,
  me: any
): Promise<TeamCreateBillingContext> {
  const prefs =
    me?.preferences && typeof me.preferences === 'object' ? (me.preferences as any) : {};
  let effectivePlan = getEffectiveEntitledPlan(me as any);
  let effectiveSubscriptionId = prefs.subscription_id;
  let teamCountSource: 'user' | 'org' = 'user';
  let orgIdForTeamCount: string | undefined;

  if (me?.paid_by_owner) {
    const orgMembership = await prisma.organizationMembership.findFirst({
      where: { user_id: userId, status: 'active' },
      select: { organization: { select: { id: true, league_owner_id: true } } },
    });
    const ownerId = orgMembership?.organization?.league_owner_id;
    if (ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: {
          preferences: true,
          plan: true,
          pending_plan: true,
          payment_pending: true,
          payment_approved: true,
        },
      });
      const ownerPrefs =
        owner?.preferences && typeof owner.preferences === 'object'
          ? (owner.preferences as any)
          : {};
      effectivePlan = getEffectiveEntitledPlan(owner as any);
      effectiveSubscriptionId = ownerPrefs.subscription_id;
      teamCountSource = 'org';
      orgIdForTeamCount = orgMembership?.organization?.id;
    }
  }

  return {
    effectivePlan,
    effectiveSubscriptionId,
    teamCountSource,
    orgIdForTeamCount,
  };
}

async function countTeamsForBillingContext(
  db: any,
  userId: string,
  context: TeamCreateBillingContext
): Promise<number> {
  if (context.teamCountSource === 'org' && context.orgIdForTeamCount) {
    return db.team.count({ where: { organization_id: context.orgIdForTeamCount } });
  }

  return db.teamMembership.count({
    where: { user_id: userId, role: 'owner', status: 'active' },
  });
}

async function getVeteranSubscriptionAllowance(subscriptionId: string) {
  const stripeLib = await import('stripe');
  const stripeClient = new stripeLib.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-06-20',
  });
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  const billableQuantity = subscription.items.data[0]?.quantity || 0;
  const active = subscription.status === 'active' || subscription.status === 'trialing';

  return {
    active,
    billableQuantity,
    totalTeamAllowance: getVeteranTotalTeamAllowance(billableQuantity),
  };
}

// Get teams managed by current user (requires authentication)
teamsRouter.get(
  '/managed',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });

      const q = String((req.query as any).q || '')
        .trim()
        .toLowerCase();
      const limitRaw = Number.parseInt(String((req.query as any).limit || ''), 10);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
      const cursorRaw = typeof (req.query as any).cursor === 'string' ? String((req.query as any).cursor) : null;
      const cursor = cursorRaw ? parseManagedTeamCursor(cursorRaw) : null;
      if (cursorRaw && !cursor) {
        return sendError(res, 400, 'INVALID_CURSOR', {
          message: 'Managed teams cursor is invalid.',
        });
      }
      const userId = req.user.id;
      const managementRoles = ['owner', 'manager', 'coach', 'assistant_coach'];
      const managementRoleSql = Prisma.join(
        managementRoles.map((role) => Prisma.sql`${role}::"TeamRole"`)
      );

      const select: any = {
        ...buildTeamSerializeSelect({
          includeCounts: true,
          includeOrganization: true,
        }),
        memberships: {
          where: { user_id: userId, status: MembershipStatus.active },
          select: { role: true },
        },
      };
      const batchSize = Math.min(Math.max(limit * 2, 25), 100);
      let exhausted = false;
      let rawCursor = cursor;
      const visibleRows: Array<{ team: any; cursor: ManagedTeamCursor }> = [];

      while (visibleRows.length < limit + 1 && !exhausted) {
        const searchClause = q
          ? Prisma.sql`AND t."name" ILIKE ${`%${q}%`}`
          : Prisma.empty;
        const cursorClause = rawCursor
          ? Prisma.sql`AND ROW(o."name", t."name", t."id") > ROW(${rawCursor.orgName}, ${rawCursor.teamName}, ${rawCursor.teamId})`
          : Prisma.empty;

        const candidates = await prisma.$queryRaw<Array<{ id: string; org_name: string; team_name: string }>>(
          Prisma.sql`
            SELECT t."id", o."name" AS org_name, t."name" AS team_name
            FROM "Team" t
            INNER JOIN "Organization" o ON o."id" = t."organization_id"
            WHERE t."status" = 'active'
              AND EXISTS (
                SELECT 1
                FROM "TeamMembership" tm
                WHERE tm."team_id" = t."id"
                  AND tm."user_id" = ${userId}
                  AND tm."status" = 'active'
                  AND tm."role" IN (${managementRoleSql})
              )
              ${searchClause}
              ${cursorClause}
            ORDER BY o."name" ASC, t."name" ASC, t."id" ASC
            LIMIT ${batchSize}
          `
        );

        exhausted = candidates.length < batchSize;
        if (candidates.length === 0) break;

        rawCursor = {
          orgName: candidates[candidates.length - 1]!.org_name,
          teamName: candidates[candidates.length - 1]!.team_name,
          teamId: candidates[candidates.length - 1]!.id,
        };

        const teamIds = candidates.map((team) => team.id);
        const [rows, entitlementsByTeamId] = await Promise.all([
          prisma.team.findMany({
            where: { id: { in: teamIds } },
            select,
            take: teamIds.length,
          }),
          getTeamEntitlementStates(prisma, teamIds),
        ]);
        const rowsById = new Map<string, any>();
        for (const team of rows as Array<any>) {
          rowsById.set(team.id, team);
        }

        for (const candidate of candidates) {
          const entitlement = entitlementsByTeamId.get(candidate.id);
          if (entitlement?.teamLocked) continue;
          const hydrated = rowsById.get(candidate.id);
          if (!hydrated) continue;
          visibleRows.push({
            team: hydrated,
            cursor: {
              orgName: candidate.org_name,
              teamName: candidate.team_name,
              teamId: candidate.id,
            },
          });
          if (visibleRows.length >= limit + 1) break;
        }
      }

      const hasMore = visibleRows.length > limit;
      const pageEntries = hasMore ? visibleRows.slice(0, limit) : visibleRows;
      const pageRows = pageEntries.map((entry) => entry.team);
      const nextCursor = hasMore
        ? encodeManagedTeamCursor(pageEntries[pageEntries.length - 1]!.cursor)
        : null;
      const teamStateById = new Map(
        (await listTeamStates(pageRows.map(team => team.id))).map(team => [team.id, team])
      );

      const followedTeamRows = await prisma.teamFollow.findMany({
        where: { user_id: userId, team_id: { in: pageRows.map(team => team.id) } },
        select: { team_id: true },
        take: Math.max(pageRows.length, 1),
      });
      const followedTeamIds = new Set(followedTeamRows.map(row => row.team_id));

      const list = pageRows.map(team =>
        serializeTeam(
          {
            ...team,
            status: teamStateById.get(team.id)?.status ?? null,
          },
          {
            includeCounts: true,
            includeOrganization: true,
            includeViewerState: true,
            viewerRole: team.memberships?.[0]?.role ?? null,
            isFollowing: followedTeamIds.has(team.id),
          }
        )
      );

      if (nextCursor) {
        res.set('x-next-cursor', nextCursor);
      }
      res.set('x-has-more', hasMore ? '1' : '0');
      return res.json(list);
  })
);

// Check team creation limits for current user
teamsRouter.get(
  '/limits',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          preferences: true,
          plan: true,
          pending_plan: true,
          payment_pending: true,
          payment_approved: true,
          paid_by_owner: true,
          subscription_tier: true,
        },
      });
      if (!user) return res.status(401).json({ error: 'User not found' });

      const billingContext = await buildTeamCreateBillingContext(req.user!.id, user);
      const ownedTeamsCount = await countTeamsForBillingContext(
        prisma,
        req.user!.id,
        billingContext
      );
      const effectivePlan = billingContext.effectivePlan;

      let maxTeamsDisplay = 999;
      let canCreateMore = true;
      let remaining = 999;

      if (effectivePlan === 'veteran') {
        const subscriptionId = billingContext.effectiveSubscriptionId;
        if (!subscriptionId) {
          maxTeamsDisplay = ownedTeamsCount;
          canCreateMore = false;
          remaining = 0;
        } else {
          try {
            const allowance = await getVeteranSubscriptionAllowance(subscriptionId);
            maxTeamsDisplay = allowance.totalTeamAllowance;
            canCreateMore = allowance.active && ownedTeamsCount < allowance.totalTeamAllowance;
            remaining = canCreateMore
              ? Math.max(0, allowance.totalTeamAllowance - ownedTeamsCount)
              : 0;
          } catch (err) {
            console.error('[teams] limits veteran allowance verification failed:', err);
            maxTeamsDisplay = ownedTeamsCount;
            canCreateMore = false;
            remaining = 0;
          }
        }
      } else {
        const maxTeamsFromPlan = getMaxTeamsForPlan(effectivePlan);
        const maxTeams = maxTeamsFromPlan ?? (user as any).max_teams ?? SERVER_ROOKIE_TEAM_LIMIT;
        maxTeamsDisplay = maxTeamsFromPlan === null ? 999 : maxTeams;
        canCreateMore = maxTeamsFromPlan === null || ownedTeamsCount < maxTeams;
        remaining = maxTeamsFromPlan === null ? 999 : Math.max(0, maxTeams - ownedTeamsCount);
      }

      const subscriptionTier = effectivePlan ?? (user as any).subscription_tier ?? 'free';

      return res.json({
        owned_teams: ownedTeamsCount,
        max_teams: maxTeamsDisplay,
        can_create_more: canCreateMore,
        remaining,
        subscription_tier: subscriptionTier,
        upgrade_required: !canCreateMore,
      });
  })
);

teamsRouter.get(
  '/:id/admin-summary',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      const teamId = String(req.params.id);
      const viewerId = req.user?.id || null;
      if (!viewerId) return res.status(401).json({ error: 'Authentication required' });

      const access = await loadTeamViewerAccess(teamId, viewerId);
      if (!access) return res.status(404).json({ error: 'Team not found' });

      const canManage =
        access.isAdmin || access.isOrgAdmin || isManagementRole(access.membership?.role);
      if (!canManage) {
        return res.status(403).json({
          error: 'Only team staff, league admins, or platform admins can view admin summary',
        });
      }

      const entitlement = await getTeamEntitlementState(prisma, teamId);
      if (entitlement.teamLocked) {
        return res.status(403).json(buildTeamPlanLockedError(entitlement));
      }

      const [memberships, pendingInvites, upcomingGames] = await Promise.all([
        prisma.teamMembership.findMany({
          where: { team_id: teamId, status: 'active' },
          orderBy: { created_at: 'asc' },
          take: 500,
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
                username: true,
                email: true,
                preferences: true,
              },
            },
          },
        }),
        prisma.teamInvite.findMany({
          where: { team_id: teamId, status: 'pending' },
          orderBy: { created_at: 'desc' },
          take: 100,
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            created_at: true,
          },
        }),
        prisma.game.findMany({
          where: {
            approval_status: 'approved',
            date: { gte: new Date() },
            OR: [{ home_team_id: teamId }, { away_team_id: teamId }],
          },
          orderBy: { date: 'asc' },
          take: 20,
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
            home_team: true,
            away_team: true,
            home_team_id: true,
            away_team_id: true,
            approval_status: true,
          },
        }),
      ]);

      const staffCount = memberships.filter(membership =>
        ['owner', 'manager', 'coach', 'assistant_coach'].includes(String(membership.role))
      ).length;

      return res.json({
        team: serializeTeam(access.team, {
          includeCounts: true,
          includeOrganization: true,
          includeViewerState: true,
          viewerRole: access.membership?.role ?? null,
          canManageTeam: canManage,
          isOrgAdmin: access.isOrgAdmin,
        }),
        permissions: {
          can_manage: canManage,
          membership_role: access.membership?.role ?? null,
          via_org_admin: access.isOrgAdmin && !isManagementRole(access.membership?.role),
        },
        counts: {
          members: memberships.length,
          staff: staffCount,
          pending_invites: pendingInvites.length,
          upcoming_games: upcomingGames.length,
        },
        members: memberships.map(member => serializeTeamMember(member, true)),
        pending_invites: pendingInvites.map(invite => ({
          ...invite,
          created_at:
            invite.created_at instanceof Date
              ? invite.created_at.toISOString()
              : String(invite.created_at),
        })),
        upcoming_games: upcomingGames.map(game => ({
          ...game,
          date: game.date instanceof Date ? game.date.toISOString() : String(game.date),
        })),
      });
  })
);

teamsRouter.get(
  '/:id/screen-summary',
  asyncHandler(async (req, res) => {
      const teamId = String(req.params.id);
      const viewerId = (req as AuthedRequest).user?.id ?? null;
      const access = await loadTeamViewerAccess(teamId, viewerId);
      if (!access) return res.status(404).json({ error: 'Team not found' });

      if (!access.isAdmin) {
        const hidden = await isTeamHiddenFromViewer(teamId, viewerId);
        if (hidden) return res.status(404).json({ error: 'Not found' });
      }

      const canManage =
        access.isAdmin || access.isOrgAdmin || isManagementRole(access.membership?.role);

      const [memberships, approvedGames, viewerJoinRequest] = await Promise.all([
        prisma.teamMembership.findMany({
          where: { team_id: teamId, status: 'active' },
          orderBy: { created_at: 'asc' },
          take: 500,
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
                username: true,
                preferences: true,
              },
            },
          },
        }),
        prisma.game.findMany({
          where: {
            approval_status: 'approved',
            OR: [{ home_team_id: teamId }, { away_team_id: teamId }],
          },
          orderBy: { date: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
            home_team: true,
            away_team: true,
            home_team_id: true,
            away_team_id: true,
            approval_status: true,
          },
        }),
        viewerId
          ? prisma.teamJoinRequest.findUnique({
              where: { team_id_user_id: { team_id: teamId, user_id: viewerId } },
              select: { id: true, status: true },
            })
          : Promise.resolve(null),
      ]);

      return res.json({
        team: serializeTeam(access.team, {
          includeCounts: true,
          includeOrganization: true,
          includeViewerState: true,
          viewerRole: access.membership?.role ?? null,
          canManageTeam: canManage,
          isOrgAdmin: access.isOrgAdmin,
          viewerJoinRequestStatus: viewerJoinRequest?.status ?? null,
        }),
        permissions: {
          can_manage: canManage,
          membership_role: access.membership?.role ?? null,
          via_org_admin: access.isOrgAdmin && !isManagementRole(access.membership?.role),
        },
        counts: {
          members: memberships.length,
          games: approvedGames.length,
        },
        members: memberships.map(member => serializeTeamMember(member, false)),
        games: approvedGames.map(game => ({
          ...game,
          date: game.date instanceof Date ? game.date.toISOString() : String(game.date),
        })),
      });
  })
);

// List teams with member counts; optional search q
teamsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
      const q = String((req.query as any).q || '')
        .trim()
        .toLowerCase();
      const all = String((req.query as any).all || '') === '1';
      const mine = String((req.query as any).mine || '') === '1';
      const directory = String((req.query as any).directory || '') === '1'; // Team directory search
      const orgIdFilter = String((req.query as any).organization_id || '').trim() || null;
      const limitRaw = Number.parseInt(String((req.query as any).limit ?? ''), 10);
      const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined;

      if (all) {
        // Admin-only view flag; otherwise fall back to normal list
        const isAdmin = await getIsAdmin(req as any);
        if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
      }

      let where: any = all ? {} : { status: 'active' };
      const currentUserId = (req as AuthedRequest).user?.id ?? null;
      const isAdmin = currentUserId ? await getIsAdmin(req as any) : false;
      const privateTeamExcludeIds =
        !all && !isAdmin ? await getExcludedPrivateTeamIds(currentUserId) : [];
      if (privateTeamExcludeIds.length > 0) {
        where.id = { notIn: privateTeamExcludeIds };
      }

      // Directory search: search across name, city, league, sport
      if (directory && q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
          { league: { contains: q, mode: 'insensitive' } },
          { sport: { contains: q, mode: 'insensitive' } },
        ];
      } else if (q) {
        where.name = { contains: q, mode: 'insensitive' };
      }

      // Filter to only teams where the current user has management roles
      if (mine) {
        const authReq = req as AuthedRequest;
        if (!authReq.user) {
          return res.status(401).json({ error: 'Authentication required to view managed teams' });
        }

        const userId = authReq.user.id;
        const managementRoles = ['owner', 'manager', 'coach', 'assistant_coach'];

        where.memberships = {
          some: {
            user_id: userId,
            role: { in: managementRoles },
            status: MembershipStatus.active,
          },
        };
      }

      // Filter by organization if requested
      if (orgIdFilter) {
        where.organization_id = orgIdFilter;
      }

      const rows = await prisma.team.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: take,
        select: buildTeamSerializeSelect({
          includeCounts: true,
          includeOrganization: true,
        }),
      });
      const teamStateById = new Map(
        (await listTeamStates(rows.map(team => team.id))).map(team => [team.id, team])
      );
      const teamIds = rows.map(team => team.id);
      const [viewerMemberships, followedTeamRows] = await Promise.all([
        currentUserId
          ? prisma.teamMembership.findMany({
              where: {
                user_id: currentUserId,
                status: MembershipStatus.active,
                team_id: { in: teamIds },
              },
              select: { team_id: true, role: true },
              take: Math.max(teamIds.length, 1),
            })
          : Promise.resolve([]),
        currentUserId
          ? prisma.teamFollow.findMany({
              where: { user_id: currentUserId, team_id: { in: teamIds } },
              select: { team_id: true },
              take: Math.max(teamIds.length, 1),
            })
          : Promise.resolve([]),
      ]);
      const viewerRoleByTeamId = new Map(
        viewerMemberships.map(membership => [membership.team_id, membership.role])
      );
      const followedTeamIds = new Set(followedTeamRows.map(row => row.team_id));

      const list = rows.map(team =>
        serializeTeam(
          {
            ...team,
            status: teamStateById.get(team.id)?.status ?? null,
          },
          {
            includeCounts: true,
            includeOrganization: true,
            includeViewerState: true,
            viewerRole: viewerRoleByTeamId.get(team.id) ?? null,
            isFollowing: currentUserId ? followedTeamIds.has(team.id) : null,
          }
        )
      );
      return res.json(list);
  })
);

// Follow a team
teamsRouter.post(
  '/:id/follow',
  requireAuth as any,
  followLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const teamId = String(req.params.id);
      const team = await getTeamState(teamId);
      if (!team) return res.status(404).json({ error: 'Team not found' });
      if (team.status !== 'active') return res.status(404).json({ error: 'Team not found' });
      try {
        await prisma.teamFollow.create({ data: { user_id: userId, team_id: teamId } });

        // Notify team coaches/owners about new follower
        try {
          const follower = await prisma.user.findUnique({
            where: { id: userId },
            select: { display_name: true },
          });
          const followerName = follower?.display_name || 'Someone';

          const managers = await prisma.teamMembership.findMany({
            where: {
              team_id: teamId,
              role: { in: ['owner', 'manager', 'coach'] },
              status: 'active',
              user_id: { not: userId },
            },
            select: { user_id: true },
            take: 100,
          });

          // Batch: create all notifications in one query, send push in parallel
          if (managers.length > 0) {
            await prisma.notification.createMany({
              data: managers.map(mgr => ({
                user_id: mgr.user_id,
                actor_id: userId,
                type: 'TEAM_FOLLOWED',
                meta: { team_id: teamId, team_name: team!.name, follower_name: followerName },
              })),
            });
            await Promise.allSettled(
              managers.map(mgr =>
                sendPushNotification(
                  mgr.user_id,
                  `New follower`,
                  `${followerName} is now following ${team!.name}`,
                  { type: 'team_followed', team_id: teamId, screen: 'team-page' }
                )
              )
            );
          }
        } catch (notifErr) {
          console.error('[teams] Failed to send team followed notification:', notifErr);
        }

        return res.status(201).json({ is_following: true });
      } catch (e: any) {
        if (e?.code === 'P2002') return res.status(201).json({ is_following: true }); // Already following
        throw e;
      }
    } catch (e: any) {
      console.error('[teams] follow error:', e?.message || e);
      return res.status(500).json({ error: 'Failed to follow team' });
    }
  })
);

// Unfollow a team
teamsRouter.delete(
  '/:id/follow',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const teamId = String(req.params.id);
      await prisma.teamFollow.deleteMany({ where: { user_id: userId, team_id: teamId } });
      return res.json({ is_following: false });
    } catch (e: any) {
      console.error('[teams] unfollow error:', e?.message || e);
      return res.status(500).json({ error: 'Failed to unfollow team' });
    }
  })
);

// Team details with counts
teamsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const currentUserId = (req as AuthedRequest).user?.id ?? null;
      const t = await prisma.team.findUnique({
        where: { id },
        select: buildTeamSerializeSelect({
          includeCounts: true,
          includeOrganization: true,
        }),
      });
      if (!t) return res.status(404).json({ error: 'Not found' });
      const teamState = await getTeamState(id);
      const isAdmin = currentUserId ? await getIsAdmin(req as any) : false;
      if (!isAdmin) {
        const hidden = await isTeamHiddenFromViewer(id, currentUserId);
        if (hidden) return res.status(404).json({ error: 'Not found' });
      }

      let membership: { role: string } | null = null;
      let isOrgAdmin = false;
      if (currentUserId) {
        const [resolvedMembership, orgMembership] = await Promise.all([
          prisma.teamMembership.findFirst({
            where: { team_id: id, user_id: currentUserId, status: 'active' },
            select: { role: true },
          }),
          t.organization_id
            ? prisma.organizationMembership.findFirst({
                where: {
                  organization_id: t.organization_id,
                  user_id: currentUserId,
                  role: { in: ['owner', 'manager'] },
                  status: 'active',
                },
                select: { id: true },
              })
            : Promise.resolve(null),
        ]);
        membership = resolvedMembership;
        isOrgAdmin = !!orgMembership;

        const hasPrivilegedAccess = !!isAdmin || isOrgAdmin || isManagementRole(membership?.role);
        if (hasPrivilegedAccess) {
          const entitlement = await getTeamEntitlementState(prisma, id);
          if (entitlement.teamLocked) {
            return res.status(403).json(buildTeamPlanLockedError(entitlement));
          }
        }
      }

      const isFollowing = currentUserId
        ? !!(await prisma.teamFollow.findFirst({ where: { user_id: currentUserId, team_id: id } }))
        : null;

      return res.json(
        serializeTeam(
          {
            ...t,
            status: teamState?.status ?? null,
          },
          {
            includeCounts: true,
            includeOrganization: true,
            includeViewerState: true,
            isFollowing,
            viewerRole: membership?.role ?? null,
            canManageTeam: isManagementRole(membership?.role) || isOrgAdmin,
            isOrgAdmin,
          }
        )
      );
  })
);

// Team members list (auth required — roster visibility)
// Restricted to team members, org admins (owner/manager), or platform admins
teamsRouter.get(
  '/:id/members',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const team = await prisma.team.findUnique({
        where: { id },
        select: { id: true, organization_id: true, is_private: true },
      });
      if (!team) return res.status(404).json({ error: 'Team not found' });

      const isAdmin = await getIsAdmin(req as any);
      const teamMembership = await prisma.teamMembership.findFirst({
        where: { team_id: id, user_id: req.user!.id, status: 'active' },
        select: { id: true, role: true },
      });
      let isOrgAdmin = false;
      if (team.organization_id) {
        const orgMembership = await prisma.organizationMembership.findFirst({
          where: {
            organization_id: team.organization_id,
            user_id: req.user!.id,
            role: { in: ['owner', 'manager'] },
            status: 'active',
          },
          select: { id: true },
        });
        isOrgAdmin = !!orgMembership;
      }
      if (!isAdmin && !teamMembership && !isOrgAdmin) {
        return res.status(403).json({
          error: 'Only team members, league admins, or platform admins can view the roster',
        });
      }

      if (isAdmin || isOrgAdmin || isManagementRole(teamMembership?.role)) {
        const entitlement = await getTeamEntitlementState(prisma, id);
        if (entitlement.teamLocked) {
          return res.status(403).json(buildTeamPlanLockedError(entitlement));
        }
      }

      const mems = await prisma.teamMembership.findMany({
        where: { team_id: id },
        orderBy: { created_at: 'asc' },
        take: 500,
        include: {
          user: {
            select: {
              id: true,
              display_name: true,
              avatar_url: true,
              username: true,
              preferences: true,
            },
          },
        },
      });
      const list = mems.map(m => {
        const user = (m as any).user;
        const prefs = (user?.preferences || {}) as any;
        return {
          id: m.id,
          role: m.role,
          status: m.status,
          position: (m as any).custom_position || null,
          jersey_number: prefs?.jersey_number || null,
          user: {
            id: m.user_id,
            display_name: user?.display_name || null,
            avatar_url: user?.avatar_url || null,
            username: user?.username || null,
            is_parent: prefs?.is_parent === true,
          },
        };
      });
      return res.json(list);
  })
);

// All members across teams (admin screens). Paged and DB-filtered to avoid unbounded scans.
teamsRouter.get(
  '/members/all',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      const isAdmin = await getIsAdmin(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

      const q = String((req.query as any).q || '').trim();
      const limitRaw = Number.parseInt(String((req.query as any).limit || '100'), 10);
      const offsetRaw = Number.parseInt(String((req.query as any).offset || '0'), 10);
      const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 100;
      const skip = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

      const where = q
        ? {
            OR: [
              { user: { display_name: { contains: q, mode: 'insensitive' as const } } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
              { team: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {};

      const mems = await prisma.teamMembership.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: skip,
        take: take,
        select: {
          id: true,
          role: true,
          status: true,
          user_id: true,
          team_id: true,
          user: {
            select: {
              id: true,
              email: true,
              display_name: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const list = mems.map(m => ({
        id: m.id,
        role: m.role,
        status: m.status,
        user: {
          id: m.user_id,
          email: m.user?.email || '',
          display_name: m.user?.display_name || '',
        },
        team: { id: m.team_id, name: m.team?.name || '' },
      }));

      return res.json(list);
  })
);

// Create team (auth required). Creator becomes owner.
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  organization_id: z.string().min(1, 'Organization is required'),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  onboarding: z.boolean().optional(),
});
async function createTeamWithGuardrails(userId: string, data: TeamCreatePayload) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      onboarding_completed: true,
      preferences: true,
      approval_status: true,
      paid_by_owner: true,
      plan: true,
      pending_plan: true,
      payment_pending: true,
      payment_approved: true,
    },
  });
  if (!me) return { status: 401, body: { error: 'Unauthorized' } };

  const canonicalRole = getCanonicalUserRole(me as any);
  const onboardingComplete = isUserOnboardingComplete(me as any);
  const isCoach = canonicalRole === 'coach';

  if (!isCoach) {
    const hasCoachRole = await prisma.teamMembership.findFirst({
      where: {
        user_id: userId,
        role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
        status: 'active',
      },
    });
    const hasOrgRole = await prisma.organizationMembership.findFirst({
      where: {
        user_id: userId,
        role: { in: ['owner', 'manager'] },
        status: 'active',
      },
      select: { id: true },
    });

    if (!hasCoachRole && !hasOrgRole) {
      return {
        status: 403,
        body: {
          error: 'COACH_ROLE_REQUIRED',
          message: 'Only coach accounts can create teams.',
          code: 'COACH_ROLE_REQUIRED',
        },
      };
    }
  }

  if (isCoach && me.approval_status !== 'APPROVED') {
    const isOrgOwner = await prisma.organizationMembership.findFirst({
      where: { user_id: userId, role: 'owner', status: 'active' },
      select: { id: true },
    });
    if (!(Boolean(isOrgOwner) && !onboardingComplete)) {
      return {
        status: 403,
        body: {
          error: 'APPROVAL_REQUIRED',
          message: 'Your coach account must be approved by a league admin before creating teams.',
          code: 'APPROVAL_REQUIRED',
        },
      };
    }
  }

  const billingContext = await buildTeamCreateBillingContext(userId, me);
  const effectivePlan = billingContext.effectivePlan;
  const clubType = data.club_type || 'sport';

  if (clubType === 'extracurricular' && !planSupportsExtracurricular(effectivePlan)) {
    return {
      status: 403,
      body: {
        error: 'Extracurricular clubs require Legend tier',
        message:
          'Upgrade to Legend ($19.99/year) to create extracurricular clubs like Theater, Chess, Debate, etc.',
        code: 'LEGEND_TIER_REQUIRED',
        feature: 'extracurricular_clubs',
      },
    };
  }

  const currentTeamCount = await countTeamsForBillingContext(prisma, userId, billingContext);
  if (effectivePlan === 'rookie' || !effectivePlan) {
    if (currentTeamCount >= SERVER_ROOKIE_TEAM_LIMIT) {
      return {
        status: 403,
        body: {
          error: 'Team limit reached',
          message: me.paid_by_owner
            ? `Your organization has reached the free limit (${SERVER_ROOKIE_TEAM_LIMIT} teams). The league owner needs to upgrade.`
            : `You've reached your free limit (${SERVER_ROOKIE_TEAM_LIMIT} teams). Upgrade to add more.`,
          code: 'TEAM_LIMIT_EXCEEDED',
          limit: SERVER_ROOKIE_TEAM_LIMIT,
          current: currentTeamCount,
        },
      };
    }
  } else if (effectivePlan === 'veteran') {
    const subscriptionId = billingContext.effectiveSubscriptionId;
    if (!subscriptionId) {
      return {
        status: 403,
        body: {
          error: 'No active subscription',
          message: me.paid_by_owner
            ? 'The league owner needs an active Veteran subscription.'
            : 'Veteran plan requires an active subscription. Please update your billing settings.',
          code: 'NO_ACTIVE_SUBSCRIPTION',
        },
      };
    }

    try {
      const allowance = await getVeteranSubscriptionAllowance(subscriptionId);
      if (!allowance.active) {
        return {
          status: 403,
          body: {
            error: 'Subscription not active',
            message: me.paid_by_owner
              ? "The league owner's Veteran subscription is not active."
              : 'Your Veteran subscription is not active. Please update your billing settings.',
            code: 'SUBSCRIPTION_NOT_ACTIVE',
          },
        };
      }

      if (currentTeamCount >= allowance.totalTeamAllowance) {
        return {
          status: 403,
          body: {
            error: 'Team limit reached',
            message: me.paid_by_owner
              ? `The organization's subscription currently covers ${allowance.totalTeamAllowance} total team${allowance.totalTeamAllowance === 1 ? '' : 's'}. The league owner needs to update billing before creating another team.`
              : `Your subscription currently covers ${allowance.totalTeamAllowance} total team${allowance.totalTeamAllowance === 1 ? '' : 's'}. Update billing before creating another team.`,
            code: 'SUBSCRIPTION_QUANTITY_EXCEEDED',
            paid_quantity: allowance.billableQuantity,
            allowed_total_teams: allowance.totalTeamAllowance,
            current_teams: currentTeamCount,
          },
        };
      }
    } catch (err) {
      console.error('[Teams] Failed to verify Veteran subscription:', err);
      return {
        status: 500,
        body: {
          error: 'Subscription verification failed',
          message: 'Unable to verify your subscription. Please try again or contact support.',
        },
      };
    }
  }

  const resolvedOrganization = await resolveOrganizationIdForTeamCreate(data);
  if ('status' in resolvedOrganization) {
    return resolvedOrganization;
  }

  const organizationAccess = await validateTeamCreateOrganizationAccess(
    me.id,
    resolvedOrganization.organizationId,
    onboardingComplete
  );
  if ('status' in organizationAccess) {
    return organizationAccess;
  }

  const organizationId = resolvedOrganization.organizationId;

  try {
    const team = await prisma.$transaction(
      async tx => {
        const ownedTeamsInTx = await countTeamsForBillingContext(tx, me.id, billingContext);

        if (effectivePlan === 'rookie' || !effectivePlan) {
          if (ownedTeamsInTx >= SERVER_ROOKIE_TEAM_LIMIT) {
            throw Object.assign(new Error('Team limit reached'), {
              status: 403,
              body: {
                error: 'Team limit reached',
                message: me.paid_by_owner
                  ? `Your organization has reached the free limit (${SERVER_ROOKIE_TEAM_LIMIT} teams). The league owner needs to upgrade.`
                  : `You've reached your free limit (${SERVER_ROOKIE_TEAM_LIMIT} teams). Upgrade to add more.`,
                code: 'TEAM_LIMIT_EXCEEDED',
                limit: SERVER_ROOKIE_TEAM_LIMIT,
                current: ownedTeamsInTx,
              },
            });
          }
        } else if (effectivePlan === 'veteran') {
          const subscriptionId = billingContext.effectiveSubscriptionId;
          if (!subscriptionId) {
            throw Object.assign(new Error('No active subscription'), {
              status: 403,
              body: {
                error: 'No active subscription',
                message: me.paid_by_owner
                  ? 'The league owner needs an active Veteran subscription.'
                  : 'Veteran plan requires an active subscription. Please update your billing settings.',
                code: 'NO_ACTIVE_SUBSCRIPTION',
              },
            });
          }

          try {
            const allowance = await getVeteranSubscriptionAllowance(subscriptionId);
            if (!allowance.active) {
              throw Object.assign(new Error('Subscription not active'), {
                status: 403,
                body: {
                  error: 'Subscription not active',
                  message: me.paid_by_owner
                    ? "The league owner's Veteran subscription is not active."
                    : 'Your Veteran subscription is not active. Please update your billing settings.',
                  code: 'SUBSCRIPTION_NOT_ACTIVE',
                },
              });
            }
            if (ownedTeamsInTx >= allowance.totalTeamAllowance) {
              throw Object.assign(new Error('Team limit reached'), {
                status: 403,
                body: {
                  error: 'Team limit reached',
                  message: me.paid_by_owner
                    ? `The organization's subscription currently covers ${allowance.totalTeamAllowance} total team${allowance.totalTeamAllowance === 1 ? '' : 's'}. The league owner needs to update billing before creating another team.`
                    : `Your subscription currently covers ${allowance.totalTeamAllowance} total team${allowance.totalTeamAllowance === 1 ? '' : 's'}. Update billing before creating another team.`,
                  code: 'SUBSCRIPTION_QUANTITY_EXCEEDED',
                  paid_quantity: allowance.billableQuantity,
                  allowed_total_teams: allowance.totalTeamAllowance,
                  current_teams: ownedTeamsInTx,
                },
              });
            }
          } catch (err: any) {
            if (err?.status && err?.body) throw err;
            throw Object.assign(new Error('Subscription verification failed'), {
              status: 500,
              body: {
                error: 'Subscription verification failed',
                message: 'Unable to verify your subscription. Please try again or contact support.',
              },
            });
          }
        }

        const newTeam = await tx.team.create({
          data: {
            name: stripHtml(data.name.trim()),
            description: data.description ? stripHtml(data.description.trim()) : null,
            sport: data.sport ? stripHtml(data.sport.trim()) : null,
            club_type: data.club_type || 'sport',
            extracurricular_category: data.extracurricular_category?.trim() || null,
            season: data.season?.trim() || null,
            primary_color: data.primary_color?.trim() || null,
            season_start: data.season_start ? new Date(data.season_start) : null,
            season_end: data.season_end ? new Date(data.season_end) : null,
            organization_id: organizationId,
            logo_url: data.logo_url || null,
            city: data.city ? stripHtml(data.city.trim()) : null,
            state: data.state ? stripHtml(data.state.trim()) : null,
            league: data.league ? stripHtml(data.league.trim()) : null,
            venue_place_id: data.venue_place_id || null,
            venue_lat: data.venue_lat || null,
            venue_lng: data.venue_lng || null,
            venue_address: data.venue_address ? stripHtml(data.venue_address.trim()) : null,
          },
          select: {
            id: true,
            name: true,
            description: true,
            organization_id: true,
            season_start: true,
            season_end: true,
            logo_url: true,
            avatar_url: true,
          },
        });

        await tx.teamMembership.create({
          data: {
            team_id: newTeam.id,
            user_id: me.id,
            role: 'owner',
            status: 'active',
          },
        });

        return { ...newTeam, status: 'active' as const };
      },
      { isolationLevel: 'Serializable' }
    );

    if (
      data.authorized_users &&
      Array.isArray(data.authorized_users) &&
      data.authorized_users.length > 0
    ) {
      try {
        const validInviteRoles = new Set([
          'manager',
          'coach',
          'assistant_coach',
          'player',
          'parent',
          'member',
          'equipment',
          'health_wellness',
        ]);
        const invites = data.authorized_users
          .filter(user => user.email)
          .map(user => {
            const requestedRole = String(user.role || 'member');
            return {
              team_id: team.id,
              email: user.email!,
              role: (validInviteRoles.has(requestedRole) ? requestedRole : 'member') as any,
            };
          });

        if (invites.length > 0) {
          await prisma.teamInvite.createMany({
            data: invites,
            skipDuplicates: true,
          });

          try {
            const [inviter, createdInvites] = await Promise.all([
              prisma.user.findUnique({ where: { id: me.id }, select: { display_name: true } }),
              prisma.teamInvite.findMany({
                where: { team_id: team.id, email: { in: invites.map(invite => invite.email) } },
                select: { id: true, email: true },
                take: invites.length,
              }),
            ]);
            const tokenByEmail = Object.fromEntries(
              createdInvites.map(invite => [invite.email, invite.id])
            );
            await Promise.all(
              invites.map(async invite => {
                try {
                  await sendTeamInviteEmail({
                    to: invite.email,
                    teamName: team.name,
                    organizationName: null,
                    role: invite.role,
                    inviterName: inviter?.display_name || 'Team Owner',
                    teamHeroUrl: team.logo_url || undefined,
                    teamLogoUrl: team.avatar_url || undefined,
                    inviteToken: tokenByEmail[invite.email],
                  });
                } catch (error) {
                  console.warn('[Teams] Failed to send team invite email:', error);
                }
              })
            );
          } catch (emailError) {
            console.warn('[Teams] Failed to send invite emails (non-blocking):', emailError);
          }
        }
      } catch (inviteError: any) {
        console.warn('[Teams] Failed to create invites (non-blocking):', inviteError);
      }
    }

    return { team };
  } catch (teamError: any) {
    if (teamError?.status && teamError?.body) {
      return { status: teamError.status, body: teamError.body };
    }
    console.error('[Teams] Failed to create team:', teamError);
    return { status: 500, body: { error: 'Team creation failed' } };
  }
}

teamsRouter.post(
  '/',
  requireVerified as any,
  requireOnboarded as any,
  requirePlan('rookie') as any,
  teamCreationLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    const result = await createTeamWithGuardrails(req.user!.id, {
      ...parsed.data,
      club_type: 'sport',
    });
    if ('status' in result) {
      return res.status(result.status).json(result.body);
    }

    return res.status(201).json(result.team);
  })
);

// Update team (auth required). Only owners/admins can update.
// Accept full URLs or relative paths (uploads return .path) or empty string to clear
const logoUrlString = z.union([
  z.string().url(),
  z
    .string()
    .regex(/^\/uploads\//)
    .optional()
    .or(z.string()),
  z.literal(''),
]);
const TEAM_LOGO_URL_VALIDATOR = z
  .string()
  .url({ message: 'logo_url must be a valid URL' })
  .refine(
    url => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const allowed = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app'];
        return allowed.some(d => parsed.hostname.endsWith(d));
      } catch {
        return false;
      }
    },
    { message: 'logo_url must be an HTTPS Cloudinary or VarsityHub CDN URL' }
  )
  .optional()
  .or(z.literal(''));

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  sport: z.string().trim().max(100).optional(),
  season: z.string().trim().optional(),
  // v1.0.2: season dates are now editable after team creation.
  // Previously missing from updateSchema so coaches were stuck with the initial dates.
  season_start: z.string().optional().nullable(),
  season_end: z.string().optional().nullable(),
  organization_id: z.string().optional(),
  logo_url: TEAM_LOGO_URL_VALIDATOR,
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  league: z.string().max(100).optional(),
  venue_place_id: z.string().optional(),
  venue_lat: z.number().optional(),
  venue_lng: z.number().optional(),
  venue_address: z.string().optional(),
  is_private: z.boolean().optional(),
});
teamsRouter.put(
  '/:id',
  requireVerified as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    debugLog('[Teams PUT] Received update request:', JSON.stringify(req.body));
    // req.user is guaranteed by requireVerified middleware
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[Teams PUT] Validation failed:', JSON.stringify(parsed.error));
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    const teamId = String(req.params.id);
    const team = await getTeamState(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const isAdmin = await getIsAdmin(req as any);
    const canManage = await canManageTeamScoped(req.user.id, teamId);
    if (!isAdmin && !canManage) {
      return res.status(403).json({
        error:
          'Only team staff, organization admins, or platform admins can update team information',
      });
    }

    const entitlement = await getTeamEntitlementState(prisma, teamId);
    if (entitlement.teamLocked) {
      return res.status(403).json(buildTeamPlanLockedError(entitlement));
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) {
      updateData.name = stripHtml(parsed.data.name);
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description
        ? stripHtml(parsed.data.description)
        : parsed.data.description;
    }
    if (parsed.data.sport !== undefined) updateData.sport = parsed.data.sport ? stripHtml(parsed.data.sport) : null;
    if (parsed.data.season !== undefined) updateData.season = parsed.data.season;
    // v1.0.2: season date edits
    if (parsed.data.season_start !== undefined) {
      updateData.season_start = parsed.data.season_start
        ? new Date(parsed.data.season_start)
        : null;
    }
    if (parsed.data.season_end !== undefined) {
      updateData.season_end = parsed.data.season_end ? new Date(parsed.data.season_end) : null;
    }
    if (parsed.data.organization_id !== undefined) {
      const targetOrganizationId = parsed.data.organization_id;
      const targetOrg = await prisma.organization.findUnique({
        where: { id: targetOrganizationId },
        select: { id: true },
      });
      if (!targetOrg) {
        return res.status(400).json({ error: 'Target organization not found or inactive' });
      }

      if (
        targetOrganizationId !== team.organization_id &&
        !(await isOrganizationApproved(targetOrganizationId, prisma))
      ) {
        return res.status(403).json({
          error: 'ORGANIZATION_NOT_APPROVED',
          message:
            'Teams can only be moved under organizations that have been approved by VarsityHub.',
          code: 'ORGANIZATION_NOT_APPROVED',
        });
      }

      // Moving a team across organizations is stronger than ordinary team edits:
      // the requester must control the team on the source side AND be an org admin
      // on the destination side. Plain membership in the target org is not enough.
      if (!isAdmin && targetOrganizationId !== team.organization_id) {
        const sourceTeamMembership = await prisma.teamMembership.findUnique({
          where: {
            team_id_user_id: {
              team_id: teamId,
              user_id: req.user.id,
            },
          } as any,
          select: { role: true, status: true },
        });
        const canAdminSourceOrg = team.organization_id
          ? await isOrgAdminScoped(req.user.id, team.organization_id)
          : false;
        const canControlSourceTeam =
          (sourceTeamMembership?.status === 'active' &&
            (sourceTeamMembership.role === 'owner' || sourceTeamMembership.role === 'manager')) ||
          canAdminSourceOrg;
        if (!canControlSourceTeam) {
          return res.status(403).json({
            error: 'TEAM_TRANSFER_ADMIN_REQUIRED',
            message:
              'Only the team owner, a team manager, or a league admin can move a team to another organization.',
          });
        }

        const canAdminTargetOrg = await isOrgAdminScoped(req.user.id, targetOrganizationId);
        if (!canAdminTargetOrg) {
          return res.status(403).json({
            error: 'ORGANIZATION_ADMIN_REQUIRED',
            message:
              'You must be an owner or manager of the target organization to move this team.',
          });
        }
      }

      updateData.organization_id = targetOrganizationId;
    }
    if (parsed.data.logo_url !== undefined)
      updateData.logo_url = parsed.data.logo_url === '' ? null : parsed.data.logo_url;

    // Venue fields
    if (parsed.data.city !== undefined)
      updateData.city = parsed.data.city ? stripHtml(parsed.data.city) : parsed.data.city;
    if (parsed.data.state !== undefined)
      updateData.state = parsed.data.state ? stripHtml(parsed.data.state) : parsed.data.state;
    if (parsed.data.league !== undefined)
      updateData.league = parsed.data.league ? stripHtml(parsed.data.league) : parsed.data.league;
    if (parsed.data.venue_place_id !== undefined) {
      updateData.venue_place_id = parsed.data.venue_place_id;
      updateData.venue_updated_at = new Date();
    }
    if (parsed.data.venue_lat !== undefined) updateData.venue_lat = parsed.data.venue_lat;
    if (parsed.data.venue_lng !== undefined) updateData.venue_lng = parsed.data.venue_lng;
    if (parsed.data.venue_address !== undefined)
      updateData.venue_address = parsed.data.venue_address
        ? stripHtml(parsed.data.venue_address)
        : parsed.data.venue_address;
    if (parsed.data.is_private !== undefined) updateData.is_private = parsed.data.is_private;

    debugLog('[Teams PUT] Prepared update data:', JSON.stringify(updateData));

    try {
      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: updateData as any,
        select: {
          id: true,
          name: true,
          description: true,
          sport: true,
          is_private: true,
          season_start: true,
          season_end: true,
          organization_id: true,
          logo_url: true,
          avatar_url: true,
          created_at: true,
          organization: {
            select: {
              id: true,
              name: true,
              description: true,
              sport: true,
            },
          },
        },
      });
      debugLog('[Teams PUT] Update successful');
      // Return a compact team object including organization and logo/avatar fields for client convenience
      return res.json({
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        sport: updatedTeam.sport,
        is_private: (updatedTeam as any).is_private ?? false,
        season_start: updatedTeam.season_start,
        season_end: updatedTeam.season_end,
        organization_id: updatedTeam.organization_id,
        organization: updatedTeam.organization
          ? {
              id: updatedTeam.organization.id,
              name: updatedTeam.organization.name,
              description: updatedTeam.organization.description,
              sport: updatedTeam.organization.sport,
            }
          : null,
        logo_url: (updatedTeam as any).logo_url || null,
        avatar_url: (updatedTeam as any).avatar_url || null,
        status: team.status,
        created_at: updatedTeam.created_at,
      });
    } catch (err: any) {
      console.error('[teams] update error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  })
);

// Delete team (auth required). Only owners/admins can delete.
teamsRouter.delete(
  '/:id',
  requireVerified as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    // req.user is guaranteed by requireVerified middleware

    const teamId = String(req.params.id);
    const team = await getTeamState(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    // Team staff OR org admin can archive. Using the shared helper keeps this
    // route's boundary consistent with team update, event approval, and the
    // rest of the team-scoped endpoints — previously this check was inline and
    // missed the org-admin fallback, blocking league owners from archiving
    // teams inside their own league.
    const isAdmin = await getIsAdmin(req as any);
    const canManage = await canManageTeamScoped(req.user.id, teamId);
    if (!isAdmin && !canManage) {
      return res.status(403).json({
        error: 'Only team staff or league admins can delete teams',
      });
    }
    if (team.status !== 'active') {
      return res.json({ ok: true, archived: true, already_archived: true });
    }

    try {
      // Archive the team instead of deleting it so historical games/events/posts
      // keep a resolvable team reference instead of degrading into null orphans.
      await prisma.$transaction([
        prisma.teamMembership.deleteMany({ where: { team_id: teamId } }),
        prisma.teamInvite.deleteMany({ where: { team_id: teamId } }),
        prisma.teamFollow.deleteMany({ where: { team_id: teamId } }),
        // Team-scoped chats should no longer appear as team chats after archival.
        prisma.groupChat.updateMany({ where: { team_id: teamId }, data: { team_id: null } }),
        prisma.team.update({
          where: { id: teamId },
          data: { status: 'archived' },
          select: { id: true },
        }),
      ]);

      return res.json({ ok: true, archived: true, message: 'Team archived successfully' });
    } catch (err: any) {
      console.error('[teams] delete error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  })
);

// Dev helper: update just the logo_url of a team (useful for testing uploads quickly)
if (process.env.NODE_ENV !== 'production') {
  teamsRouter.post(
    '/:id/dev-set-logo',
    requireAuth as any,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const { logo_url } = req.body || {};
      try {
        const t = await prisma.team.update({
          where: { id },
          data: { logo_url: logo_url === '' ? null : logo_url } as any,
          select: { id: true, logo_url: true },
        });
        return res.json({ ok: true, team: { id: t.id, logo_url: (t as any).logo_url } });
      } catch (e: any) {
        console.error('dev-set-logo failed', e?.message || e);
        return res.status(500).json({ error: 'Internal server error' });
      }
    })
  );
}

// Enhanced create team for onboarding
const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  club_type: z.enum(['sport', 'extracurricular']).optional(),
  extracurricular_category: z.string().max(100).optional(),
  season: z.string().max(50).optional(),
  primary_color: z.string().max(20).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  organization_id: z.string().optional(),
  organization_name: z.string().max(255).optional(),
  logo_url: TEAM_LOGO_URL_VALIDATOR,
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  league: z.string().max(100).optional(),
  venue_place_id: z.string().optional(),
  venue_lat: z.number().optional(),
  venue_lng: z.number().optional(),
  venue_address: z.string().optional(),
  authorized_users: z
    .array(
      z.object({
        email: z.string().email().optional(),
        user_id: z.string().optional(),
        role: z.string().optional(),
        assign_team: z.string().optional(),
      })
    )
    .optional(),
  onboarding: z.boolean().optional(),
});

teamsRouter.post(
  '/create',
  requireVerified as any,
  requireOnboarded as any,
  requirePlan('rookie') as any,
  teamCreationLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }
    const result = await createTeamWithGuardrails(req.user!.id, parsed.data);
    if ('status' in result) {
      return res.status(result.status).json(result.body);
    }

    return res.status(201).json({
      ok: true,
      team: {
        id: result.team.id,
        name: result.team.name,
        organization_id: result.team.organization_id,
      },
    });
  })
);

// Invite user by email to a team
const inviteSchema = z.object({ email: z.string().email(), role: z.string().optional() });
const VALID_TEAM_INVITE_ROLES = [
  'manager',
  'coach',
  'assistant_coach',
  'player',
  'parent',
  'member',
  'equipment',
  'health_wellness',
] as const;
teamsRouter.post(
  '/:id/invite',
  requireAuth as any,
  requireVerified as any,
  requireOnboarded as any,
  inviteLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const id = String(req.params.id);
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }
    const { email, role } = parsed.data;
    const inviteEmail = email.trim().toLowerCase();
    const assignedRole = String(role || 'member');
    if (!(VALID_TEAM_INVITE_ROLES as readonly string[]).includes(assignedRole)) {
      return res.status(400).json({
        error: 'Invalid role',
        valid_roles: VALID_TEAM_INVITE_ROLES,
      });
    }
    const team = await prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, logo_url: true, avatar_url: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // CRITICAL: Verify requester is team owner/manager/coach (can invite members)
    const canManage = await canManageTeamScoped(req.user.id, id);

    if (!canManage) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Only team staff or organization admins can invite members to teams.',
      });
    }

    // Role-tier guard (single source of truth). canManage above admits
    // coaches/assistant_coaches, who must NOT be able to invite at manager level.
    if (!(await canAssignTeamRoleScoped(req.user.id, id, assignedRole))) {
      return res.status(403).json({
        error: 'INSUFFICIENT_ROLE',
        message: 'Only team owners can invite at manager level.',
      });
    }

    // PLAN LIMITS: Enforce authorized user caps based on TEAM OWNER's plan (Rule B).
    // Authorized users are covered by the coach's plan — never charged individually.
    // CRITICAL: Use transaction to prevent race condition bypassing user limits.
    let invite;
    try {
      // Create invite within transaction to prevent race conditions
      invite = await prisma.$transaction(async tx => {
        const entitlement = await getTeamEntitlementState(tx, id);
        if (entitlement.teamLocked) {
          throw new Error('TEAM_PLAN_LOCKED');
        }

        const existingInvite = await tx.teamInvite.findFirst({
          where: {
            team_id: id,
            email: { equals: inviteEmail, mode: 'insensitive' },
          } as any,
          select: { id: true },
        });

        if (isAuthorizedTeamRole(assignedRole)) {
          const limit = entitlement.maxAuthorizedUsers;
          if (limit !== null) {
            // Count atomically within transaction
            const inviteCount = await tx.teamInvite.count({
              where: {
                team_id: id,
                status: 'pending',
                ...(existingInvite ? { id: { not: existingInvite.id } } : {}),
              },
            });
            const memberCount = await tx.teamMembership.count({
              where: {
                team_id: id,
                status: 'active',
                role: { in: [...TEAM_AUTHORIZED_ROLES] as any },
              },
            });
            const totalAuthorized = inviteCount + memberCount + 1;

            if (totalAuthorized > limit) {
              throw new Error(`USER_LIMIT_REACHED:${limit}`);
            }
          }
        }

        if (existingInvite) {
          return await tx.teamInvite.update({
            where: { id: existingInvite.id },
            data: { email: inviteEmail, role: assignedRole as any, status: 'pending' },
          });
        }

        // Create invite within same transaction
        return await tx.teamInvite.create({
          data: { team_id: id, email: inviteEmail, role: assignedRole as any, status: 'pending' },
        });
      });
    } catch (e: any) {
      if (e?.message === 'TEAM_PLAN_LOCKED') {
        const entitlement = await getTeamEntitlementState(prisma, id);
        return res.status(403).json(buildTeamPlanLockedError(entitlement));
      }
      // Handle specific limit errors
      if (e?.message?.includes('USER_LIMIT_REACHED')) {
        const [, rawLimit] = e.message.split(':');
        const limit = Number.parseInt(String(rawLimit || ''), 10);
        return res.status(403).json({
          error: 'USER_LIMIT_REACHED',
          code: 'USER_LIMIT_REACHED',
          message: Number.isFinite(limit)
            ? `Plan limit reached for authorized users. This team allows ${limit} authorized user${limit === 1 ? '' : 's'}.`
            : 'Plan limit reached for authorized users.',
        });
      }

      console.warn('[teams][invite-limit] check failed', e);
      return res.status(500).json({
        error: 'Failed to create invite',
        message: 'Unable to create team invite. Please try again.',
      });
    }
    // Send invite email (best effort)
    const inviter = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { display_name: true },
    });
    try {
      await sendTeamInviteEmail({
        to: inviteEmail,
        teamName: team.name,
        organizationName: null,
        role: assignedRole,
        teamHeroUrl: team.logo_url || undefined,
        teamLogoUrl: team.avatar_url || undefined,
        inviterName: inviter?.display_name || 'Team Owner',
        inviteToken: invite.id,
      });
    } catch (err) {
      console.error('Failed to send team invite email:', err);
    }

    // Find the invited user by email and create notification if they exist
    const invitedUser = await prisma.user.findFirst({
      where: { email: { equals: inviteEmail, mode: 'insensitive' } } as any,
      select: { id: true, preferences: true },
    });
    if (invitedUser) {
      try {
        await prisma.notification.create({
          data: {
            user_id: invitedUser.id,
            actor_id: req.user.id,
            type: 'TEAM_INVITE',
            meta: {
              team_id: team.id,
              team_name: team.name,
              invite_id: invite.id,
              role: assignedRole,
            },
          },
        });
        // Push notification (respect team_updates preference)
        const prefs = (invitedUser.preferences || {}) as any;
        if (prefs?.notifications?.team_updates !== false) {
          const inviterName = inviter?.display_name || 'A coach';
          sendPushNotification(
            invitedUser.id,
            `${inviterName} invited you to join ${team.name}`,
            'Tap to view',
            {
              type: 'team_invite',
              actor_id: req.user.id,
              team_id: team.id,
              invite_id: invite.id,
              screen: 'team-invites',
            }
          ).catch(err => {
            console.warn('[teams] team invite push failed:', (err as any)?.message || err);
          });
        }
      } catch (error) {
        console.error('Failed to create team invite notification:', error);
        // Continue even if notification fails
      }
    }

    return res.status(201).json(invite);
  })
);

// List invites for the authed user's email
teamsRouter.get(
  '/invites/me',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user?.email) return res.status(400).json({ error: 'User email not found' });
      const invites = await prisma.teamInvite.findMany({
        where: { email: { equals: user.email, mode: 'insensitive' }, status: 'pending' } as any,
        include: { team: true },
        orderBy: { created_at: 'desc' },
        take: 100,
      });
      const list = invites.map(i => ({
        id: i.id,
        role: i.role,
        created_at: i.created_at,
        team: { id: i.team_id, name: (i as any).team?.name || '' },
      }));
      return res.json(list);
  })
);

teamsRouter.post(
  '/:id/invites/:inviteId/cancel',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      const teamId = String(req.params.id);
      const inviteId = String(req.params.inviteId);
      const userId = req.user?.id || null;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const invite = await prisma.teamInvite.findUnique({
        where: { id: inviteId },
        select: { id: true, team_id: true, status: true },
      });
      if (!invite || invite.team_id !== teamId) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      const canManage = await canManageTeamScoped(userId, teamId);
      if (!canManage) {
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only team staff or organization admins can cancel invites.',
        });
      }

      const updated = await prisma.teamInvite.updateMany({
        where: { id: inviteId, team_id: teamId, status: 'pending' },
        data: { status: 'revoked' },
      });
      if (updated.count === 0) {
        return res.status(409).json({ error: 'Invite already processed' });
      }

      return res.json({
        ok: true,
        invite: {
          id: inviteId,
          status: 'revoked',
        },
      });
  })
);

// Accept invite
teamsRouter.post(
  '/invites/:inviteId/accept',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const inviteId = String(req.params.inviteId);
      const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.status !== 'pending')
        return res.status(404).json({ error: 'Invite not found' });
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase())
        return res.status(403).json({ error: 'Invite not for this user' });
      const existingMembership = await prisma.teamMembership.findUnique({
        where: {
          team_id_user_id: {
            team_id: invite.team_id,
            user_id: user.id,
          } as any,
        },
      });
      try {
        const accepted = await prisma.$transaction(
          async tx => {
            const currentMembership = await tx.teamMembership.findUnique({
              where: {
                team_id_user_id: {
                  team_id: invite.team_id,
                  user_id: user.id,
                } as any,
              },
            });
            const roleToApply = currentMembership?.role || invite.role;
            const entitlement = await getTeamEntitlementState(tx, invite.team_id);
            if (entitlement.teamLocked) {
              throw new Error('TEAM_PLAN_LOCKED');
            }

            if (entitlement.maxRoster !== null) {
              const currentActiveCount = await tx.teamMembership.count({
                where: { team_id: invite.team_id, status: 'active' },
              });
              const existingActive = currentMembership?.status === 'active';
              const nextActiveCount = currentActiveCount + (existingActive ? 0 : 1);
              if (nextActiveCount > entitlement.maxRoster) {
                throw new Error(`ROSTER_LIMIT_REACHED:${entitlement.maxRoster}`);
              }
            }

            const transition = await tx.teamInvite.updateMany({
              where: { id: invite.id, status: 'pending' },
              data: { status: 'accepted' },
            });
            if (transition.count === 0) return false;

            await tx.teamMembership.upsert({
              where: { team_id_user_id: { team_id: invite.team_id, user_id: user.id } } as any,
              update: { role: roleToApply, status: 'active' },
              create: {
                team_id: invite.team_id,
                user_id: user.id,
                role: roleToApply,
                status: 'active',
              },
            });
            return true;
          },
          { isolationLevel: 'Serializable' }
        );

        if (!accepted) return sendError(res, 409, 'Invite already processed');
      } catch (error: any) {
        if (error?.message === 'TEAM_PLAN_LOCKED') {
          const entitlement = await getTeamEntitlementState(prisma, invite.team_id);
          return res.status(403).json(buildTeamPlanLockedError(entitlement));
        }
        if (error?.message?.startsWith('ROSTER_LIMIT_REACHED:')) {
          const limit = Number.parseInt(error.message.split(':')[1], 10);
          return res.status(403).json({
            error: 'ROSTER_LIMIT_REACHED',
            code: 'ROSTER_LIMIT_REACHED',
            message: `This team has reached its roster limit of ${limit} members. Upgrade your plan for more.`,
          });
        }
        throw error;
      }

      try {
        await ensureTeamGroupChatMembership(invite.team_id, user.id);
      } catch (error) {
        console.error('Error managing group chat:', error);
        // Don't fail the invite acceptance if group chat creation fails
      }

      // Notify team coaches/owners that the invite was accepted
      try {
        const team = await prisma.team.findUnique({
          where: { id: invite.team_id },
          select: { id: true, name: true },
        });
        const teamName = team?.name || 'your team';
        const accepterName = user.display_name || user.email || 'Someone';

        // Find coaches/owners to notify
        const managers = await prisma.teamMembership.findMany({
          where: {
            team_id: invite.team_id,
            role: { in: ['owner', 'manager', 'coach'] },
            status: 'active',
            user_id: { not: req.user!.id },
          },
          select: { user_id: true },
          take: 100,
        });

        if (managers.length > 0) {
          await prisma.notification.createMany({
            data: managers.map(mgr => ({
              user_id: mgr.user_id,
              actor_id: req.user!.id,
              type: 'TEAM_INVITE_ACCEPTED',
              meta: { team_id: invite.team_id, team_name: teamName, accepter_name: accepterName },
            })),
          });
          await Promise.allSettled(
            managers.map(mgr =>
              sendPushNotification(
                mgr.user_id,
                `${accepterName} joined ${teamName}`,
                `Your team invite was accepted`,
                { type: 'team_invite_accepted', team_id: invite.team_id, screen: 'team-page' }
              )
            )
          );

          const managerUsers = await prisma.user.findMany({
            where: { id: { in: managers.map(mgr => mgr.user_id) } },
            select: { email: true, display_name: true },
            take: managers.length,
          });
          await Promise.allSettled(
            managerUsers
              .filter(
                manager => typeof manager.email === 'string' && manager.email.trim().length > 0
              )
              .map(manager =>
                sendStaffMemberJoinedEmail({
                  to: String(manager.email).trim(),
                  ownerName: manager.display_name || undefined,
                  newMember: accepterName,
                  newMemberRole: invite.role,
                  scope: 'team',
                  scopeName: teamName,
                })
              )
          );
        }
      } catch (notifErr) {
        console.error('[teams] Failed to send invite accepted notification:', notifErr);
      }

      return res.json({ ok: true });
  })
);

// Decline invite
teamsRouter.post(
  '/invites/:inviteId/decline',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const inviteId = String(req.params.inviteId);
      const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.status !== 'pending')
        return res.status(404).json({ error: 'Invite not found' });
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase())
        return res.status(403).json({ error: 'Invite not for this user' });
      const declined = await prisma.teamInvite.updateMany({
        where: { id: invite.id, status: 'pending' },
        data: { status: 'declined' },
      });
      if (declined.count === 0) return sendError(res, 409, 'Invite already processed');

      // Notify team coaches/owners that the invite was declined
      try {
        const team = await prisma.team.findUnique({
          where: { id: invite.team_id },
          select: { id: true, name: true },
        });
        const teamName = team?.name || 'your team';
        const declinerName = user.display_name || user.email || 'Someone';

        const managers = await prisma.teamMembership.findMany({
          where: {
            team_id: invite.team_id,
            role: { in: ['owner', 'manager', 'coach'] },
            status: 'active',
          },
          select: { user_id: true },
          take: 100,
        });

        if (managers.length > 0) {
          await prisma.notification.createMany({
            data: managers.map(mgr => ({
              user_id: mgr.user_id,
              actor_id: req.user!.id,
              type: 'TEAM_INVITE_DECLINED',
              meta: { team_id: invite.team_id, team_name: teamName, decliner_name: declinerName },
            })),
          });
          await Promise.allSettled(
            managers.map(mgr =>
              sendPushNotification(
                mgr.user_id,
                `Invite declined`,
                `${declinerName} declined the invite to ${teamName}`,
                { type: 'team_invite_declined', team_id: invite.team_id, screen: 'team-page' }
              )
            )
          );
        }
      } catch (notifErr) {
        console.error('[teams] Failed to send invite declined notification:', notifErr);
      }

      return res.json({ ok: true });
  })
);

// Transfer team ownership
// NOTE: requireVerified was missing here while every other team mutation route enforces it,
// which meant unverified emails could transfer ownership. Matches the org transfer chain now.
teamsRouter.post(
  '/:id/transfer-ownership',
  requireAuth as any,
  requireVerified as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const teamId = String(req.params.id);
      const transferSchema = z.object({ new_owner_id: z.string().min(1) });
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
      const { new_owner_id } = parsed.data;

      // Transfer-ownership is deliberately MORE restrictive than canManageTeam.
      // Team staff like coach / assistant_coach shouldn't be able to hand off
      // ownership, but the current owner and the parent league's owner/manager
      // can. Two-layer check: direct team owner OR org admin of the team's org.
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { organization_id: true },
      });
      if (!team) return res.status(404).json({ error: 'Team not found' });

      const currentMembership = await prisma.teamMembership.findFirst({
        where: { team_id: teamId, user_id: req.user.id, status: 'active' },
      });
      const isDirectOwner = currentMembership?.role === 'owner';
      const { isOrgAdmin } = await import('../lib/teamAuthorization.js');
      const isLeagueAdmin = team.organization_id
        ? await isOrgAdmin(req.user.id, team.organization_id)
        : false;
      if (!isDirectOwner && !isLeagueAdmin) {
        return res.status(403).json({
          error: 'Only the team owner or a league admin can transfer ownership',
        });
      }

      // Verify new owner is a member of the team
      const newOwnerMembership = await prisma.teamMembership.findFirst({
        where: { team_id: teamId, user_id: new_owner_id, status: 'active' },
      });
      if (!newOwnerMembership) {
        return res.status(400).json({ error: 'New owner must be an existing team member' });
      }

      const existingOwnerMembership = await prisma.teamMembership.findFirst({
        where: { team_id: teamId, role: 'owner', status: 'active' },
        select: { user_id: true },
      });
      if (!existingOwnerMembership) {
        return res
          .status(400)
          .json({ error: 'Team does not have an active owner to transfer from' });
      }

      // Transfer: demote current owner to manager, promote new owner
      await prisma.$transaction([
        prisma.teamMembership.update({
          where: { team_id_user_id: { team_id: teamId, user_id: existingOwnerMembership.user_id } },
          data: { role: 'manager' },
        }),
        prisma.teamMembership.update({
          where: { team_id_user_id: { team_id: teamId, user_id: new_owner_id } },
          data: { role: 'owner' },
        }),
      ]);

      await logAdminActivityFromReq(
        req,
        'TRANSFER_TEAM_OWNERSHIP',
        'team',
        teamId,
        `Transferred team ownership to user ${new_owner_id}`,
        { new_owner_id }
      );

      return res.json({ ok: true, message: 'Ownership transferred successfully' });
  })
);
