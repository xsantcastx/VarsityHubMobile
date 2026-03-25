import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { prisma } from '../lib/prisma.js';
import { getAuthorizedUsersPerTeam } from '../lib/planLimits.js';
import { inviteLimiter } from '../middleware/rateLimiters.js';
import { sendTeamInviteEmail } from '../lib/email.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const teamInvitesRouter = Router();

const VALID_INVITE_ROLES = ['manager', 'coach', 'assistant_coach', 'player', 'parent', 'member', 'equipment', 'health_wellness'] as const;

// POST /team-invites { team_id, email, role }
// SECURITY: Same permission checks as POST /teams/:id/invite
const createInviteSchema = z.object({
  team_id: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
});

teamInvitesRouter.post('/', requireAuth as any, requireVerified as any, requireOnboarded as any, inviteLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  const { team_id, email, role } = parsed.data;

  // Validate role against whitelist to prevent injection of arbitrary roles
  const assignedRole = String(role || 'member');
  if (!(VALID_INVITE_ROLES as readonly string[]).includes(assignedRole)) {
    return res.status(400).json({ error: 'Invalid role', valid_roles: VALID_INVITE_ROLES });
  }
  const emailLower = email.toLowerCase();
  const teamId = team_id;
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

  // PLAN LIMITS: Enforce authorized user caps based on TEAM OWNER's plan (Rule B).
  // Authorized users are covered by the coach's plan — never charged individually.
  const ownerMembership = await prisma.teamMembership.findFirst({
    where: { team_id: teamId, role: 'owner', status: 'active' },
    select: { user_id: true },
  });
  const ownerId = ownerMembership?.user_id || req.user.id;
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  const ownerPrefs = (owner?.preferences || {}) as any;
  // Use confirmed plan only — pending_plan is not yet paid for
  const plan = ownerPrefs.payment_pending ? 'rookie' : (ownerPrefs.plan || 'rookie');
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
        update: { role: assignedRole as any, status: 'pending' },
        create: { team_id: teamId, email: emailLower, role: assignedRole as any, status: 'pending' },
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

  // Send invitation email (fire-and-forget)
  const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { display_name: true } });
  sendTeamInviteEmail({
    to: emailLower,
    teamName: team.name,
    role: assignedRole,
    inviterName: inviter?.display_name || 'VarsityHub Coach',
  }).catch((err) => {
    console.error('[team-invites] Failed to send invite email:', err);
  });

  return res.status(201).json(invite);
}));

