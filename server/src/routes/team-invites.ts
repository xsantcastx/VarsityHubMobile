import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { getAuthorizedUsersPerTeam } from '../lib/planLimits.js';

export const teamInvitesRouter = Router();

// POST /team-invites { team_id, email, role }
// SECURITY: Same permission checks as POST /teams/:id/invite
teamInvitesRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { team_id, email, role } = (req.body || {}) as any;
  if (!team_id || !email) return res.status(400).json({ error: 'team_id and email required' });
  const emailLower = String(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const teamId = String(team_id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  // CRITICAL: Verify requester is team owner/manager/coach (can invite members)
  const requesterMembership = await prisma.teamMembership.findFirst({
    where: {
      team_id: teamId,
      user_id: req.user.id,
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active',
    },
  });
  if (!requesterMembership) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can invite members to teams.',
    });
  }

  // PLAN LIMITS: Enforce authorized user caps (per-team limits)
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const prefs = (user?.preferences || {}) as any;
  const plan = prefs.plan || 'rookie';
  const limit = getAuthorizedUsersPerTeam(plan);

  const existingInvite = await prisma.teamInvite.findUnique({
    where: { team_id_email: { team_id: teamId, email: emailLower } } as any,
  });

  let invite;
  try {
    invite = await prisma.$transaction(async (tx) => {
      if (limit !== null && !existingInvite) {
        const inviteCount = await tx.teamInvite.count({ where: { team_id: teamId, status: 'pending' } });
        const memberCount = await tx.teamMembership.count({
          where: { team_id: teamId, role: { in: ['manager', 'coach', 'assistant_coach', 'equipment', 'health_wellness'] } },
        });
        const totalAuthorized = inviteCount + memberCount;
        if (totalAuthorized >= limit) {
          throw new Error(`USER_LIMIT_REACHED:${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} per team`);
        }
      }
      return await tx.teamInvite.upsert({
        where: { team_id_email: { team_id: teamId, email: emailLower } } as any,
        update: { role: role || 'member', status: 'pending' },
        create: { team_id: teamId, email: emailLower, role: role || 'member', status: 'pending' },
      });
    });
  } catch (e: any) {
    if (e?.message?.includes('USER_LIMIT_REACHED')) {
      const [, message] = e.message.split(':');
      return res.status(403).json({
        error: 'USER_LIMIT_REACHED',
        message: message || 'Plan limit reached for authorized users.',
      });
    }
    throw e;
  }

  return res.status(201).json(invite);
});

