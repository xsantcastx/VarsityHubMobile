import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { prisma } from '../lib/prisma.js';

export const teamMembershipsRouter = Router();

// POST /team-memberships { team_id, user_id, role }
teamMembershipsRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { team_id, user_id, role } = (req.body || {}) as any;
  if (!team_id || !user_id) return res.status(400).json({ error: 'team_id and user_id required' });
  const team = await prisma.team.findUnique({ where: { id: String(team_id) } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const user = await prisma.user.findUnique({ where: { id: String(user_id) } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const m = await prisma.teamMembership.upsert({
    where: { team_id_user_id: { team_id: String(team_id), user_id: String(user_id) } } as any,
    update: { role: String(role || 'member'), status: 'active' },
    create: { team_id: String(team_id), user_id: String(user_id), role: String(role || 'member'), status: 'active' },
  });
  return res.status(201).json(m);
});

const membershipUpdateSchema = z.object({
  role: z.string().min(2).max(64).optional(),
  status: z.enum(['active', 'inactive', 'invited', 'archived']).optional(),
  custom_position: z.union([z.string().max(120), z.literal(''), z.null()]).optional(),
});

teamMembershipsRouter.patch('/:id', authMiddleware as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const membershipId = String(req.params.id);
  const existing = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!existing) return res.status(404).json({ error: 'Membership not found' });

  const parsed = membershipUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  }

  const actorMembership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: existing.team_id, user_id: req.user.id } },
  });
  const isAdmin = await getIsAdmin(req as any);
  const privilegedRoles = ['owner', 'manager', 'coach', 'assistant_coach'];
  const isSelf = existing.user_id === req.user.id;
  const canManage =
    isAdmin ||
    isSelf ||
    (actorMembership ? privilegedRoles.includes(actorMembership.role) : false);

  if (!canManage) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const data: any = {};
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (Object.hasOwn(parsed.data, 'custom_position')) {
    const value = parsed.data.custom_position;
    data.custom_position = value && value.trim() ? value.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    const refreshed = await prisma.teamMembership.findUnique({
      where: { id: membershipId },
      include: { user: true },
    });
    return res.json(refreshed);
  }

  const updated = await prisma.teamMembership.update({
    where: { id: membershipId },
    data,
    include: { user: true },
  });

  return res.json({
    id: updated.id,
    role: updated.role,
    status: updated.status,
    custom_position: updated.custom_position,
    user: updated.user
      ? {
          id: updated.user_id,
          email: (updated as any).user?.email || null,
          display_name: (updated as any).user?.display_name || null,
        }
      : null,
  });
});
