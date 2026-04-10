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
import { getAuthorizedUsersPerTeam, getMaxTeamsForPlan } from '../lib/planLimits.js';

export const teamsRouter = Router();
const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

async function canManageTeamMembers(teamId: string, userId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findFirst({
    where: {
      team_id: teamId,
      user_id: userId,
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active',
    },
  });
  return Boolean(membership);
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
  
  // Get plan from preferences, fallback to subscription_tier
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const plan = prefs.plan || user.subscription_tier || 'rookie';
  
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

// Follow a team
teamsRouter.post('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const teamId = String(req.params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  try {
    await prisma.teamFollow.create({ data: { user_id: userId, team_id: teamId } });
    return res.status(201).json({ is_following: true });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(201).json({ is_following: true }); // Already following
    throw e;
  }
});

// Unfollow a team
teamsRouter.delete('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const teamId = String(req.params.id);
  await prisma.teamFollow.deleteMany({ where: { user_id: userId, team_id: teamId } });
  return res.json({ is_following: false });
});

// Team details with counts
teamsRouter.get('/:id', async (req, res) => {
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
});

// Team members list
teamsRouter.get('/:id/members', async (req, res) => {
  const id = String(req.params.id);
  const mems = await prisma.teamMembership.findMany({
    where: { team_id: id },
    orderBy: { created_at: 'asc' },
    include: { 
      user: {
        select: {
          id: true,
          email: true,
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
      position: (m as any).position || null,
      jersey_number: (m as any).jersey_number || null,
      user: {
        id: m.user_id,
        email: user?.email || null,
        display_name: user?.display_name || null,
        avatar_url: user?.avatar_url || null,
        username: user?.username || null,
        is_parent: prefs?.is_parent === true,
      }
    };
  });
  return res.json(list);
});

teamsRouter.patch('/:id/members/:userId', requireAuth as any, async (req: AuthedRequest, res) => {
  const teamId = String(req.params.id);
  const userId = String(req.params.userId);
  const { role } = (req.body || {}) as { role?: string };

  if (!role) return res.status(400).json({ error: 'role is required' });

  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } } as any,
  });
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const canManage = await canManageTeamMembers(teamId, req.user!.id);
  if (!canManage) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can update roles.',
    });
  }

  const updated = await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { role: String(role) },
  });
  return res.json(updated);
});

teamsRouter.delete('/:id/members/:userId', requireAuth as any, async (req: AuthedRequest, res) => {
  const teamId = String(req.params.id);
  const userId = String(req.params.userId);
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } } as any,
  });
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const canManage = await canManageTeamMembers(teamId, req.user!.id);
  const isSelf = req.user!.id === membership.user_id;
  if (!canManage && !isSelf) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can remove members.',
    });
  }

  await prisma.teamMembership.delete({ where: { id: membership.id } });
  return res.json({ ok: true });
});

// All members across teams (for admin screens); optional search q
teamsRouter.get('/members/all', requireAuth as any, async (req, res) => {
  const isAdmin = await getIsAdmin(req as any);
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
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
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().optional(),
});
teamsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, preferences: true } });
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
  
  // Check team ownership limit
  const ownedTeamsCount = await prisma.teamMembership.count({
    where: {
      user_id: me.id,
      role: 'owner',
      status: 'active'
    }
  });
  
  const maxTeams = (me as any).max_teams ?? 2; // Default to 2 for free users
  
  if (ownedTeamsCount >= maxTeams) {
    return res.status(403).json({ 
      error: 'Team limit reached',
      message: `You've reached your limit of ${maxTeams} team${maxTeams > 1 ? 's' : ''}. Upgrade to create more teams.`,
      owned_teams: ownedTeamsCount,
      max_teams: maxTeams,
      upgrade_required: true
    });
  }

  const filterResult = validateContent({ title: parsed.data.name, content: parsed.data.description ?? undefined });
  if (!filterResult.valid) {
    return res.status(400).json({ error: filterResult.error, code: filterResult.code });
  }
  
  const t = await prisma.team.create({ data: { name: parsed.data.name, description: parsed.data.description } });
  await prisma.teamMembership.create({ data: { team_id: t.id, user_id: me.id, role: 'owner' } });
  return res.status(201).json(t);
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
teamsRouter.put('/:id', requireVerified as any, async (req: AuthedRequest, res) => {
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
  
  // Check if user is owner or admin
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } }
  });
  const isAdmin = await getIsAdmin(req as any);
  if (!isAdmin && (!membership || membership.role !== 'owner')) {
    return res.status(403).json({ error: 'Only team owners can update team information' });
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
});

teamsRouter.post('/create', requireVerified as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  
  const data = parsed.data;
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  
  // Check team limit for free tier (Rookie plan)
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userPlan = prefs.plan || 'rookie';
  const userRole = prefs.role || 'fan';

  // Enforce coach role requirement for team creation
  if (userRole !== 'coach') {
    return res.status(403).json({
      error: 'COACH_ROLE_REQUIRED',
      message: 'Only coach accounts can create teams.',
      code: 'COACH_ROLE_REQUIRED'
    });
  }
  
  // Legend tier restriction: Only Legend users can create extracurricular clubs
  const clubType = data.club_type || 'sport';
  if (clubType === 'extracurricular' && userPlan !== 'legend') {
    return res.status(403).json({
      error: 'Extracurricular clubs require Legend tier',
      message: 'Upgrade to Legend ($19.99/year) to create extracurricular clubs like Theater, Chess, Debate, etc.',
      code: 'LEGEND_TIER_REQUIRED',
      feature: 'extracurricular_clubs',
    });
  }
  
  // Rookie plan: max 2 teams as owner
  // NOTE: This check is duplicated inside the transaction below for race condition protection
  if (userPlan === 'rookie' || !userPlan || userPlan === 'free') {
    const ownedTeamsCount = await prisma.teamMembership.count({
      where: {
        user_id: me.id,
        role: 'owner',
        status: 'active',
      },
    });

    if (ownedTeamsCount >= 2) {
      return res.status(403).json({
        error: 'Team limit reached',
        message: "You've reached your free limit (2 teams). Upgrade to add more.",
        code: 'TEAM_LIMIT_EXCEEDED',
        limit: 2,
        current: ownedTeamsCount,
      });
    }
  }
  
  // Veteran plan: verify subscription quantity matches team count
  if (userPlan === 'veteran') {
    const ownedTeamsCount = await prisma.teamMembership.count({
      where: {
        user_id: me.id,
        role: 'owner',
        status: 'active',
      },
    });
    
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
      
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return res.status(403).json({
          error: 'Subscription not active',
          message: 'Your Veteran subscription is not active. Please update your billing settings.',
          code: 'SUBSCRIPTION_NOT_ACTIVE',
        });
      }
      
      const subscriptionItem = subscription.items.data[0];
      const paidQuantity = subscriptionItem?.quantity || 0;
      
      const includedTotalTeams = paidQuantity + 2;
      const requestedTeamNumber = ownedTeamsCount + 1;

      // Veteran charges only for teams beyond the first two free slots.
      // Stripe quantity stores billable teams, so convert it back to total allowed teams.
      if (requestedTeamNumber > includedTotalTeams) {
        return res.status(403).json({
          error: 'Team limit reached',
          message: `Your subscription currently covers ${includedTotalTeams} total team${includedTotalTeams === 1 ? '' : 's'} (${paidQuantity} billable beyond the first 2 free). Please update your subscription before creating team #${requestedTeamNumber}.`,
          code: 'SUBSCRIPTION_QUANTITY_EXCEEDED',
          paid_quantity: paidQuantity,
          included_total_teams: includedTotalTeams,
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
            description: data.description || undefined,
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
      // For any unrecoverable error: continue team creation without an org
      // (organization_id is optional — the user can link one later)
    }
  } else {
    // Validate organization_id if provided (fail fast if invalid)
    try {
      const orgExists = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, status: true }
      });
      
      if (!orgExists || orgExists.status !== 'active') {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'The specified organization does not exist or is not active.',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }
    } catch (orgError: any) {
      console.error('[Teams] Failed to validate organization:', orgError);
      return res.status(500).json({
        error: 'Failed to validate organization',
        message: 'Unable to verify organization. Please try again.',
        detail: orgError?.message || String(orgError)
      });
    }
  }
  
  // Now create team with guaranteed organization_id
  // CRITICAL: Use transaction to prevent race condition bypassing team limits
  try {
    const team = await prisma.$transaction(async (tx) => {
      // Re-check team limit atomically within transaction to prevent race conditions
      if (userPlan === 'rookie' || !userPlan || userPlan === 'free') {
        const ownedTeamsCount = await tx.teamMembership.count({
          where: {
            user_id: me.id,
            role: 'owner',
            status: 'active',
          },
        });

        if (ownedTeamsCount >= 2) {
          throw new Error('TEAM_LIMIT_EXCEEDED:Rookie plan allows maximum 2 teams');
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
    });
    
    // Handle authorized users if provided
    if (data.authorized_users && Array.isArray(data.authorized_users) && data.authorized_users.length > 0) {
      try {
        const invites = data.authorized_users
          .filter(user => user.email)
          .map(user => ({
            team_id: team.id,
            email: user.email!,
            role: (user.role || 'member') as any,
            invited_by: me.id,
          }));
        
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

    return res.status(500).json({
      error: 'Failed to create team',
      message: 'Unable to create team. Please try again.',
      detail: teamError?.message || String(teamError)
    });
  }
});

// Invite user by email to a team
const inviteSchema = z.object({ email: z.string().email(), role: z.string().optional() });
teamsRouter.post('/:id/invite', async (req: AuthedRequest, res) => {
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
  
  // PLAN LIMITS: Enforce authorized user caps (per-team limits)
  // CRITICAL: Use transaction to prevent race condition bypassing user limits
  let invite;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const prefs = (user?.preferences || {}) as any;
    const plan = prefs.plan || 'rookie';

    // Get per-team limit from plan definitions
    const limit = getAuthorizedUsersPerTeam(plan);

    // Create invite within transaction to prevent race conditions
    invite = await prisma.$transaction(async (tx) => {
      if (limit !== null) {
        // Count atomically within transaction
        const inviteCount = await tx.teamInvite.count({ where: { team_id: id, status: 'pending' } });
        const memberCount = await tx.teamMembership.count({ where: { team_id: id, role: { in: ['manager','coach','assistant_coach','equipment','health_wellness'] } } });
        const totalAuthorized = inviteCount + memberCount;

        if (totalAuthorized >= limit) {
          throw new Error(`USER_LIMIT_REACHED:${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} per team`);
        }
      }

      // Create invite within same transaction
      return await tx.teamInvite.create({ data: { team_id: id, email, role: role || 'member' } });
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
      role: role || 'member',
      teamHeroUrl: team.logo_url || undefined,
      teamLogoUrl: team.avatar_url || undefined,
      inviterName: inviter?.display_name || 'Team Owner',
      inviteToken: invite.id,
    });
  } catch (_error) {}
  
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
            role: role || 'member'
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

  return res.json({ ok: true });
});

// Decline invite
teamsRouter.post('/invites/:inviteId/decline', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const inviteId = String(req.params.inviteId);
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invite not found' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) return res.status(403).json({ error: 'Invite not for this user' });
  await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'declined' } });
  return res.json({ ok: true });
});
