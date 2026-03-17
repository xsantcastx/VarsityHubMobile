import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { requirePlan } from '../middleware/subscription.js';
import { getMaxRosterSizePerTeam, resolvePlan } from '../lib/planLimits.js';

const VALID_ROLES = ['owner', 'manager', 'coach', 'assistant_coach', 'player', 'parent', 'member', 'equipment', 'health_wellness'] as const;
type ValidRole = typeof VALID_ROLES[number];

export const teamMembershipsRouter = Router();

async function canManageTeam(req: AuthedRequest, teamId: string): Promise<boolean> {
  if (!req.user) return false;
  const membership = await prisma.teamMembership.findFirst({
    where: {
      team_id: teamId,
      user_id: req.user.id,
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active',
    },
  });
  return Boolean(membership);
}

// POST /team-memberships { team_id, user_id, role }
// CRITICAL: Only team owners/managers/coaches can add members to their teams
teamMembershipsRouter.post('/', requireAuth as any, requireOnboarded as any, requirePlan('rookie') as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { team_id, user_id, role } = (req.body || {}) as any;
    if (!team_id || !user_id) return res.status(400).json({ error: 'team_id and user_id required' });

    // Verify requester is team owner/manager/coach
    const requesterMembership = await prisma.teamMembership.findFirst({
      where: {
        team_id: String(team_id),
        user_id: req.user.id,
        role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
        status: 'active'
      }
    });

    if (!requesterMembership) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Only team owners, managers, or coaches can add members to teams.'
      });
    }

    // Validate role against whitelist
    const assignedRole = String(role || 'member') as ValidRole;
    if (!VALID_ROLES.includes(assignedRole)) {
      return res.status(400).json({ error: 'Invalid role', valid_roles: VALID_ROLES });
    }

    const team = await prisma.team.findUnique({ where: { id: String(team_id) }, include: { organization: true } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const user = await prisma.user.findUnique({ where: { id: String(user_id) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Enforce roster size limit based on team owner's plan
    const ownerMembership = await prisma.teamMembership.findFirst({
      where: { team_id: String(team_id), role: 'owner', status: 'active' },
      include: { user: true },
    });
    if (ownerMembership) {
      const ownerPrefs = (ownerMembership.user as any)?.preferences || {};
      const ownerPlan = resolvePlan(ownerPrefs.plan);
      const maxRoster = getMaxRosterSizePerTeam(ownerPlan);
      if (maxRoster !== null) {
        const currentCount = await prisma.teamMembership.count({
          where: { team_id: String(team_id), status: 'active' },
        });
        if (currentCount >= maxRoster) {
          return res.status(403).json({
            error: 'ROSTER_LIMIT_REACHED',
            message: `This team has reached its roster limit of ${maxRoster} members. Upgrade your plan for more.`,
          });
        }
      }
    }

    const m = await prisma.teamMembership.upsert({
      where: { team_id_user_id: { team_id: String(team_id), user_id: String(user_id) } } as any,
      update: { role: assignedRole, status: 'active' },
      create: { team_id: String(team_id), user_id: String(user_id), role: assignedRole, status: 'active' },
    });
    return res.status(201).json(m);
  } catch (err) {
    console.error('[team-memberships] POST / error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /team-memberships/:id { role? }
teamMembershipsRouter.patch('/:id', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const id = String(req.params.id || '');
    const { role, custom_position } = (req.body || {}) as any;
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

    if (!role && custom_position === undefined) return res.status(400).json({ error: 'role or custom_position is required' });

    const data: Record<string, any> = {};
    if (role) {
      const validatedRole = String(role) as ValidRole;
      if (!VALID_ROLES.includes(validatedRole)) {
        return res.status(400).json({ error: 'Invalid role', valid_roles: VALID_ROLES });
      }
      data.role = validatedRole;
    }
    if (custom_position !== undefined) data.custom_position = custom_position === null ? null : String(custom_position);

    const updated = await prisma.teamMembership.update({
      where: { id },
      data,
    });
    return res.json(updated);
  } catch (err) {
    console.error('[team-memberships] PATCH /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /team-memberships/:id
teamMembershipsRouter.delete('/:id', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
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
  } catch (err) {
    console.error('[team-memberships] DELETE /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
