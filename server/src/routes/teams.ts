import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const teamsRouter = Router();

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
    orderBy: { created_at: 'desc' },
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

// List teams with member counts; optional search q
teamsRouter.get('/', async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const all = String((req.query as any).all || '') === '1';
  const mine = String((req.query as any).mine || '') === '1';
  const directory = String((req.query as any).directory || '') === '1'; // Team directory search
  
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
    sport: t.sport || null,
    venue: (t as any).venue_place_id ? {
      place_id: (t as any).venue_place_id,
      lat: (t as any).venue_lat,
      lng: (t as any).venue_lng,
      address: (t as any).venue_address,
      updated_at: (t as any).venue_updated_at,
    } : null,
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
  });
});

// Team members list
teamsRouter.get('/:id/members', async (req, res) => {
  const id = String(req.params.id);
  const mems = await prisma.teamMembership.findMany({
    where: { team_id: id },
    orderBy: { created_at: 'asc' },
    include: { user: true },
  });
  const list = mems.map((m) => ({ id: m.id, role: m.role, status: m.status, user: { id: m.user_id, email: (m as any).user?.email || null, display_name: (m as any).user?.display_name || null } }));
  return res.json(list);
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
const createSchema = z.object({ name: z.string().min(2), description: z.string().optional() });
teamsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const t = await prisma.team.create({ data: { name: parsed.data.name, description: parsed.data.description } });
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
  console.log('[Teams PUT] Received update request:', JSON.stringify(req.body));
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Teams PUT] Validation failed:', JSON.stringify(parsed.error));
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  }
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
    return res.status(403).json({ error: 'Only team owners can update team information' });
  }
  
  const updateData: any = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
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
  
  console.log('[Teams PUT] Prepared update data:', JSON.stringify(updateData));
  
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
    console.log('[Teams PUT] Update successful');
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
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  organization_id: z.string().optional(),
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
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  
  // Check team limit for free tier (Rookie plan)
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userPlan = prefs.plan || 'rookie';
  const userRole = prefs.role || 'fan';
  
  // Rookie plan: max 2 teams as owner
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
  
  // Create team
  const team = await prisma.team.create({ 
    data: {
      name: data.name,
      description: data.description,
      sport: data.sport,
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
    const invites = data.authorized_users
      .filter(user => user.email)
      .map(user => ({
        team_id: team.id,
        email: user.email!,
        role: user.role || 'member',
      }));
    
    if (invites.length > 0) {
      await prisma.teamInvite.createMany({
        data: invites,
        skipDuplicates: true,
      });
    }
  }
  
  return res.status(201).json(team);
});

// Invite user by email to a team
const inviteSchema = z.object({ email: z.string().email(), role: z.string().optional() });
teamsRouter.post('/:id/invite', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, role } = parsed.data;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  
  // Create the invite
  const invite = await prisma.teamInvite.create({ data: { team_id: id, email, role: role || 'member' } });
  
  // Find the invited user by email and create notification if they exist
  const invitedUser = await prisma.user.findUnique({ where: { email } });
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
