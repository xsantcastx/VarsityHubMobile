import { Router } from 'express';
import { z } from 'zod';
import { sendTeamInviteEmail } from '../lib/email.js';
import { validateContent } from '../lib/contentFilter.js';
import { sendPushNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { requirePlan } from '../middleware/subscription.js';
import { teamCreationLimiter, followLimiter, inviteLimiter } from '../middleware/rateLimiters.js';
import { getAuthorizedUsersPerTeam, getMaxTeamsForPlan, planSupportsExtracurricular } from '../lib/planLimits.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { isOrganizationApproved } from '../lib/approvalService.js';

import { registerIdValidation } from '../middleware/validateParams.js';

export const teamsRouter = Router();
registerIdValidation(teamsRouter);
const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// Get teams managed by current user (requires authentication)
teamsRouter.get('/managed', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
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
    take: 100,
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
  } catch (err) {
    console.error('[teams] managed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Check team creation limits for current user
teamsRouter.get('/limits', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: 'User not found' });

  const ownedTeamsCount = await prisma.teamMembership.count({
    where: {
      user_id: req.user!.id,
      role: 'owner',
      status: 'active'
    }
  });
  
  // Get plan from preferences; if payment_pending, treat as rookie until payment completes
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const plan = prefs.payment_pending ? 'rookie' : (prefs.plan || user.subscription_tier || 'rookie');
  
  // Get max teams from plan definitions (source of truth)
  const maxTeamsFromPlan = getMaxTeamsForPlan(plan);
  // Use plan-based limit if available, otherwise fallback to database column, then default to 2
  const maxTeams = maxTeamsFromPlan ?? (user as any).max_teams ?? 2;
  
  // For unlimited plans (null), set to a high number for UI display
  const maxTeamsDisplay = maxTeamsFromPlan === null ? 999 : maxTeams;
  
  const canCreateMore = maxTeamsFromPlan === null || ownedTeamsCount < maxTeams;
  const subscriptionTier = (user as any).subscription_tier ?? 'free';
  
  return res.json({
    owned_teams: ownedTeamsCount,
    max_teams: maxTeamsDisplay,
    can_create_more: canCreateMore,
    remaining: maxTeamsFromPlan === null ? 999 : Math.max(0, maxTeams - ownedTeamsCount),
    subscription_tier: subscriptionTier,
    upgrade_required: !canCreateMore
  });
  } catch (err) {
    console.error('[teams] limits error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List teams with member counts; optional search q
teamsRouter.get('/', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('[teams] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Follow a team
teamsRouter.post('/:id/follow', requireAuth as any, followLimiter, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const teamId = String(req.params.id);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    try {
      await prisma.teamFollow.create({ data: { user_id: userId, team_id: teamId } });

      // Notify team coaches/owners about new follower
      try {
        const follower = await prisma.user.findUnique({ where: { id: userId }, select: { display_name: true } });
        const followerName = follower?.display_name || 'Someone';

        const managers = await prisma.teamMembership.findMany({
          where: {
            team_id: teamId,
            role: { in: ['owner', 'manager', 'coach'] },
            status: 'active',
            user_id: { not: userId },
          },
          select: { user_id: true },
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
          await Promise.allSettled(managers.map(mgr =>
            sendPushNotification(
              mgr.user_id,
              `New follower`,
              `${followerName} is now following ${team!.name}`,
              { type: 'team_followed', team_id: teamId, screen: 'team-page' }
            )
          ));
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
});

// Unfollow a team
teamsRouter.delete('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const teamId = String(req.params.id);
    await prisma.teamFollow.deleteMany({ where: { user_id: userId, team_id: teamId } });
    return res.json({ is_following: false });
  } catch (e: any) {
    console.error('[teams] unfollow error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to unfollow team' });
  }
});

// Team details with counts
teamsRouter.get('/:id', async (req, res) => {
  try {
  const id = String(req.params.id);
  const currentUserId = (req as AuthedRequest).user?.id ?? null;
  const t = await prisma.team.findUnique({
    where: { id },
    include: {
      _count: { select: { memberships: true, followers: true } },
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
    followers_count: (t as any)._count.followers ?? 0,
    is_following: currentUserId
      ? !!(await prisma.teamFollow.findFirst({ where: { user_id: currentUserId, team_id: id } }))
      : null,
    logo_url: (t as any).logo_url || null,
    avatar_url: (t as any).avatar_url || null,
    created_at: t.created_at,
  });
  } catch (err) {
    console.error('[teams] get-by-id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Team members list (auth required — roster visibility)
// Restricted to team members, org admins (owner/manager), or platform admins
teamsRouter.get('/:id/members', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  const id = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id }, select: { id: true, organization_id: true } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const isAdmin = await getIsAdmin(req as any);
  const isTeamMember = await prisma.teamMembership.findFirst({
    where: { team_id: id, user_id: req.user!.id, status: 'active' },
    select: { id: true },
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
  if (!isAdmin && !isTeamMember && !isOrgAdmin) {
    return res.status(403).json({ error: 'Only team members, league admins, or platform admins can view the roster' });
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
        }
      }
    },
  });
  const list = mems.map((m) => {
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
      }
    };
  });
  return res.json(list);
  } catch (err) {
    console.error('[teams] get-members error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// All members across teams (admin screens). Paged and DB-filtered to avoid unbounded scans.
teamsRouter.get('/members/all', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
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
    skip,
    take,
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

  const list = mems.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    user: { id: m.user_id, email: m.user?.email || '', display_name: m.user?.display_name || '' },
    team: { id: m.team_id, name: m.team?.name || '' },
  }));

  return res.json(list);
  } catch (err) {
    console.error('[teams] members-all error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create team (auth required). Creator becomes owner.
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().optional(),
  organization_id: z.string().min(1, 'Organization is required'),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  onboarding: z.boolean().optional(),
});
teamsRouter.post('/', requireVerified as any, requireOnboarded as any, requirePlan('rookie') as any, async (req: AuthedRequest, res) => {
  try {
  // req.user is guaranteed by requireVerified middleware
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const userId = req.user!.id;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  // SECURITY: Enforce coach role — allow if user has any coach-related DB membership,
  // OR if their profile role is 'coach' (covers new coaches who completed onboarding
  // but haven't created their first team yet).
  const prefs0 = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const isCoachByPrefs = prefs0.role === 'coach';

  if (!isCoachByPrefs) {
    // Only check DB memberships if preferences don't confirm coach role
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
    });

    if (!hasCoachRole && !hasOrgRole) {
      return res.status(403).json({
        error: 'COACH_ROLE_REQUIRED',
        message: 'Only coach accounts can create teams.',
        code: 'COACH_ROLE_REQUIRED'
      });
    }
  }

  const filterResult = validateContent({ title: parsed.data.name, content: parsed.data.description ?? undefined });
  if (!filterResult.valid) {
    return res.status(400).json({ error: filterResult.error, code: filterResult.code });
  }

  // Validate organization exists and is approved
  const org = await prisma.organization.findUnique({ where: { id: parsed.data.organization_id } });
  if (!org) return res.status(400).json({ error: 'Organization not found' });
  if (!(await isOrganizationApproved(parsed.data.organization_id, prisma))) {
    return res.status(403).json({
      error: 'ORGANIZATION_NOT_APPROVED',
      message: 'Teams can only be created under organizations that have been approved by VarsityHub.',
      code: 'ORGANIZATION_NOT_APPROVED',
    });
  }
  const orgMembership = await prisma.organizationMembership.findUnique({
    where: { organization_id_user_id: { organization_id: parsed.data.organization_id, user_id: userId } },
    select: { status: true },
  });
  if (!orgMembership || orgMembership.status !== 'active') {
    return res.status(403).json({
      error: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
      message: 'You must be an active member of this organization to create a team under it.',
    });
  }

  // Atomic limit check + create to prevent race condition on concurrent requests
  const userPrefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userPlan = userPrefs.plan || 'rookie';
  const maxTeams = getMaxTeamsForPlan(userPlan) ?? Infinity;

  // For Veteran plan, verify Stripe subscription is active before entering transaction
  if (userPlan === 'veteran') {
    const subId = userPrefs.subscription_id;
    if (!subId) {
      return res.status(403).json({ error: 'No active subscription', message: 'Veteran plan requires an active subscription.' });
    }
    try {
      const stripeLib = await import('stripe');
      const sc = new stripeLib.default(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
      const sub = await sc.subscriptions.retrieve(subId);
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        return res.status(403).json({ error: 'Subscription not active', message: 'Your Veteran subscription is not active.' });
      }
    } catch (err) {
      console.error('[Teams] Failed to verify Veteran subscription on POST /teams:', err);
      return res.status(500).json({ error: 'Subscription verification failed' });
    }
  }

  const t = await prisma.$transaction(async (tx) => {
    const ownedTeamsCount = await tx.teamMembership.count({
      where: { user_id: userId, role: 'owner', status: 'active' },
    });

    if (ownedTeamsCount >= maxTeams) {
      throw Object.assign(new Error('Team limit reached'), {
        status: 403,
        body: {
          error: 'Team limit reached',
          message: `You've reached your limit of ${maxTeams} team${maxTeams > 1 ? 's' : ''}. Upgrade to create more teams.`,
          owned_teams: ownedTeamsCount,
          max_teams: maxTeams,
          upgrade_required: true,
        },
      });
    }

    const team = await tx.team.create({ data: {
      name: parsed.data.name,
      description: parsed.data.description,
      organization_id: parsed.data.organization_id,
      season_start: parsed.data.season_start ? new Date(parsed.data.season_start) : null,
      season_end: parsed.data.season_end ? new Date(parsed.data.season_end) : null,
    } });
    await tx.teamMembership.create({ data: { team_id: team.id, user_id: me.id, role: 'owner' } });
    return team;
  }, { isolationLevel: 'Serializable' });

  return res.status(201).json(t);
  } catch (err: any) {
    if (err?.status && err?.body) {
      return res.status(err.status).json(err.body);
    }
    console.error('[teams] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update team (auth required). Only owners/admins can update.
// Accept full URLs or relative paths (uploads return .path) or empty string to clear
const logoUrlString = z.union([z.string().url(), z.string().regex(/^\/uploads\//).optional().or(z.string()), z.literal('')]);
const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().optional(),
  sport: z.string().trim().optional(),
  season: z.string().trim().optional(),
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
teamsRouter.put('/:id', requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
  debugLog('[Teams PUT] Received update request:', JSON.stringify(req.body));
  // req.user is guaranteed by requireVerified middleware
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Teams PUT] Validation failed:', JSON.stringify(parsed.error));
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  
  const teamId = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Check if user is team owner/manager/coach, org owner, or platform admin
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } }
  });
  const isAdmin = await getIsAdmin(req as any);
  const isTeamStaff = membership && ['owner', 'manager', 'coach'].includes(membership.role);
  let isOrgOwner = false;
  if (team.organization_id) {
    const orgMembership = await prisma.organizationMembership.findFirst({
      where: { organization_id: team.organization_id, user_id: req.user.id, role: 'owner', status: 'active' },
    });
    isOrgOwner = !!orgMembership;
  }
  if (!isAdmin && !isOrgOwner && !isTeamStaff) {
    return res.status(403).json({ error: 'Only team staff, league owners, or admins can update team information' });
  }
  
  const updateData: any = {};
  if (parsed.data.name !== undefined) {
    const filterResult = validateContent({ title: parsed.data.name, content: parsed.data.description ?? undefined });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
    updateData.name = parsed.data.name;
  }
  if (parsed.data.description !== undefined) {
    const filterResult = validateContent({ content: parsed.data.description });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
    updateData.description = parsed.data.description;
  }
  if (parsed.data.sport !== undefined) updateData.sport = parsed.data.sport;
  if (parsed.data.season !== undefined) updateData.season = parsed.data.season;
  if (parsed.data.organization_id !== undefined) {
    if (parsed.data.organization_id === null) {
      updateData.organization_id = null;
    } else {
      const targetOrganizationId = parsed.data.organization_id;
      const targetOrg = await prisma.organization.findUnique({
        where: { id: targetOrganizationId },
        select: { id: true, status: true },
      });
      if (!targetOrg || targetOrg.status !== 'active') {
        return res.status(400).json({ error: 'Target organization not found or inactive' });
      }

      // Team may only be moved into orgs where the requester is an active member (unless platform admin).
      if (!isAdmin && targetOrganizationId !== team.organization_id) {
        const targetMembership = await prisma.organizationMembership.findUnique({
          where: {
            organization_id_user_id: {
              organization_id: targetOrganizationId,
              user_id: req.user.id,
            },
          },
          select: { status: true },
        });
        if (!targetMembership || targetMembership.status !== 'active') {
          return res.status(403).json({
            error: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
            message: 'You must be an active member of the target organization to move this team.',
          });
        }
      }

      updateData.organization_id = targetOrganizationId;
    }
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
    console.error('[teams] update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Delete team (auth required). Only owners/admins can delete.
teamsRouter.delete('/:id', requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  
  const teamId = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Check if user is owner or admin
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } }
  });
  const isAdmin = await getIsAdmin(req as any);
  if (!isAdmin && (!membership || membership.role !== 'owner')) {
    return res.status(403).json({ error: 'Only team owners can delete teams' });
  }
  
  try {
    // Cascade delete: remove all related data, then the team itself
    await prisma.$transaction([
      // Delete team memberships
      prisma.teamMembership.deleteMany({ where: { team_id: teamId } }),
      // Delete team invites
      prisma.teamInvite.deleteMany({ where: { team_id: teamId } }),
      // Delete team follows
      prisma.teamFollow.deleteMany({ where: { team_id: teamId } }),
      // Unlink posts (soft: set team_id to null so posts are preserved)
      prisma.post.updateMany({ where: { team_id: teamId }, data: { team_id: null } }),
      // Unlink group chats
      prisma.groupChat.updateMany({ where: { team_id: teamId }, data: { team_id: null } }),
      // Unlink games (home and away)
      prisma.game.updateMany({ where: { home_team_id: teamId }, data: { home_team_id: null } }),
      prisma.game.updateMany({ where: { away_team_id: teamId }, data: { away_team_id: null } }),
      // Unlink events
      prisma.event.updateMany({ where: { team_id: teamId }, data: { team_id: null } }),
      // Delete the team itself
      prisma.team.delete({ where: { id: teamId } }),
    ]);

    return res.json({ ok: true, message: 'Team deleted successfully' });
  } catch (err: any) {
    console.error('[teams] delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Dev helper: update just the logo_url of a team (useful for testing uploads quickly)
if (process.env.NODE_ENV !== 'production') {
  teamsRouter.post('/:id/dev-set-logo', requireAuth as any, asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { logo_url } = req.body || {};
    try {
  const t = await prisma.team.update({ where: { id }, data: ({ logo_url: logo_url === '' ? null : logo_url } as any) });
  return res.json({ ok: true, team: { id: t.id, logo_url: (t as any).logo_url } });
    } catch (e: any) {
      console.error('dev-set-logo failed', e?.message || e);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }));
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
  onboarding: z.boolean().optional(),
});

teamsRouter.post('/create', requireVerified as any, requireOnboarded as any, requirePlan('rookie') as any, teamCreationLimiter, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  
  const data = parsed.data;
  const userId = req.user!.id;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, preferences: true, approval_status: true, paid_by_owner: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  // SECURITY: Enforce coach role — allow if user has any coach-related DB membership,
  // OR if their profile role is 'coach' (covers new coaches who completed onboarding
  // but haven't created their first team yet).
  const prefsCheck = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const isCoachByPrefs = prefsCheck.role === 'coach';

  if (!isCoachByPrefs) {
    // Only check DB memberships if preferences don't confirm coach role
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
    });

    if (!hasCoachRole && !hasOrgRole) {
      return res.status(403).json({
        error: 'COACH_ROLE_REQUIRED',
        message: 'Only coach accounts can create teams.',
        code: 'COACH_ROLE_REQUIRED'
      });
    }
  }

  // Guard: Coach must be approved before creating teams
  // Exception: League owners creating during onboarding — verified server-side (not client flag)
  if (isCoachByPrefs && me.approval_status !== 'APPROVED') {
    // Server-side onboarding check: user has not completed onboarding AND is an org owner
    const mePrefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
    const isOnboarding = mePrefs.onboarding_completed !== true;
    const isOrgOwner = await prisma.organizationMembership.findFirst({
      where: { user_id: userId, role: 'owner', status: 'active' },
    });
    if (!(isOnboarding && isOrgOwner)) {
      return res.status(403).json({
        error: 'APPROVAL_REQUIRED',
        message: 'Your coach account must be approved by a league admin before creating teams.',
        code: 'APPROVAL_REQUIRED',
      });
    }
  }

  // Check team limit — for paid_by_owner coaches, use the org owner's plan and org team count
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  let effectivePlan = prefs.plan || 'rookie';
  let effectiveSubscriptionId = prefs.subscription_id;
  let teamCountSource: 'user' | 'org' = 'user';
  let orgIdForTeamCount: string | undefined;

  if (me.paid_by_owner) {
    // Look up the org owner's plan
    const orgMembership = await prisma.organizationMembership.findFirst({
      where: { user_id: userId, status: 'active' },
      select: { organization: { select: { id: true, league_owner_id: true } } },
    });
    const ownerId = orgMembership?.organization?.league_owner_id;
    if (ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { preferences: true },
      });
      const ownerPrefs = (owner?.preferences && typeof owner.preferences === 'object') ? (owner.preferences as any) : {};
      effectivePlan = ownerPrefs.plan || 'rookie';
      effectiveSubscriptionId = ownerPrefs.subscription_id;
      teamCountSource = 'org';
      orgIdForTeamCount = orgMembership.organization.id;
    }
  }

  const userPlan = effectivePlan;

  // Legend tier restriction: Only Legend users can create extracurricular clubs
  const clubType = data.club_type || 'sport';
  if (clubType === 'extracurricular' && !planSupportsExtracurricular(userPlan)) {
    return res.status(403).json({
      error: 'Extracurricular clubs require Legend tier',
      message: 'Upgrade to Legend ($19.99/year) to create extracurricular clubs like Theater, Chess, Debate, etc.',
      code: 'LEGEND_TIER_REQUIRED',
      feature: 'extracurricular_clubs',
    });
  }

  // Rookie plan: max 2 teams
  // NOTE: This check is duplicated inside the transaction below for race condition protection
  if (userPlan === 'rookie' || !userPlan || userPlan === 'free') {
    const ownedTeamsCount = teamCountSource === 'org' && orgIdForTeamCount
      ? await prisma.team.count({ where: { organization_id: orgIdForTeamCount } })
      : await prisma.teamMembership.count({
          where: { user_id: me.id, role: 'owner', status: 'active' },
        });

    if (ownedTeamsCount >= 2) {
      return res.status(403).json({
        error: 'Team limit reached',
        message: me.paid_by_owner
          ? "Your organization has reached the free limit (2 teams). The league owner needs to upgrade."
          : "You've reached your free limit (2 teams). Upgrade to add more.",
        code: 'TEAM_LIMIT_EXCEEDED',
        limit: 2,
        current: ownedTeamsCount,
      });
    }
  }

  // Veteran plan: verify subscription quantity matches team count
  if (userPlan === 'veteran') {
    const ownedTeamsCount = teamCountSource === 'org' && orgIdForTeamCount
      ? await prisma.team.count({ where: { organization_id: orgIdForTeamCount } })
      : await prisma.teamMembership.count({
          where: { user_id: me.id, role: 'owner', status: 'active' },
        });

    const subscriptionId = effectiveSubscriptionId;
    if (!subscriptionId) {
      return res.status(403).json({
        error: 'No active subscription',
        message: me.paid_by_owner
          ? 'The league owner needs an active Veteran subscription.'
          : 'Veteran plan requires an active subscription. Please update your billing settings.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    // Check Stripe subscription quantity
    try {
      const stripe = await import('stripe');
      const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return res.status(403).json({
          error: 'Subscription not active',
          message: me.paid_by_owner
            ? "The league owner's Veteran subscription is not active."
            : 'Your Veteran subscription is not active. Please update your billing settings.',
          code: 'SUBSCRIPTION_NOT_ACTIVE',
        });
      }
      
      const subscriptionItem = subscription.items.data[0];
      const paidQuantity = subscriptionItem?.quantity || 0;
      
      // Trying to create team number (ownedTeamsCount + 1)
      // Subscription must cover at least that many teams
      if (ownedTeamsCount >= paidQuantity) {
        return res.status(403).json({
          error: 'Team limit reached',
          message: me.paid_by_owner
            ? `The organization's subscription covers ${paidQuantity} team${paidQuantity > 1 ? 's' : ''} but team #${ownedTeamsCount + 1} is being created. The league owner needs to update the subscription.`
            : `You've paid for ${paidQuantity} team${paidQuantity > 1 ? 's' : ''} but are trying to create team #${ownedTeamsCount + 1}. Please update your subscription first.`,
          code: 'SUBSCRIPTION_QUANTITY_EXCEEDED',
          paid_quantity: paidQuantity,
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

  // If organization_id not provided, try organization_name first, then team name.
  // This is non-fatal: organization_id is optional in the Team schema (String?).
  let organizationId = data.organization_id;
  const requestedOrganizationName = String(data.organization_name || '').trim();

  if (!organizationId) {
    let normalizedOrgName = ''; // hoisted so the catch block can reference it
    try {
      normalizedOrgName = (requestedOrganizationName || data.name.trim()).trim();

      // Reuse an existing active org with the same name if one exists
      const possibleDuplicates = await prisma.organization.findMany({
        where: {
          name: { equals: normalizedOrgName, mode: 'insensitive' },
          status: 'active',
        },
        select: { id: true, name: true },
      });

      if (possibleDuplicates.length > 0) {
        organizationId = possibleDuplicates[0].id;
      } else {
        const newOrg = await prisma.organization.create({
          data: {
            name: normalizedOrgName,
            // Don't copy team description to org — they are separate entities
            sport: data.sport || undefined,
            org_type: 'club',
            location: data.city || data.venue_address || undefined,
            updated_at: new Date(),
          },
        });
        organizationId = newOrg.id;

        await prisma.organizationMembership.create({
          data: { organization_id: newOrg.id, user_id: me.id, role: 'owner' },
        });
      }
    } catch (orgError: any) {
      console.error('[Teams] Failed to create/associate organization:', orgError);
      // P2002 = unique constraint — a concurrent/prior attempt already created this org; find & reuse it
      if (orgError?.code === 'P2002' && normalizedOrgName) {
        try {
          const existingOrg = await prisma.organization.findFirst({
            where: { name: { equals: normalizedOrgName, mode: 'insensitive' } },
            select: { id: true },
          });
          if (existingOrg) organizationId = existingOrg.id;
        } catch { /* ignore — continue without org */ }
      }
      // Org creation failed — log for visibility but continue (user can link later)
      console.warn('[teams] Organization auto-creation failed for team. Team will be created without org link.', orgError?.message || orgError);
    }
  } else {
    // Validate organization_id if provided (fail fast if invalid)
    try {
      const orgExists = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, status: true, name: true }
      });

      if (!orgExists || orgExists.status !== 'active') {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'The specified organization does not exist or is not active.',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      // Check target org is admin-approved before creating a team under it
      if (!(await isOrganizationApproved(organizationId, prisma))) {
        // Exception: org owners during onboarding are creating their first team before org gets approved
        const isOnboarding = prefsCheck.onboarding_completed !== true;
        const isOrgOwnerOfTarget = await prisma.organizationMembership.findFirst({
          where: { organization_id: organizationId, user_id: me.id, role: 'owner', status: 'active' },
        });
        if (!(isOnboarding && isOrgOwnerOfTarget)) {
          return res.status(403).json({
            error: 'ORGANIZATION_NOT_APPROVED',
            message: 'Teams can only be created under organizations that have been approved by VarsityHub.',
            code: 'ORGANIZATION_NOT_APPROVED',
          });
        }
      }

      // Enforce org hierarchy: requester must already be an active member of target org.
      const orgMembership = await prisma.organizationMembership.findUnique({
        where: { organization_id_user_id: { organization_id: organizationId, user_id: me.id } },
        select: { status: true },
      });

      if (!orgMembership || orgMembership.status !== 'active') {
        return res.status(403).json({
          error: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
          message: 'You must be an active member of this organization to create a team under it.',
          code: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
        });
      }
    } catch (orgError: any) {
      console.error('[Teams] Failed to validate organization:', orgError);
      // Surface the real error for debugging
      const detail = orgError?.code === 'P2002' ? 'Organization membership already exists' : (orgError?.message || 'Unknown error');
      return res.status(500).json({
        error: `Organization validation failed: ${detail}`,
      });
    }
  }
  
  // Now create team with guaranteed organization_id
  // CRITICAL: Use transaction to prevent race condition bypassing team limits
  try {
    const team = await prisma.$transaction(async (tx) => {
      // Re-check team limit atomically within transaction to prevent race conditions
      const ownedTeamsInTx = await tx.teamMembership.count({
        where: { user_id: me.id, role: 'owner', status: 'active' },
      });

      if (userPlan === 'rookie' || !userPlan || userPlan === 'free') {
        if (ownedTeamsInTx >= 2) {
          throw new Error('TEAM_LIMIT_EXCEEDED:Rookie plan allows maximum 2 teams');
        }
      } else if (userPlan === 'veteran') {
        // Re-verify Stripe quantity inside transaction to prevent race condition
        const subId = effectiveSubscriptionId;
        if (subId) {
          try {
            const stripeLib = await import('stripe');
            const sc = new stripeLib.default(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
            const sub = await sc.subscriptions.retrieve(subId);
            const paidQty = sub.items.data[0]?.quantity || 0;
            if (ownedTeamsInTx >= paidQty) {
              throw new Error(`TEAM_LIMIT_EXCEEDED:Subscription covers ${paidQty} teams but you already own ${ownedTeamsInTx}`);
            }
          } catch (err: any) {
            if (err?.message?.startsWith('TEAM_LIMIT_EXCEEDED:')) throw err;
            throw new Error('TEAM_LIMIT_EXCEEDED:Unable to verify subscription. Please try again.');
          }
        }
      }

      // Create team
      const newTeam = await tx.team.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          sport: data.sport?.trim() || null,
          club_type: data.club_type || 'sport',
          extracurricular_category: data.extracurricular_category?.trim() || null,
          season: data.season?.trim() || null,
          primary_color: data.primary_color?.trim() || null,
          season_start: data.season_start ? new Date(data.season_start) : null,
          season_end: data.season_end ? new Date(data.season_end) : null,
          organization_id: organizationId, // Now guaranteed to exist
          logo_url: data.logo_url || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          league: data.league?.trim() || null,
          venue_place_id: data.venue_place_id || null,
          venue_lat: data.venue_lat || null,
          venue_lng: data.venue_lng || null,
          venue_address: data.venue_address?.trim() || null,
        }
      });

      // Create team membership (owner) in same transaction
      await tx.teamMembership.create({
        data: {
          team_id: newTeam.id,
          user_id: me.id,
          role: 'owner',
          status: 'active'
        }
      });

      return newTeam;
    }, { isolationLevel: 'Serializable' });

    // Handle authorized users if provided
    if (data.authorized_users && Array.isArray(data.authorized_users) && data.authorized_users.length > 0) {
      try {
      const validInviteRoles = new Set(['manager', 'coach', 'assistant_coach', 'player', 'parent', 'member', 'equipment', 'health_wellness']);
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

          // Send invite emails (non-blocking)
          try {
            const [inviter, createdInvites] = await Promise.all([
              prisma.user.findUnique({ where: { id: me.id }, select: { display_name: true } }),
              prisma.teamInvite.findMany({
                where: { team_id: team.id, email: { in: invites.map(i => i.email) } },
                select: { id: true, email: true },
              }),
            ]);
            const tokenByEmail = Object.fromEntries(createdInvites.map(i => [i.email, i.id]));
            await Promise.all(invites.map(async (inv) => {
              try {
                await sendTeamInviteEmail({
                  to: inv.email,
                  teamName: team.name,
                  organizationName: null,
                  role: inv.role,
                  inviterName: inviter?.display_name || 'Team Owner',
                  teamHeroUrl: team.logo_url || undefined,
                  teamLogoUrl: team.avatar_url || undefined,
                  inviteToken: tokenByEmail[inv.email],
                });
              } catch (error) {
                console.warn('[Teams] Failed to send team invite email:', error);
              }
            }));
          } catch (emailError) {
            console.warn('[Teams] Failed to send invite emails (non-blocking):', emailError);
          }
        }
      } catch (inviteError: any) {
        console.warn('[Teams] Failed to create invites (non-blocking):', inviteError);
        // Non-blocking - team is already created
      }
    }
    
    return res.status(201).json({
      ok: true,
      team: {
        id: team.id,
        name: team.name,
        organization_id: team.organization_id,
      }
    });
  } catch (teamError: any) {
    console.error('[Teams] Failed to create team:', teamError);

    // Handle specific transaction errors
    if (teamError?.message?.includes('TEAM_LIMIT_EXCEEDED')) {
      return res.status(403).json({
        error: 'Team limit reached',
        message: "You've reached your free limit (2 teams). Upgrade to add more.",
        code: 'TEAM_LIMIT_EXCEEDED',
        limit: 2
      });
    }

    // Surface the real error for debugging
    const detail = teamError?.message || 'Unknown error';
    return res.status(500).json({
      error: `Team creation failed: ${detail}`,
    });
  }
});

// Invite user by email to a team
const inviteSchema = z.object({ email: z.string().email(), role: z.string().optional() });
const VALID_TEAM_INVITE_ROLES = ['manager', 'coach', 'assistant_coach', 'player', 'parent', 'member', 'equipment', 'health_wellness'] as const;
teamsRouter.post('/:id/invite', requireAuth as any, requireVerified as any, requireOnboarded as any, inviteLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const { email, role } = parsed.data;
  const assignedRole = String(role || 'member');
  if (!(VALID_TEAM_INVITE_ROLES as readonly string[]).includes(assignedRole)) {
    return res.status(400).json({
      error: 'Invalid role',
      valid_roles: VALID_TEAM_INVITE_ROLES,
    });
  }
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  // CRITICAL: Verify requester is team owner/manager/coach (can invite members)
  const requesterMembership = await prisma.teamMembership.findFirst({
    where: {
      team_id: id,
      user_id: req.user.id,
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active'
    }
  });
  
  if (!requesterMembership) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can invite members to teams.'
    });
  }
  
  // PLAN LIMITS: Enforce authorized user caps based on TEAM OWNER's plan (Rule B).
  // Authorized users are covered by the coach's plan — never charged individually.
  // CRITICAL: Use transaction to prevent race condition bypassing user limits.
  let invite;
  try {
    // Look up the team OWNER's plan (not the inviting user's plan)
    const ownerMembership = await prisma.teamMembership.findFirst({
      where: { team_id: id, role: 'owner', status: 'active' },
      select: { user_id: true },
    });
    const ownerId = ownerMembership?.user_id || req.user.id;
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    const ownerPrefs = (owner?.preferences || {}) as any;
    // Use confirmed plan only — pending_plan is not yet paid for
    const plan = ownerPrefs.payment_pending ? 'rookie' : (ownerPrefs.plan || 'rookie');

    // Get per-team limit from the owner's plan definitions
    const limit = getAuthorizedUsersPerTeam(plan);

    // Create invite within transaction to prevent race conditions
    invite = await prisma.$transaction(async (tx) => {
      if (limit !== null) {
        // Count atomically within transaction
        const inviteCount = await tx.teamInvite.count({ where: { team_id: id, status: 'pending' } });
        const memberCount = await tx.teamMembership.count({ where: { team_id: id, status: 'active', role: { in: ['manager','coach','assistant_coach','equipment','health_wellness'] } } });
        const totalAuthorized = inviteCount + memberCount;

        if (totalAuthorized >= limit) {
          throw new Error(`USER_LIMIT_REACHED:${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} per team`);
        }
      }

      // Create invite within same transaction
      return await tx.teamInvite.create({ data: { team_id: id, email, role: assignedRole as any } });
    });
  } catch (e: any) {
    // Handle specific limit errors
    if (e?.message?.includes('USER_LIMIT_REACHED')) {
      const [, message] = e.message.split(':');
      return res.status(403).json({
        error: 'USER_LIMIT_REACHED',
        message: message || 'Plan limit reached for authorized users.'
      });
    }

    console.warn('[teams][invite-limit] check failed', e);
    return res.status(500).json({
      error: 'Failed to create invite',
      message: 'Unable to create team invite. Please try again.'
    });
  }
  // Send invite email (best effort)
  const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { display_name: true } });
  try {
    await sendTeamInviteEmail({
      to: email,
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
  const invitedUser = await prisma.user.findUnique({
    where: { email },
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
            role: assignedRole
          }
        }
      });
      // Push notification (respect team_updates preference)
      const prefs = (invitedUser.preferences || {}) as any;
      if (prefs?.notifications?.team_updates !== false) {
        const inviterName = inviter?.display_name || 'A coach';
        await sendPushNotification(
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
        );
      }
    } catch (error) {
      console.error('Failed to create team invite notification:', error);
      // Continue even if notification fails
    }
  }
  
  return res.status(201).json(invite);
}));

// List invites for the authed user's email
teamsRouter.get('/invites/me', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email) return res.status(400).json({ error: 'User email not found' });
  const invites = await prisma.teamInvite.findMany({ where: { email: user.email, status: 'pending' }, include: { team: true }, orderBy: { created_at: 'desc' }, take: 100 });
  const list = invites.map((i) => ({ id: i.id, role: i.role, created_at: i.created_at, team: { id: i.team_id, name: (i as any).team?.name || '' } }));
  return res.json(list);
  } catch (err) {
    console.error('[teams] invites-me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept invite
teamsRouter.post('/invites/:inviteId/accept', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const inviteId = String(req.params.inviteId);
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invite not found' });
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
  await prisma.$transaction([
    prisma.teamMembership.upsert({
      where: { team_id_user_id: { team_id: invite.team_id, user_id: user.id } } as any,
      update: { role: roleToApply, status: 'active' },
      create: { team_id: invite.team_id, user_id: user.id, role: roleToApply, status: 'active' },
    }),
    prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
  ]);

  // Check if team group chat exists, if not create it
  try {
    let groupChat = await prisma.groupChat.findFirst({
      where: { team_id: invite.team_id },
    });

    if (!groupChat) {
      // Get team info
      const team = await prisma.team.findUnique({ where: { id: invite.team_id } });
      
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

  // Notify team coaches/owners that the invite was accepted
  try {
    const team = await prisma.team.findUnique({ where: { id: invite.team_id }, select: { id: true, name: true } });
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
      await Promise.allSettled(managers.map(mgr =>
        sendPushNotification(
          mgr.user_id,
          `${accepterName} joined ${teamName}`,
          `Your team invite was accepted`,
          { type: 'team_invite_accepted', team_id: invite.team_id, screen: 'team-page' }
        )
      ));
    }
  } catch (notifErr) {
    console.error('[teams] Failed to send invite accepted notification:', notifErr);
  }

  return res.json({ ok: true });
  } catch (err) {
    console.error('[teams] accept-invite error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Decline invite
teamsRouter.post('/invites/:inviteId/decline', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const inviteId = String(req.params.inviteId);
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invite not found' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) return res.status(403).json({ error: 'Invite not for this user' });
  await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'declined' } });

  // Notify team coaches/owners that the invite was declined
  try {
    const team = await prisma.team.findUnique({ where: { id: invite.team_id }, select: { id: true, name: true } });
    const teamName = team?.name || 'your team';
    const declinerName = user.display_name || user.email || 'Someone';

    const managers = await prisma.teamMembership.findMany({
      where: {
        team_id: invite.team_id,
        role: { in: ['owner', 'manager', 'coach'] },
        status: 'active',
      },
      select: { user_id: true },
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
      await Promise.allSettled(managers.map(mgr =>
        sendPushNotification(
          mgr.user_id,
          `Invite declined`,
          `${declinerName} declined the invite to ${teamName}`,
          { type: 'team_invite_declined', team_id: invite.team_id, screen: 'team-page' }
        )
      ));
    }
  } catch (notifErr) {
    console.error('[teams] Failed to send invite declined notification:', notifErr);
  }

  return res.json({ ok: true });
  } catch (err) {
    console.error('[teams] decline-invite error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Transfer team ownership
teamsRouter.post('/:id/transfer-ownership', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const teamId = String(req.params.id);
  const transferSchema = z.object({ new_owner_id: z.string().min(1) });
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { new_owner_id } = parsed.data;

  // Verify current user is the owner
  const currentMembership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } }
  });
  if (!currentMembership || currentMembership.role !== 'owner') {
    return res.status(403).json({ error: 'Only the team owner can transfer ownership' });
  }

  // Verify new owner is a member of the team
  const newOwnerMembership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: new_owner_id } }
  });
  if (!newOwnerMembership) {
    return res.status(400).json({ error: 'New owner must be an existing team member' });
  }

  // Transfer: demote current owner to manager, promote new owner
  await prisma.$transaction([
    prisma.teamMembership.update({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
      data: { role: 'manager' }
    }),
    prisma.teamMembership.update({
      where: { team_id_user_id: { team_id: teamId, user_id: new_owner_id } },
      data: { role: 'owner' }
    })
  ]);

  return res.json({ ok: true, message: 'Ownership transferred successfully' });
  } catch (err) {
    console.error('[teams] transfer-ownership error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
