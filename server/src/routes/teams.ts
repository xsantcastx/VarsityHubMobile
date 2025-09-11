import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { z } from 'zod';
import { getIsAdmin } from '../middleware/requireAdmin.js';

export const teamsRouter = Router();

// List teams with member counts; optional search q
teamsRouter.get('/', async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const all = String((req.query as any).all || '') === '1';
  if (all) {
    // Admin-only view flag; otherwise fall back to normal list
    const isAdmin = await getIsAdmin(req as any);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
  }
  const where: any = {};
  if (q) where.name = { contains: q, mode: 'insensitive' };
  const rows = await prisma.team.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { memberships: true } } },
  });
  const list = rows.map((t) => ({ id: t.id, name: t.name, description: t.description, status: t.status, members: (t as any)._count.memberships }));
  return res.json(list);
});

// Team details with counts
teamsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const t = await prisma.team.findUnique({ where: { id }, include: { _count: { select: { memberships: true } } } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  return res.json({ id: t.id, name: t.name, description: t.description, status: t.status, members: (t as any)._count.memberships });
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
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const t = await prisma.team.create({ data: { name: parsed.data.name, description: parsed.data.description } });
  await prisma.teamMembership.create({ data: { team_id: t.id, user_id: me.id, role: 'owner' } });
  return res.status(201).json(t);
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
