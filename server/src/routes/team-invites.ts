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
import { canManageTeam as canManageTeamScoped } from '../lib/teamAuthorization.js';
import { getEffectiveEntitledPlan } from '../lib/userBillingState.js';

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

  const canManage = await canManageTeamScoped(req.user.id, teamId);
  if (!canManage) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'Only team staff or organization admins can invite members to teams.',
    });
  }

  // PLAN LIMITS: Enforce authorized user caps based on TEAM OWNER's plan (Rule B).
  // Authorized users are covered by the coach's plan — never charged individually.
  const ownerMembership = await prisma.teamMembership.findFirst({
    where: { team_id: teamId, role: 'owner', status: 'active' },
    select: { user_id: true },
  });
  const ownerId = ownerMembership?.user_id || req.user.id;
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      preferences: true,
      plan: true,
      pending_plan: true,
      payment_pending: true,
      payment_approved: true,
    },
  });
  const plan = getEffectiveEntitledPlan(owner as any);
  const limit = getAuthorizedUsersPerTeam(plan);

  const existingInvite = await prisma.teamInvite.findUnique({
    where: { team_id_email: { team_id: teamId, email: emailLower } } as any,
  });

  let invite;
  try {
    invite = await prisma.$transaction(async (tx) => {
      // Re-fetch inside the transaction so two concurrent invites to the
      // same email don't both see "no existing invite" and race past the
      // role-conflict check below.
      const current = await tx.teamInvite.findUnique({
        where: { team_id_email: { team_id: teamId, email: emailLower } } as any,
      });

      // Conflict: an invite for this email is ALREADY pending with a
      // different role. The previous behavior silently overwrote the role,
      // so coach A could invite as `coach` and coach B (or a rapid second
      // tap by the same coach) would silently downgrade or change it —
      // confusing because the original invitee already received an email
      // referencing the original role. Same role is a no-op idempotent
      // re-invite (still allowed). Re-inviting a declined/expired invite
      // with any role still works (only conflicts on `pending`).
      if (
        current &&
        (current as any).status === 'pending' &&
        (current as any).role !== assignedRole
      ) {
        throw new Error(
          `INVITE_ROLE_CONFLICT:An invite for this email is already pending with role "${(current as any).role}". Cancel it first or re-invite with the same role.`
        );
      }

      if (limit !== null && !current) {
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
    if (e?.message?.startsWith('INVITE_ROLE_CONFLICT:')) {
      const [, message] = e.message.split(':');
      return res.status(409).json({
        error: 'INVITE_ROLE_CONFLICT',
        message: message || 'An invite for this email is already pending with a different role.',
      });
    }
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
