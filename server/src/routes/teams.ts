import { Router } from 'express';
import { z } from 'zod';
import { debugLog } from '../lib/debugLog.js';
import { getAppBaseUrl } from '../lib/env.js';
import {
    sendAthleteInvitationEmail,
    sendInvitationDeclinedEmail,
    sendMemberRemovedEmail,
    sendPlanLimitWarningEmail,
    sendRoleAssignmentEmail,
    sendRosterThresholdEmail,
    sendStaffMemberJoinedEmail,
    sendTeamInvitationEmail,
    sendTeamRosterUpdateEmail
} from '../lib/email.js';
import {
    getAuthorizedUsersOrgLimit,
    getAuthorizedUsersPerTeam,
    getMaxTeamsForPlan,
    getPlanDisplayName,
    planSupportsExtracurricular,
    resolvePlan,
} from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/queue.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const teamsRouter = Router();

const MANAGE_BILLING_URL = process.env.MANAGE_BILLING_URL || `${getAppBaseUrl()}/billing`;
const STAFF_ONBOARDING_URL = process.env.STAFF_ONBOARDING_URL || `${getAppBaseUrl()}/onboarding/staff`;
const STAFF_MANAGE_URL_BASE = (process.env.MANAGE_STAFF_URL || `${getAppBaseUrl()}/teams`).replace(/\/$/, '');
const STAFF_INVITE_EXPIRY_DAYS =
  Number.parseInt(process.env.STAFF_INVITE_EXPIRY_DAYS ?? '', 10) || 7;
const ROSTER_THRESHOLD = Number.parseInt(process.env.ROSTER_ALERT_THRESHOLD ?? '', 10) || 15;
const ROSTER_THRESHOLD_COST =
  Number.isFinite(Number.parseFloat(process.env.ROSTER_THRESHOLD_COST ?? ''))
    ? Number.parseFloat(process.env.ROSTER_THRESHOLD_COST ?? '99.99')
    : 99.99;

async function notifyTeamPlanLimitEmail({
  email,
  plan,
  used,
  limit,
}: {
  email?: string | null;
  plan?: string | null;
  used: number;
  limit: number | null;
}) {
  if (!email) return;
  try {
    await sendPlanLimitWarningEmail({
      to: email,
      planName: getPlanDisplayName(plan),
      resourceType: 'team',
      used,
      limit,
    });
  } catch (err) {
    console.warn('[teams] Failed to send plan limit warning email:', (err as any)?.message || err);
  }
}

// ISSUE #3 FIX: Helper function to check if user can access team
// Includes cascade from organization membership
async function canAccessTeam(userId: string, teamId: string): Promise<boolean> {
  // Check direct team membership
  const teamMember = await prisma.teamMembership.findUnique({
    where: { 
      team_id_user_id: { team_id: teamId, user_id: userId } as any
    }
  });
  if (teamMember) return true;

  // Check organization membership (if team belongs to org)
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organization_id: true }
  });

  if (team?.organization_id) {
    const orgMember = await prisma.organizationMembership.findUnique({
      where: { 
        organization_id_user_id: { 
          organization_id: team.organization_id, 
          user_id: userId 
        } as any
      }
    });
    
    // Organization admins get automatic team access
    if (orgMember && ['owner', 'manager', 'administrator'].includes(orgMember.role || '')) {
      return true;
    }
  }

  return false;
}

async function queueStaffInviteEmails({
  teamId,
  teamName,
  inviteId,
  inviteeEmail,
  inviteeName,
  inviterName,
  coachEmail,
}: {
  teamId: string;
  teamName: string;
  inviteId: string;
  inviteeEmail: string;
  inviteeName?: string | null;
  inviterName?: string | null;
  coachEmail?: string | null;
}): Promise<void> {
  if (!inviteeEmail) return;
  const inviteLink = `${getAppBaseUrl()}/team-invites?invite=${encodeURIComponent(inviteId)}`;
  try {
    await emailQueue.add(
      'staff.invited_to_team',
      {
        to: inviteeEmail,
        invitee_name: inviteeName || inviteeEmail,
        inviter_name: inviterName || 'Coach',
        team_name: teamName,
        invite_link: inviteLink,
        expiry_days: STAFF_INVITE_EXPIRY_DAYS,
        onboarding_url: STAFF_ONBOARDING_URL,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
  } catch (error) {
    console.error('[teams] Failed to enqueue staff invitation email:', error);
  }

  if (!coachEmail) return;

  try {
    await emailQueue.add(
      'staff.invitation_sent',
      {
        to: coachEmail,
        coach_name: inviterName || 'Coach',
        invitee_name: inviteeName || inviteeEmail,
        invitee_email: inviteeEmail,
        team_name: teamName,
        manage_staff_url: `${STAFF_MANAGE_URL_BASE}/${encodeURIComponent(teamId)}/staff`,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
  } catch (error) {
    console.error('[teams] Failed to enqueue staff invitation confirmation:', error);
  }
}

async function maybeQueueRosterThresholdAlert({
  teamId,
  teamName,
  previousCount,
  newCount,
}: {
  teamId: string;
  teamName: string;
  previousCount: number;
  newCount: number;
}): Promise<void> {
  if (ROSTER_THRESHOLD <= 0) return;
  if (previousCount >= ROSTER_THRESHOLD || newCount < ROSTER_THRESHOLD) return;

  const owners = await prisma.teamMembership.findMany({
    where: { team_id: teamId, role: 'owner', status: 'active' },
    include: {
      user: { select: { email: true, display_name: true } },
    },
  });

  await Promise.all(
    owners.map((membership) => {
      const email = membership.user?.email;
      if (!email) return Promise.resolve();
      
      // Send roster threshold email directly
      return sendRosterThresholdEmail({
        to: email,
        coachName: membership.user?.display_name || 'Coach',
        teamName: teamName,
        currentRosterCount: newCount,
        maxRosterCount: ROSTER_THRESHOLD,
        upgradeLink: MANAGE_BILLING_URL,
      }).catch((err: Error) => {
        console.error('[teams] Failed to send roster threshold email:', err);
      });
    })
  ).catch((error) => {
    console.error('[teams] Failed to send roster threshold alert:', error);
  });
}

const TEAM_STAFF_ROLES = ['owner', 'manager', 'coach', 'assistant_coach'];

function isTeamStaff(role: string | null | undefined): boolean {
  if (!role) return false;
  return TEAM_STAFF_ROLES.includes(role);
}

async function userHasTeamStaffAccess(userId: string, teamId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findFirst({
    where: { user_id: userId, team_id: teamId, status: 'active' },
    select: { role: true },
  });
  return isTeamStaff(membership?.role || null);
}

async function queueSeasonWrapUpEmails(team: {
  id: string;
  name: string;
  season_start: Date | null;
  season_end: Date | null;
}): Promise<void> {
  const owners = await prisma.teamMembership.findMany({
    where: { team_id: team.id, role: 'owner', status: 'active' },
    include: { user: { select: { email: true, display_name: true } } },
  });
  if (!owners.length) return;

  const anchorDate = team.season_end || team.season_start || new Date();
  const seasonYear = anchorDate.getUTCFullYear();
  const gamesPlayed = await prisma.game.count({
    where: {
      OR: [
        { home_team_id: team.id },
        { away_team_id: team.id },
      ],
    },
  });

  const seasonHighlightsUrl = `${getAppBaseUrl()}/teams/${encodeURIComponent(team.id)}?tab=highlights`;
  const nextSeasonUrl = `${getAppBaseUrl()}/teams/${encodeURIComponent(team.id)}/season-setup`;

  await Promise.all(
    owners.map((membership) => {
      const email = membership.user?.email;
      if (!email) return Promise.resolve();
      return emailQueue.add(
        'seasons.wrap_up',
        {
          to: email,
          coach_name: membership.user?.display_name || 'Coach',
          team_name: team.name,
          season_year: seasonYear,
          games_played: gamesPlayed,
          win_loss_record: 'N/A',
          season_highlights_url: seasonHighlightsUrl,
          next_season_signup_url: nextSeasonUrl,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );
    })
  ).catch((error) => {
    console.error('[teams] Failed to enqueue season wrap-up email:', error);
  });
}

// Get teams managed by current user (requires authentication)
teamsRouter.get('/managed', authMiddleware as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const userId = req.user.id;
  const managementRoles = ['owner', 'manager', 'coach', 'assistant_coach'];
  
  let where: any = {
    memberships: {
      some: {
        user_id: userId,
        role: { in: managementRoles },
        status: 'active'
      }
    }
  };
  
  if (q) {
    where.name = { contains: q, mode: 'insensitive' };
  }
  
  const rows = await prisma.team.findMany({
    where,
    orderBy: [
      { organization: { name: 'asc' } },
      { name: 'asc' }
    ],
    include: { 
      _count: { select: { memberships: true } },
      memberships: {
        where: { user_id: userId, status: 'active' },
        select: { role: true }
      },
      organization: {
        select: {
          id: true,
          name: true,
          description: true,
          sport: true
        }
      }
    },
  });
  
  const list = rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.status,
    sport: (t as any).sport,
    season: (t as any).season,
    members: (t as any)._count.memberships,
    logo_url: (t as any).logo_url || null,
    avatar_url: (t as any).avatar_url || null,
    my_role: (t as any).memberships?.[0]?.role || null,
    organization: (t as any).organization ? {
      id: (t as any).organization.id,
      name: (t as any).organization.name,
      description: (t as any).organization.description,
      sport: (t as any).organization.sport
    } : null
  }));
  
  return res.json(list);
});

// Check team creation limits for current user
teamsRouter.get('/limits', authMiddleware as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  const ownedTeamsCount = await prisma.teamMembership.count({
    where: {
      user_id: req.user.id,
      role: 'owner',
      status: 'active'
    }
  });
  
  const prefs = ((user as any).preferences ?? {}) as Record<string, unknown>;
  const subscriptionTier = resolvePlan((prefs as any).plan || (user as any).subscription_tier);
  let maxTeams = getMaxTeamsForPlan(subscriptionTier);
  
  // CRITICAL FIX: For Veteran plan, check Stripe subscription quantity instead of using plan-definitions.json
  // which incorrectly returns null (unlimited). Veteran plan limits are dynamic based on paid quantity.
  if (subscriptionTier === 'veteran' && process.env.STRIPE_SECRET_KEY) {
    const subscriptionId = (prefs as any).subscription_id;
    if (subscriptionId) {
      try {
        const stripe = await import('stripe');
        const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        const subscription = await stripeClient.subscriptions.retrieve(String(subscriptionId));
        const paidQuantity = subscription.items.data[0]?.quantity || 0;
        maxTeams = 2 + paidQuantity; // First 2 teams free + paid quantity
      } catch (err) {
        console.error('[teams/limits] Failed to check Stripe subscription for Veteran plan:', (err as any)?.message || err);
      }
    } else {
      maxTeams = 2; // No active subscription, default to 2 free teams
    }
  }
  
  const canCreateMore = maxTeams === null ? true : ownedTeamsCount < maxTeams;
  const remaining = maxTeams === null ? null : Math.max(0, maxTeams - ownedTeamsCount);
  
  return res.json({
    owned_teams: ownedTeamsCount,
    max_teams: maxTeams,
    can_create_more: canCreateMore,
    remaining,
    subscription_tier: subscriptionTier,
    upgrade_required: !canCreateMore
  });
});

// List teams with member counts; optional search q
teamsRouter.get('/', async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const all = String((req.query as any).all || '') === '1';
  const mine = String((req.query as any).mine || '') === '1';
  const directory = String((req.query as any).directory || '') === '1'; // Team directory search
  const limitRaw = Number.parseInt(String((req.query as any).limit ?? ''), 10);
  const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined;
  
  if (all) {
    // Admin-only view flag; otherwise fall back to normal list
    const isAdmin = await getIsAdmin(req as any);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
  }
  
  let where: any = {};
  
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
        status: 'active'
      }
    };
  }
  
  const rows = await prisma.team.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
    include: { _count: { select: { memberships: true } } },
  });
  
  const list = rows.map((t) => ({ 
    id: t.id, 
    name: t.name, 
    description: t.description, 
    status: t.status, 
    members: (t as any)._count.memberships, 
    logo_url: (t as any).logo_url || null, 
    avatar_url: (t as any).avatar_url || null,
    city: (t as any).city || null,
    state: (t as any).state || null,
    league: (t as any).league || null,
    sport: (t as any).sport || null,
    // Venue information for home games
    venue_address: (t as any).venue_address || null,
    venue_lat: (t as any).venue_lat || null,
    venue_lng: (t as any).venue_lng || null,
    venue_place_id: (t as any).venue_place_id || null,
  }));
  return res.json(list);
});

// Team details with counts
teamsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const t = await prisma.team.findUnique({
    where: { id },
    include: {
      _count: { select: { memberships: true } },
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
  if (!t) return res.status(404).json({ error: 'Not found' });
  const meId = (req as AuthedRequest).user?.id ?? null;
  const [followersCount, isFollowing] = await Promise.all([
    prisma.teamFollow.count({ where: { team_id: id } }),
    meId ? prisma.teamFollow.findUnique({ where: { team_id_user_id: { team_id: id, user_id: meId } } as any }).then(Boolean) : Promise.resolve(false),
  ]);
  return res.json({
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.status,
    sport: t.sport,
    season_start: t.season_start,
    season_end: t.season_end,
    organization_id: t.organization_id,
    organization: t.organization
      ? {
          id: t.organization.id,
          name: t.organization.name,
          description: t.organization.description,
          sport: t.organization.sport,
        }
      : null,
    members: (t as any)._count.memberships,
    logo_url: (t as any).logo_url || null,
    avatar_url: (t as any).avatar_url || null,
    created_at: t.created_at,
    followers_count: followersCount,
    is_following: isFollowing,
  });
});

// Follow a team (idempotent)
teamsRouter.post('/:id/follow', authMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  try {
    await prisma.teamFollow.create({
      data: { team_id: id, user_id: req.user.id },
    });
  } catch (err: any) {
    if (err?.code !== 'P2002') {
      console.error('[teams] follow failed', err);
      return res.status(500).json({ error: 'Failed to follow team' });
    }
  }
  const followersCount = await prisma.teamFollow.count({ where: { team_id: id } });
  return res.json({ ok: true, is_following: true, followers_count: followersCount });
});

// Unfollow a team (idempotent)
teamsRouter.delete('/:id/follow', authMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  await prisma.teamFollow.deleteMany({ where: { team_id: id, user_id: req.user.id } });
  const followersCount = await prisma.teamFollow.count({ where: { team_id: id } });
  return res.json({ ok: true, is_following: false, followers_count: followersCount });
});

// List team followers (basic info)
teamsRouter.get('/:id/followers', async (req, res) => {
  const id = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const followers = await prisma.teamFollow.findMany({
    where: { team_id: id },
    orderBy: { created_at: 'desc' },
    include: {
      user: { select: { id: true, display_name: true, username: true, avatar_url: true } },
    },
  });
  return res.json(followers.map((f) => ({
    user: f.user,
    followed_at: f.created_at,
  })));
});

// Team members list
teamsRouter.get('/:id/members', async (req, res) => {
  const id = String(req.params.id);
  
  // Get direct team members
  const mems = await prisma.teamMembership.findMany({
    where: { team_id: id },
    orderBy: { created_at: 'asc' },
    include: { user: true },
  });
  
  // ISSUE #3 FIX: Include organization members if team belongs to org
  const team = await prisma.team.findUnique({
    where: { id },
    select: { organization_id: true }
  });
  
  let orgMembers: any[] = [];
  if (team?.organization_id) {
    const orgMemberships = await prisma.organizationMembership.findMany({
      where: { 
        organization_id: team.organization_id,
        role: { in: ['owner', 'manager', 'administrator'] },
        status: 'active'
      },
      include: { user: true }
    });
    
    // Add org members who aren't already direct team members
    const teamUserIds = new Set(mems.map(m => m.user_id));
    orgMembers = orgMemberships
      .filter(om => !teamUserIds.has(om.user_id))
      .map(om => ({
        id: `org_${om.id}`, // Prefix to distinguish from direct members
        role: 'coach', // Organization admins get coach role on teams
        status: 'active',
        custom_position: 'Organization Admin',
        user: {
          id: om.user_id,
          email: (om as any).user?.email || null,
          display_name: (om as any).user?.display_name || null,
        },
        inherited_from_org: true // Flag to indicate this is cascaded access
      }));
  }
  
  const list = mems.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    custom_position: m.custom_position || null,
    user: {
      id: m.user_id,
      email: (m as any).user?.email || null,
      display_name: (m as any).user?.display_name || null,
    },
    inherited_from_org: false
  }));
  
  // Combine direct members + org members
  return res.json([...list, ...orgMembers]);
});

// All members across teams (for admin screens); optional search q
teamsRouter.get('/members/all', async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const mems = await prisma.teamMembership.findMany({
    orderBy: { created_at: 'desc' },
    include: { user: true, team: true },
  });
  const list = mems.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    user: { id: m.user_id, email: (m as any).user?.email || '', display_name: (m as any).user?.display_name || '' },
    team: { id: m.team_id, name: (m as any).team?.name || '' },
  }));
  const filtered = q
    ? list.filter((r) =>
        r.user.display_name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        r.team.name.toLowerCase().includes(q)
      )
    : list;
  return res.json(filtered);
});

// Create team (auth required). Creator becomes owner.
const createSchema = z.object({ 
  name: z.string().min(2), 
  description: z.string().optional(),
  organization_id: z.string().min(1) // REQUIRED: Teams must belong to an organization
});
teamsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  
  // SECURITY: Enforce coach role requirement
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  
  if (userRole !== 'coach') {
    return res.status(403).json({
      error: 'COACH_ROLE_REQUIRED',
      message: 'Only coach accounts can create teams.',
      code: 'COACH_ROLE_REQUIRED'
    });
  }
  
  // ISSUE #1 & #2 FIX: Validate organization exists and user has admin access
  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organization_id },
    include: {
      memberships: {
        where: { 
          user_id: me.id, 
          role: { in: ['owner', 'manager', 'administrator'] },
          status: 'active'
        }
      }
    }
  });

  if (!org) {
    return res.status(404).json({ 
      error: 'ORGANIZATION_NOT_FOUND',
      message: 'Organization not found. Create an organization first.',
      organization_id: parsed.data.organization_id,
      code: 'ORGANIZATION_NOT_FOUND'
    });
  }

  if (!org.memberships.length) {
    return res.status(403).json({ 
      error: 'ORGANIZATION_ACCESS_DENIED',
      message: 'You must be an administrator of this organization to create teams',
      organization_name: org.name,
      code: 'ORGANIZATION_ACCESS_DENIED'
    });
  }
  
  // Check team ownership limit based on plan
  const ownedTeamsCount = await prisma.teamMembership.count({
    where: {
      user_id: me.id,
      role: 'owner',
      status: 'active'
    }
  });
  
  const plan = resolvePlan(prefs.plan);
  let maxTeams = getMaxTeamsForPlan(plan);
  
  // CRITICAL FIX: For Veteran plan, check Stripe subscription quantity
  // to prevent bypassing paid team limits (plan-definitions.json incorrectly returns null)
  if (plan === 'veteran' && process.env.STRIPE_SECRET_KEY) {
    const subscriptionId = prefs.subscription_id;
    if (subscriptionId) {
      try {
        const stripe = await import('stripe');
        const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        const subscription = await stripeClient.subscriptions.retrieve(String(subscriptionId));
        if (subscription.status !== 'active') {
          return res.status(403).json({
            error: 'Subscription not active',
            message: 'Your Veteran subscription is not active. Please update your billing settings.',
          });
        }
        const paidQuantity = subscription.items.data[0]?.quantity || 0;
        maxTeams = 2 + paidQuantity;
      } catch (err) {
        console.error('[teams] Failed to verify Veteran subscription:', (err as any)?.message || err);
        return res.status(500).json({ error: 'Unable to verify subscription. Please try again.' });
      }
    } else {
      maxTeams = 2; // No active subscription, limit to 2 free teams
    }
  }
  
  if (maxTeams !== null && ownedTeamsCount >= maxTeams) {
    await notifyTeamPlanLimitEmail({
      email: me.email,
      plan,
      used: ownedTeamsCount,
      limit: maxTeams,
    });
    return res.status(403).json({ 
      error: 'Team limit reached',
      message: `You've reached your ${plan} plan limit of ${maxTeams} team${maxTeams > 1 ? 's' : ''}. Upgrade your plan to create more teams.`,
      owned_teams: ownedTeamsCount,
      max_teams: maxTeams,
      current_plan: plan,
      upgrade_required: true,
      upgrade_url: `${getAppBaseUrl()}/upgrade?from=team_limit`
    });
  }
  
  const t = await prisma.team.create({ 
    data: { 
      name: parsed.data.name, 
      description: parsed.data.description,
      organization_id: parsed.data.organization_id
    },
    include: {
      organization: {
        select: { id: true, name: true, description: true }
      }
    }
  });
  await prisma.teamMembership.create({ data: { team_id: t.id, user_id: me.id, role: 'owner' } });
  return res.status(201).json(t);
});

// Update team (auth required). Only owners/admins can update.
// Accept full URLs or relative paths (uploads return .path) or empty string to clear
const logoUrlString = z.union([z.string().url(), z.string().regex(/^\/uploads\//).optional().or(z.string()), z.literal('')]);
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  sport: z.string().optional(),
  season: z.string().optional(),
  status: z.enum(['active', 'locked', 'archived']).optional(),
  organization_id: z.string().optional().nullable(),
  logo_url: z.string().optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  league: z.string().max(100).optional(),
  venue_place_id: z.string().optional(),
  venue_lat: z.number().optional(),
  venue_lng: z.number().optional(),
  venue_address: z.string().optional(),
});
teamsRouter.put('/:id', requireVerified as any, async (req: AuthedRequest, res) => {
  debugLog('[Teams PUT] Received update request:', JSON.stringify(req.body));
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Teams PUT] Validation failed:', JSON.stringify(parsed.error));
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  }
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const teamId = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const previousStatus = team.status;
  
  // Check if user is owner or admin
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } }
  });
  const isAdmin = await getIsAdmin(req as any);
  if (!isAdmin && (!membership || membership.role !== 'owner')) {
    return res.status(403).json({ error: 'Only team owners can update team information' });
  }
  
  const updateData: any = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.sport !== undefined) updateData.sport = parsed.data.sport;
  if (parsed.data.season !== undefined) updateData.season = parsed.data.season;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.organization_id !== undefined) {
    updateData.organization_id = parsed.data.organization_id === null ? null : parsed.data.organization_id;
  }
  if (parsed.data.logo_url !== undefined) updateData.logo_url = parsed.data.logo_url === '' ? null : parsed.data.logo_url;
  
  // Venue fields
  if (parsed.data.city !== undefined) updateData.city = parsed.data.city;
  if (parsed.data.state !== undefined) updateData.state = parsed.data.state;
  if (parsed.data.league !== undefined) updateData.league = parsed.data.league;
  if (parsed.data.venue_place_id !== undefined) {
    updateData.venue_place_id = parsed.data.venue_place_id;
    updateData.venue_updated_at = new Date();
  }
  if (parsed.data.venue_lat !== undefined) updateData.venue_lat = parsed.data.venue_lat;
  if (parsed.data.venue_lng !== undefined) updateData.venue_lng = parsed.data.venue_lng;
  if (parsed.data.venue_address !== undefined) updateData.venue_address = parsed.data.venue_address;
  
  debugLog('[Teams PUT] Prepared update data:', JSON.stringify(updateData));
  
  try {
    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: updateData as any,
      include: {
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
    if (parsed.data.status === 'locked' && previousStatus !== 'locked') {
      queueSeasonWrapUpEmails({
        id: updatedTeam.id,
        name: updatedTeam.name,
        season_start: updatedTeam.season_start,
        season_end: updatedTeam.season_end,
      }).catch((error) => {
        console.error('[teams] Failed to queue season wrap-up email:', error);
      });
    }
    // Return a compact team object including organization and logo/avatar fields for client convenience
    return res.json({
      id: updatedTeam.id,
      name: updatedTeam.name,
      description: updatedTeam.description,
      sport: updatedTeam.sport,
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
      status: updatedTeam.status,
      created_at: updatedTeam.created_at,
    });
  } catch (err: any) {
    console.error('Failed to update team', err?.message || err);
    // Handle common Prisma client runtime errors gracefully
    return res.status(500).json({ error: 'Failed to update team', detail: err?.message || String(err) });
  }
});

// Delete team (auth required). Only owners/admins can delete.
teamsRouter.delete('/:id', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const teamId = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  
  // Check if user is owner or admin
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } }
  });
  const isAdmin = await getIsAdmin(req as any);
  if (!isAdmin && (!membership || membership.role !== 'owner')) {
    return res.status(403).json({ error: 'Only team owners can delete teams' });
  }
  
  try {
    // Delete all related data first (cascade delete)
    await prisma.$transaction([
      // Delete team memberships
      prisma.teamMembership.deleteMany({ where: { team_id: teamId } }),
      // Delete team invites
      prisma.teamInvite.deleteMany({ where: { team_id: teamId } }),
      // Delete the team itself
      prisma.team.delete({ where: { id: teamId } }),
    ]);
    
    return res.json({ ok: true, message: 'Team deleted successfully' });
  } catch (err: any) {
    console.error('Failed to delete team', err?.message || err);
    return res.status(500).json({ error: 'Failed to delete team', detail: err?.message || String(err) });
  }
});

// Dev helper: update just the logo_url of a team (useful for testing uploads quickly)
if (process.env.NODE_ENV !== 'production') {
  teamsRouter.post('/:id/dev-set-logo', async (req, res) => {
    const id = String(req.params.id);
    const { logo_url } = req.body || {};
    try {
  const t = await prisma.team.update({ where: { id }, data: ({ logo_url: logo_url === '' ? null : logo_url } as any) });
  return res.json({ ok: true, team: { id: t.id, logo_url: (t as any).logo_url } });
    } catch (e: any) {
      console.error('dev-set-logo failed', e?.message || e);
      return res.status(500).json({ error: 'dev-set-logo failed', detail: e?.message || String(e) });
    }
  });
}

// Enhanced create team for onboarding
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  club_type: z.enum(['sport', 'extracurricular']).optional(),
  extracurricular_category: z.string().max(100).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  organization_id: z.string().min(1), // REQUIRED: Teams must belong to an organization
  logo_url: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  league: z.string().max(100).optional(),
  venue_place_id: z.string().optional(),
  venue_lat: z.number().optional(),
  venue_lng: z.number().optional(),
  venue_address: z.string().optional(),
  authorized_users: z.array(z.object({
    email: z.string().email().optional(),
    user_id: z.string().optional(),
    role: z.string().optional(),
    assign_team: z.string().optional(),
  })).optional(),
});

teamsRouter.post('/create', requireVerified as any, async (req: AuthedRequest, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const data = parsed.data;
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  
  // Check team limit for free tier (Rookie plan)
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userPlan = resolvePlan(prefs.plan);
  const userRole = prefs.role || 'fan';

  // Enforce coach role requirement for team creation
  if (userRole !== 'coach') {
    return res.status(403).json({
      error: 'COACH_ROLE_REQUIRED',
      message: 'Only coach accounts can create teams.',
      code: 'COACH_ROLE_REQUIRED'
    });
  }
  
  // ISSUE #1 & #2 FIX: Validate organization exists and user has admin access
  const org = await prisma.organization.findUnique({
    where: { id: data.organization_id },
    include: {
      memberships: {
        where: { 
          user_id: me.id, 
          role: { in: ['owner', 'manager', 'administrator'] },
          status: 'active'
        }
      },
      teams: { where: { status: 'active' }, select: { id: true } }
    }
  });

  if (!org) {
    return res.status(404).json({ 
      error: 'ORGANIZATION_NOT_FOUND',
      message: 'Organization not found. Create an organization first at /organizations/create',
      organization_id: data.organization_id,
      code: 'ORGANIZATION_NOT_FOUND'
    });
  }

  if (!org.memberships.length) {
    return res.status(403).json({ 
      error: 'ORGANIZATION_ACCESS_DENIED',
      message: 'You must be an administrator of this organization to create teams',
      organization_name: org.name,
      code: 'ORGANIZATION_ACCESS_DENIED'
    });
  }
  
  const ownedTeamsCount = await prisma.teamMembership.count({
    where: {
      user_id: me.id,
      role: 'owner',
      status: 'active',
    },
  });

  // Legend tier restriction: Only Legend users can create extracurricular clubs
  const clubType = data.club_type || 'sport';
  if (clubType === 'extracurricular' && !planSupportsExtracurricular(userPlan)) {
    return res.status(403).json({
      error: 'Extracurricular clubs require Legend tier',
      message: 'Upgrade to Legend ($20/year) to create extracurricular clubs like Theater, Chess, Debate, etc.',
      code: 'LEGEND_TIER_REQUIRED',
      feature: 'extracurricular_clubs',
    });
  }

  // Enforce max teams for current plan (null means unlimited)
  const planTeamCap = getMaxTeamsForPlan(userPlan);
  if (planTeamCap !== null && ownedTeamsCount >= planTeamCap) {
    await notifyTeamPlanLimitEmail({
      email: me.email,
      plan: userPlan,
      used: ownedTeamsCount,
      limit: planTeamCap,
    });
    return res.status(403).json({
      error: 'Team limit reached',
      message: `Your ${userPlan} plan allows ${planTeamCap} team${planTeamCap === 1 ? '' : 's'}. Upgrade to create more.`,
      code: 'TEAM_LIMIT_EXCEEDED',
      limit: planTeamCap,
      current: ownedTeamsCount,
    });
  }
  
  // Veteran plan: verify subscription quantity matches team count
  if (userPlan === 'veteran') {
    const subscriptionId = prefs.subscription_id;
    if (!subscriptionId) {
      return res.status(403).json({
        error: 'No active subscription',
        message: 'Veteran plan requires an active subscription. Please update your billing settings.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }
    
    // Check Stripe subscription quantity
    try {
      const stripe = await import('stripe');
      const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      
      if (subscription.status !== 'active') {
        return res.status(403).json({
          error: 'Subscription not active',
          message: 'Your Veteran subscription is not active. Please update your billing settings.',
          code: 'SUBSCRIPTION_NOT_ACTIVE',
        });
      }
      
      const subscriptionItem = subscription.items.data[0];
      const paidQuantity = subscriptionItem?.quantity || 0;
      
      // Veteran plan: first 2 teams are always free, paidQuantity is for additional teams
      // User can create total of (2 + paidQuantity) teams
      const allowedTotalTeams = 2 + paidQuantity;
      
      // User is trying to create team number (ownedTeamsCount + 1)
      if (ownedTeamsCount >= allowedTotalTeams) {
        await notifyTeamPlanLimitEmail({
          email: me.email,
          plan: userPlan,
          used: ownedTeamsCount,
          limit: allowedTotalTeams,
        });
        return res.status(403).json({
          error: 'Team limit reached',
          message: `You've paid for ${paidQuantity} additional team${paidQuantity !== 1 ? 's' : ''} (${allowedTotalTeams} total including 2 free) but are trying to create team #${ownedTeamsCount + 1}. Please update your subscription first.`,
          code: 'SUBSCRIPTION_QUANTITY_EXCEEDED',
          paid_quantity: paidQuantity,
          allowed_total_teams: allowedTotalTeams,
          current_teams: ownedTeamsCount,
        });
      }
    } catch (err) {
      console.error('[Teams] Failed to verify Veteran subscription:', err);
      return res.status(500).json({
        error: 'Subscription verification failed',
        message: 'Unable to verify your subscription. Please try again or contact support.',
      });
    }
  }
  
  // Create team
  const team = await prisma.team.create({ 
    data: {
      name: data.name,
      description: data.description,
      sport: data.sport,
      club_type: data.club_type || 'sport',
      extracurricular_category: data.extracurricular_category,
      season_start: data.season_start ? new Date(data.season_start) : null,
      season_end: data.season_end ? new Date(data.season_end) : null,
      organization_id: data.organization_id,
      logo_url: data.logo_url,
      city: data.city,
      state: data.state,
      league: data.league,
      venue_place_id: data.venue_place_id,
      venue_lat: data.venue_lat,
      venue_lng: data.venue_lng,
      venue_address: data.venue_address,
      venue_updated_at: data.venue_place_id ? new Date() : null,
    },
    include: {
      organization: {
        select: { id: true, name: true, description: true }
      }
    }
  });
  
  // Add creator as owner
  await prisma.teamMembership.create({ 
    data: { 
      team_id: team.id, 
      user_id: me.id, 
      role: 'owner' 
    } 
  });
  
  // Send invites to authorized users
  if (data.authorized_users && data.authorized_users.length > 0) {
    const perTeamLimit = getAuthorizedUsersPerTeam(userPlan);
    
    if (perTeamLimit !== null && data.authorized_users.length > perTeamLimit) {
      return res.status(403).json({
        error: 'Authorized users limit exceeded',
        message: `Your ${userPlan} plan allows ${perTeamLimit} authorized user${perTeamLimit > 1 ? 's' : ''} per team. You attempted to add ${data.authorized_users.length}.`,
        code: 'AUTH_USERS_LIMIT_EXCEEDED',
        limit: perTeamLimit,
        attempted: data.authorized_users.length,
        current_plan: userPlan,
        upgrade_required: true
      });
    }

    const invites = data.authorized_users
      .filter(user => user.email)
      .map(user => ({
        team_id: team.id,
        email: user.email!,
        role: user.role || 'member',
        assign_team: user.assign_team || null,
      }));
    
    if (invites.length > 0) {
      await prisma.teamInvite.createMany({
        data: invites,
        skipDuplicates: true,
      });
        const inviter = await prisma.user.findUnique({ where: { id: me.id }, select: { display_name: true } });
        await Promise.all(invites.map(async (inv) => {
          try {
            await sendTeamInvitationEmail({
              to: inv.email,
              recipientName: inv.email.split('@')[0],
              inviterName: inviter?.display_name || 'Team Owner',
              teamName: team.name,
              role: inv.role,
              acceptLink: `${getAppBaseUrl()}/team-invites?invite=${team.id}`,
              declineLink: `${getAppBaseUrl()}/team-invites/${team.id}/decline`,
            });
          } catch {
            /* ignore */
          }
        }));
    }
  }
  
  return res.status(201).json(team);
});

// Invite user by email to a team
const inviteSchema = z.object({ email: z.string().email(), role: z.string().optional() });
teamsRouter.post('/:id/invite', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, role } = parsed.data;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  
  // Check if user is staff/admin (authorization)
  const isAdmin = await getIsAdmin(req as any);
  const hasStaffAccess = await userHasTeamStaffAccess(req.user.id, id);
  if (!isAdmin && !hasStaffAccess) {
    return res.status(403).json({ error: 'TEAM_STAFF_REQUIRED', message: 'Only team staff can invite members.' });
  }
  // PLAN LIMITS: Enforce authorized user caps
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const prefs = (user?.preferences || {}) as any;
    const plan = resolvePlan(prefs.plan);
    const teamCountTotal =
      prefs.team_count_total ||
      (await prisma.teamMembership.count({ where: { user_id: req.user.id, role: 'owner' } }));
    const limit = getAuthorizedUsersOrgLimit(plan, teamCountTotal);
    if (limit !== null) {
      const inviteCount = await prisma.teamInvite.count({ where: { team_id: id, status: 'pending' } });
      const memberCount = await prisma.teamMembership.count({ where: { team_id: id, role: { in: ['manager','coach','assistant_coach','equipment','health_wellness'] } } });
      const totalAuthorized = inviteCount + memberCount;
      if (totalAuthorized >= limit) {
        return res.status(403).json({
          error: 'USER_LIMIT_REACHED',
          message: `Plan limit reached. The ${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} across your staff.`,
          limit,
          current: totalAuthorized
        });
      }
    }
  } catch (e) {
    console.warn('[teams][invite-limit] check failed', e);
  }
  
  // Create the invite
  const invite = await prisma.teamInvite.create({ data: { team_id: id, email, role: role || 'member' } });
  const invitedUser = await prisma.user.findUnique({ where: { email } });
  // Send invite email (best effort)
  const inviter = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { display_name: true, email: true },
  });
  const teamWithOrg = await prisma.team.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } }
  });
  
  // Determine if this is an athlete invitation
  const isAthleteRole = ['athlete', 'player'].includes((role || 'member').toLowerCase());
  
  try {
    if (isAthleteRole) {
      // Send athlete-specific invitation
      await sendAthleteInvitationEmail({
        to: email,
        athleteName: invitedUser?.display_name || email.split('@')[0],
        coachName: inviter?.display_name || 'Team Owner',
        teamName: team.name,
        sport: team.sport || 'athletics',
        acceptLink: `${getAppBaseUrl()}/team-invites?invite=${invite.id}`,
        declineLink: `${getAppBaseUrl()}/team-invites/${invite.id}/decline`,
      });
    } else {
      // Send standard team invitation
      await sendTeamInvitationEmail({
        to: email,
        recipientName: invitedUser?.display_name || email.split('@')[0],
        inviterName: inviter?.display_name || 'Team Owner',
        teamName: team.name,
        role: role || 'member',
        acceptLink: `${getAppBaseUrl()}/team-invites?invite=${invite.id}`,
        declineLink: `${getAppBaseUrl()}/team-invites/${invite.id}/decline`,
      });
    }
  } catch (e) {
    console.warn('[teams] Failed to send staff invitation email:', email, e);
  }
  await queueStaffInviteEmails({
    teamId: id,
    teamName: team.name,
    inviteId: invite.id,
    inviteeEmail: email,
    inviteeName: invitedUser?.display_name,
    inviterName: inviter?.display_name || 'Team Owner',
    coachEmail: inviter?.email || undefined,
  });
  
  // Find the invited user by email and create notification if they exist
  if (invitedUser) {
    try {
      await (prisma as any).notification.create({
        data: {
          user_id: invitedUser.id,
          actor_id: req.user.id,
          type: 'TEAM_INVITE',
          meta: {
            team_id: team.id,
            team_name: team.name,
            invite_id: invite.id,
            role: role || 'member'
          }
        }
      });
    } catch (error) {
      console.error('Failed to create team invite notification:', error);
      // Continue even if notification fails
    }
  }
  
  return res.status(201).json(invite);
});

// List invites for the authed user's email
teamsRouter.get('/invites/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email) return res.status(400).json({ error: 'User email not found' });
  const invites = await prisma.teamInvite.findMany({ where: { email: user.email, status: 'pending' }, include: { team: true }, orderBy: { created_at: 'desc' } });
  const list = invites.map((i) => ({ id: i.id, role: i.role, created_at: i.created_at, team: { id: i.team_id, name: (i as any).team?.name || '' } }));
  return res.json(list);
});

// Accept invite
teamsRouter.post('/invites/:inviteId/accept', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const inviteId = String(req.params.inviteId);
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invite not found' });
  const team = await prisma.team.findUnique({
    where: { id: invite.team_id },
    select: { id: true, name: true, season_start: true, season_end: true },
  });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) return res.status(403).json({ error: 'Invite not for this user' });
  const existingMembership = await prisma.teamMembership.findUnique({
    where: {
      team_id_user_id: {
        team_id: invite.team_id,
        user_id: user.id,
      } as any,
    },
  });
  const roleToApply = existingMembership?.role || invite.role;
  const wasActiveMember = existingMembership?.status === 'active';
  await prisma.$transaction([
    prisma.teamMembership.upsert({
      where: { team_id_user_id: { team_id: invite.team_id, user_id: user.id } } as any,
      update: { role: roleToApply, status: 'active' },
      create: { team_id: invite.team_id, user_id: user.id, role: roleToApply, status: 'active' },
    }),
    prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
  ]);
  
  // Send staff member joined notification to team owner/managers
  if (!wasActiveMember) {
    const teamDetails = await prisma.team.findUnique({
      where: { id: invite.team_id },
      include: {
        organization: { select: { name: true } },
        memberships: {
          where: { 
            role: { in: ['owner', 'manager'] },
            status: 'active',
            user_id: { not: user.id } // Don't notify the person who just joined
          },
          include: { user: true }
        }
      }
    });
    
    const joinedDate = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Chicago',
    });
    
    await Promise.all(
      (teamDetails?.memberships || []).map(manager => 
        sendStaffMemberJoinedEmail({
          to: manager.user.email!,
          recipientName: manager.user.display_name || manager.user.email!,
          newMemberName: user.display_name || user.email,
          memberRole: roleToApply,
          teamName: team.name,
          organizationName: teamDetails?.organization?.name || 'your organization',
          joinedDate: joinedDate,
          viewTeamLink: `${getAppBaseUrl()}/teams/${invite.team_id}/roster`,
          manageStaffLink: `${getAppBaseUrl()}/teams/${invite.team_id}/settings`,
        }).catch((err: Error) => {
          console.error('[teams] Failed to send staff member joined email:', err);
        })
      )
    );
  }
  
  if (!wasActiveMember) {
    const newCount = await prisma.teamMembership.count({
      where: { team_id: invite.team_id, status: 'active' },
    });
    const previousCount = Math.max(0, newCount - 1);
    await maybeQueueRosterThresholdAlert({
      teamId: invite.team_id,
      teamName: team.name,
      previousCount,
      newCount,
    });
  }

  // Check if team group chat exists, if not create it
  try {
    let groupChat = await prisma.groupChat.findFirst({
      where: { team_id: invite.team_id },
    });

    if (!groupChat) {
      // Get all active team members
      const allMembers = await prisma.teamMembership.findMany({
        where: { 
          team_id: invite.team_id,
          status: 'active'
        },
        select: { user_id: true },
      });

      // Create group chat with all members
      groupChat = await prisma.groupChat.create({
        data: {
          name: `${team?.name || 'Team'} Chat`,
          team_id: invite.team_id,
          created_by: req.user.id,
          members: {
            create: allMembers.map(m => ({ user_id: m.user_id })),
          },
        },
      });
    } else {
      // Add user to existing group chat if not already a member
      const existingMember = await prisma.groupChatMember.findFirst({
        where: {
          chat_id: groupChat.id,
          user_id: user.id,
        },
      });

      if (!existingMember) {
        await prisma.groupChatMember.create({
          data: {
            chat_id: groupChat.id,
            user_id: user.id,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error managing group chat:', error);
    // Don't fail the invite acceptance if group chat creation fails
  }

  return res.json({ ok: true });
});

// Decline invite
teamsRouter.post('/invites/:inviteId/decline', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const inviteId = String(req.params.inviteId);
  const { reason } = req.body;
  
  const invite = await prisma.teamInvite.findUnique({ 
    where: { id: inviteId },
    include: { team: true }
  });
  
  if (!invite || invite.status !== 'pending') {
    return res.status(404).json({ error: 'Invite not found' });
  }
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return res.status(403).json({ error: 'Invite not for this user' });
  }
  
  // Update invite with declined status and optional reason
  await prisma.teamInvite.update({ 
    where: { id: invite.id }, 
    data: { 
      status: 'declined',
      declined_reason: reason ? String(reason).trim() : null
    } 
  });
  
  // Get team owner to send notification
  const teamOwner = await prisma.teamMembership.findFirst({
    where: { team_id: invite.team.id, role: 'owner', status: 'active' },
    include: { user: true }
  });
  
  if (teamOwner?.user.email) {
    const declinedDate = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short'
    });
    
    // Send invitation declined email to team owner
    await sendInvitationDeclinedEmail({
      to: teamOwner.user.email,
      senderName: teamOwner.user.display_name || 'Team Owner',
      declinedByName: user.display_name || user.email || 'User',
      teamName: invite.team.name,
      role: invite.role,
      declinedDate: declinedDate,
      reasonProvided: reason ? String(reason).trim() : undefined,
      viewTeamUrl: `${getAppBaseUrl()}/teams/${invite.team.id}`,
      resendInvitationUrl: `${getAppBaseUrl()}/teams/${invite.team.id}/invite`,
    }).catch((err: Error) => {
      console.error('[teams] Failed to send invitation declined email:', err);
    });
  }
  
  return res.json({ ok: true });
});

// ✅ Update team member role (team staff or admin)
const memberUpdateSchema = z.object({
  role: z.string().min(1).max(64).optional(),
  custom_position: z
    .union([z.string().max(60), z.literal('')])
    .optional()
    .nullable(),
}).refine(
  (value) => typeof value.role === 'string' || value.custom_position !== undefined,
  { message: 'No changes provided' }
);

teamsRouter.patch('/:id/members/:userId', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const teamId = String(req.params.id);
  const userIdToUpdate = String(req.params.userId);
  const parsedBody = memberUpdateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.issues?.[0]?.message || 'Invalid payload' });
  }
  const { role: newRole, custom_position: rawCustomPosition } = parsedBody.data;
  const trimmedPosition =
    rawCustomPosition === undefined || rawCustomPosition === null
      ? undefined
      : rawCustomPosition.trim().length
        ? rawCustomPosition.trim()
        : null;
  
  // Verify team exists
  const team = await prisma.team.findUnique({ 
    where: { id: teamId },
    include: { 
      memberships: {
        where: { status: 'active' },
        include: { user: true }
      }
    }
  });
  
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Check if requester is team staff/admin
  const requesterMembership = team.memberships.find(m => m.user_id === req.user!.id);
  if (!requesterMembership || !isTeamStaff(requesterMembership.role)) {
    return res.status(403).json({ error: 'Only team staff can update member roles' });
  }
  
  // Find the member to update
  const memberToUpdate = team.memberships.find(m => m.user_id === userIdToUpdate);
  if (!memberToUpdate) {
    return res.status(404).json({ error: 'Member not found' });
  }
  
  // Prevent changing the owner role
  if (newRole && memberToUpdate.role === 'owner') {
    return res.status(403).json({ error: 'Cannot change owner role' });
  }
  
  const oldRole = memberToUpdate.role;
  const updateData: Record<string, unknown> = {};
  if (newRole) updateData.role = newRole;
  if (trimmedPosition !== undefined) updateData.custom_position = trimmedPosition;
  if (!Object.keys(updateData).length) {
    return res.status(400).json({ error: 'No changes provided' });
  }
  
  const updated = await prisma.teamMembership.update({
    where: { id: memberToUpdate.id },
    data: updateData,
    select: { role: true, custom_position: true },
  });
  
  // Send role assignment notification to member
  if (newRole && memberToUpdate.user.email && oldRole !== newRole) {
    const assignmentDate = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Chicago',
    });
    
    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    await sendRoleAssignmentEmail({
      to: memberToUpdate.user.email,
      userName: memberToUpdate.user.display_name || memberToUpdate.user.email,
      teamName: team.name,
      newRole: newRole,
      assignedBy: requester?.display_name || 'Team Manager',
      assignedDate: assignmentDate,
      dashboardLink: `${getAppBaseUrl()}/teams/${team.id}`,
    }).catch((err: Error) => {
      console.error('[teams] Failed to send role assignment email:', err);
    });
  }
  
  return res.json({ ok: true, role: updated.role, custom_position: updated.custom_position || null });
});

// ✅ Remove team member (team staff or admin)
teamsRouter.delete('/:id/members/:userId', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const teamId = String(req.params.id);
  const userIdToRemove = String(req.params.userId);
  const { reason } = req.body;
  
  // Verify team exists
  const team = await prisma.team.findUnique({ 
    where: { id: teamId },
    include: { 
      organization: true,
      memberships: {
        where: { status: 'active' },
        include: { user: true }
      }
    }
  });
  
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Check if requester is team staff/admin
  const requesterMembership = team.memberships.find(m => m.user_id === req.user!.id);
  if (!requesterMembership || !isTeamStaff(requesterMembership.role)) {
    return res.status(403).json({ error: 'Only team staff can remove members' });
  }
  
  // Find the member to remove
  const memberToRemove = team.memberships.find(m => m.user_id === userIdToRemove);
  if (!memberToRemove) {
    return res.status(404).json({ error: 'Member not found or already removed' });
  }
  
  // Prevent removing the owner
  if (memberToRemove.role === 'owner') {
    return res.status(403).json({ error: 'Cannot remove team owner' });
  }
  
  // Prevent managers from removing other managers
  if (requesterMembership.role === 'manager' && memberToRemove.role === 'manager') {
    return res.status(403).json({ error: 'Managers cannot remove other managers' });
  }
  
  // Get requester details for email
  const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
  
  // Update membership with removal details
  const removalDate = new Date();
  await prisma.teamMembership.update({
    where: { id: memberToRemove.id },
    data: {
      status: 'archived',
      removed_by: req.user.id,
      removal_reason: reason ? String(reason).trim() : null,
      removal_date: removalDate,
    }
  });
  
  // Send notification email to removed member
  if (memberToRemove.user.email) {
    const formattedRemovalDate = removalDate.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short'
    });
    
    await sendMemberRemovedEmail({
      to: memberToRemove.user.email,
      userName: memberToRemove.user.display_name || memberToRemove.user.email || 'User',
      teamName: team.name,
      organizationName: team.organization?.name || 'your organization',
      removedBy: requester?.display_name || 'Team Manager',
      removalDate: formattedRemovalDate,
      removalReason: reason ? String(reason).trim() : 'No reason provided',
      contactEmail: process.env.SUPPORT_EMAIL || 'support@varsityhub.app',
    }).catch((err: Error) => {
      console.error('[teams] Failed to send member removed email:', err);
    });
    
    // Send roster update notification to team owner/managers
    const managementMembers = team.memberships.filter(m => 
      ['owner', 'manager'].includes(m.role) && 
      m.user_id !== req.user!.id && 
      m.user.email
    );
    
    await Promise.all(managementMembers.map(manager => 
      sendTeamRosterUpdateEmail({
        to: manager.user.email!,
        coachName: manager.user.display_name || manager.user.email!,
        teamName: team.name,
        updateType: 'member_removed',
        playerName: memberToRemove.user.display_name || memberToRemove.user.email || 'User',
        updateDate: formattedRemovalDate,
        viewRosterLink: `${getAppBaseUrl()}/teams/${team.id}/roster`,
      }).catch((err: Error) => {
        console.error('[teams] Failed to send roster update email:', err);
      })
    ));
  }
  
  return res.json({ 
    success: true, 
    message: 'Member removed successfully' 
  });
});
