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
    my_role: (t as any).memberships?.[0]?.role || null
  }));
  
  return res.json(list);
});

// List teams with member counts; optional search q
teamsRouter.get('/', async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const all = String((req.query as any).all || '') === '1';
  const mine = String((req.query as any).mine || '') === '1';
  
  if (all) {
    // Admin-only view flag; otherwise fall back to normal list
    const isAdmin = await getIsAdmin(req as any);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
  }
  
  let where: any = {};
  if (q) where.name = { contains: q, mode: 'insensitive' };
  
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
  const list = rows.map((t) => ({ id: t.id, name: t.name, description: t.description, status: t.status, members: (t as any)._count.memberships, logo_url: (t as any).logo_url || null, avatar_url: (t as any).avatar_url || null }));
  return res.json(list);
});

// Team details with counts
teamsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const t = await prisma.team.findUnique({ where: { id }, include: { _count: { select: { memberships: true } } } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  return res.json({ id: t.id, name: t.name, description: t.description, status: t.status, members: (t as any)._count.memberships, logo_url: (t as any).logo_url || null, avatar_url: (t as any).avatar_url || null });
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
  logo_url: z.string().optional().or(z.literal('')),
});
teamsRouter.put('/:id', requireVerified as any, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
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
  if (parsed.data.logo_url !== undefined) updateData.logo_url = parsed.data.logo_url === '' ? null : parsed.data.logo_url;
  
  try {
  const updatedTeam = await prisma.team.update({ where: { id: teamId }, data: updateData as any });
    // Return a compact team object including logo/avatar fields for client convenience
    return res.json({ id: updatedTeam.id, name: updatedTeam.name, description: updatedTeam.description, sport: updatedTeam.sport, season_start: updatedTeam.season_start, season_end: updatedTeam.season_end, logo_url: (updatedTeam as any).logo_url || null, avatar_url: (updatedTeam as any).avatar_url || null, status: updatedTeam.status, created_at: updatedTeam.created_at });
  } catch (err: any) {
    console.error('Failed to update team', err?.message || err);
    // Handle common Prisma client runtime errors gracefully
    return res.status(500).json({ error: 'Failed to update team', detail: err?.message || String(err) });
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
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  
  // Create team
  const team = await prisma.team.create({ 
    data: {
      name: data.name,
      description: data.description,
      sport: data.sport,
      season_start: data.season_start ? new Date(data.season_start) : null,
      season_end: data.season_end ? new Date(data.season_end) : null,
      organization_id: data.organization_id,
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
  const invite = await prisma.teamInvite.create({ data: { team_id: id, email, role: role || 'member' } });
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
  await prisma.$transaction([
    prisma.teamMembership.upsert({ where: { team_id_user_id: { team_id: invite.team_id, user_id: user.id } } as any, update: { role: invite.role, status: 'active' }, create: { team_id: invite.team_id, user_id: user.id, role: invite.role, status: 'active' } }),
    prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
  ]);
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
