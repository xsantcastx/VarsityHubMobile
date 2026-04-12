import { MembershipStatus, TeamRole } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const teamMembershipsRouter = Router();

const TEAM_MANAGEMENT_ROLES = [
  TeamRole.owner,
  TeamRole.manager,
  TeamRole.coach,
  TeamRole.assistant_coach,
] as const;
const TEAM_ROLE_VALUES = new Set<TeamRole>(Object.values(TeamRole));

function parseTeamRole(role: unknown): TeamRole | null {
  if (typeof role !== 'string') return null;
  const normalized = role.trim().toLowerCase();
  return TEAM_ROLE_VALUES.has(normalized as TeamRole) ? (normalized as TeamRole) : null;
}

async function canManageTeam(req: AuthedRequest, teamId: string): Promise<boolean> {
  if (!req.user) return false;
  const membership = await prisma.teamMembership.findFirst({
    where: {
      team_id: teamId,
      user_id: req.user.id,
      role: { in: [...TEAM_MANAGEMENT_ROLES] },
      status: MembershipStatus.active,
    },
  });
  return Boolean(membership);
}

// POST /team-memberships { team_id, user_id, role }
// Only team owners/managers/coaches can add members to their teams.
teamMembershipsRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { team_id, user_id, role } = (req.body || {}) as any;
  if (!team_id || !user_id) return res.status(400).json({ error: 'team_id and user_id required' });

  const resolvedRole = parseTeamRole(role ?? TeamRole.member);
  if (!resolvedRole) return res.status(400).json({ error: 'Invalid role' });

  const requesterMembership = await prisma.teamMembership.findFirst({
    where: {
      team_id: String(team_id),
      user_id: req.user.id,
      role: { in: [...TEAM_MANAGEMENT_ROLES] },
      status: MembershipStatus.active,
    },
  });

  if (!requesterMembership) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can add members to teams.',
    });
  }

  const team = await prisma.team.findUnique({ where: { id: String(team_id) } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const user = await prisma.user.findUnique({ where: { id: String(user_id) } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const membership = await prisma.teamMembership.upsert({
    where: { team_id_user_id: { team_id: String(team_id), user_id: String(user_id) } } as any,
    update: { role: resolvedRole, status: MembershipStatus.active },
    create: {
      team_id: String(team_id),
      user_id: String(user_id),
      role: resolvedRole,
      status: MembershipStatus.active,
    },
  });

  return res.status(201).json(membership);
});

// PATCH /team-memberships/:id { role }
teamMembershipsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id || '');
  const { role } = (req.body || {}) as any;
  if (!id) return res.status(400).json({ error: 'membership id required' });

  const membership = await prisma.teamMembership.findUnique({ where: { id } });
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const canManage = await canManageTeam(req, membership.team_id);
  if (!canManage) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can update roles.',
    });
  }

  const resolvedRole = parseTeamRole(role);
  if (!resolvedRole) return res.status(400).json({ error: 'role is required' });

  const updated = await prisma.teamMembership.update({
    where: { id },
    data: { role: resolvedRole },
  });
  return res.json(updated);
});

// DELETE /team-memberships/:id
teamMembershipsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'membership id required' });

  const membership = await prisma.teamMembership.findUnique({ where: { id } });
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const canManage = await canManageTeam(req, membership.team_id);
  const isSelf = req.user.id === membership.user_id;
  if (!canManage && !isSelf) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can remove members.',
    });
  }

  await prisma.teamMembership.delete({ where: { id } });
  return res.json({ ok: true });
});
