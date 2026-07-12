import { Router } from 'express';
import { z } from 'zod';
import { sendTeamInviteEmail } from '../lib/email.js';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import {
  canAdministerTeam as canAdministerTeamScoped,
  canAssignTeamRole,
} from '../lib/teamAuthorization.js';
import {
  buildRosterLimitError,
  buildTeamPlanLockedError,
  getTeamEntitlementState,
  isAuthorizedTeamRole,
  TEAM_AUTHORIZED_ROLES,
} from '../lib/teamEntitlements.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { inviteLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const teamInvitesRouter = Router();

// 2026-07-09: player/parent/member retired — teams hold staff only.
const VALID_INVITE_ROLES = [
  'manager',
  'coach',
  'assistant_coach',
  'equipment',
  'health_wellness',
] as const;

// POST /team-invites { team_id, email, role }
// SECURITY: Same permission checks as POST /teams/:id/invite
const createInviteSchema = z
  .object({
    team_id: z.string().min(1),
    email: z.string().email().optional(),
    username: z.string().trim().min(1).max(30).optional(),
    role: z.string().optional(),
  })
  .refine(d => Boolean(d.email) || Boolean(d.username), {
    message: 'Provide an email address or a username to invite.',
  });

teamInvitesRouter.post(
  '/',
  requireAuth as any,
  requireVerified as any,
  requireOnboarded as any,
  inviteLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    const { team_id, email, username, role } = parsed.data;

    // Validate role against whitelist to prevent injection of arbitrary roles
    const assignedRole = String(role || 'member');
    if (!(VALID_INVITE_ROLES as readonly string[]).includes(assignedRole)) {
      return res.status(400).json({ error: 'Invalid role', valid_roles: VALID_INVITE_ROLES });
    }
    const teamId = team_id;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const canManage = await canAdministerTeamScoped(req.user.id, teamId);
    if (!canManage) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Only the team owner, head coach, or organization owner can invite members.',
      });
    }

    // Role-tier rule centralized in canAssignTeamRole (single source of truth,
    // shared with POST /teams/:id/invite and PATCH /team-memberships/:id).
    if (!(await canAssignTeamRole(req.user.id, teamId, assignedRole))) {
      return res.status(403).json({
        error: 'INSUFFICIENT_ROLE',
        message: 'Only team owners can invite at manager level.',
      });
    }

    // Resolve username → the target's canonical account email (after auth, so
    // callers can't probe usernames). Keeps the invite keyed to the real
    // account so an existing user is never sent an invite that could create a
    // duplicate account. Mirrors POST /teams/:id/invite.
    let emailLower: string;
    if (username) {
      const target = await prisma.user.findUnique({
        where: { username: username.trim() },
        select: { email: true, deleted_at: true },
      });
      if (!target?.email || target.deleted_at) {
        return sendError(res, 404, 'USER_NOT_FOUND', {
          message: 'No active user found with that username.',
        });
      }
      emailLower = target.email.trim().toLowerCase();
    } else {
      emailLower = email!.toLowerCase();
    }

    let invite;
    try {
      invite = await prisma.$transaction(async tx => {
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

        const entitlement = await getTeamEntitlementState(tx, teamId);
        if (entitlement.teamLocked) {
          throw new Error('TEAM_PLAN_LOCKED');
        }

        // Enforce roster size limit — counts active members + all pending invites
        // so the cap cannot be bypassed by sending invites instead of direct adds.
        if (entitlement.maxRoster !== null) {
          const activeMemberCount = await tx.teamMembership.count({
            where: { team_id: teamId, status: 'active' },
          });
          const pendingInviteCount = await tx.teamInvite.count({
            where: {
              team_id: teamId,
              status: 'pending',
              ...(current ? { id: { not: current.id } } : {}),
            },
          });
          if (activeMemberCount + pendingInviteCount + 1 > entitlement.maxRoster) {
            throw new Error(`ROSTER_LIMIT_REACHED:${entitlement.maxRoster}`);
          }
        }

        if (isAuthorizedTeamRole(assignedRole)) {
          const limit = entitlement.maxAuthorizedUsers;
          if (limit !== null) {
            const inviteCount = await tx.teamInvite.count({
              where: {
                team_id: teamId,
                status: 'pending',
                ...(current ? { id: { not: current.id } } : {}),
              },
            });
            const memberCount = await tx.teamMembership.count({
              where: {
                team_id: teamId,
                status: 'active',
                role: { in: [...TEAM_AUTHORIZED_ROLES] as any },
              },
            });
            const totalAuthorized = inviteCount + memberCount + 1;
            if (totalAuthorized > limit) {
              throw new Error(
                `USER_LIMIT_REACHED:Plan limit reached for authorized users. This team allows ${limit} authorized user${limit === 1 ? '' : 's'}.`
              );
            }
          }
        }
        return await tx.teamInvite.upsert({
          where: { team_id_email: { team_id: teamId, email: emailLower } } as any,
          update: { role: assignedRole as any, status: 'pending' },
          create: {
            team_id: teamId,
            email: emailLower,
            role: assignedRole as any,
            status: 'pending',
          },
        });
      });
    } catch (e: any) {
      if (e?.message === 'TEAM_PLAN_LOCKED') {
        const entitlement = await getTeamEntitlementState(prisma, teamId);
        return res.status(403).json(buildTeamPlanLockedError(entitlement));
      }
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
      if (e?.message?.startsWith('ROSTER_LIMIT_REACHED:')) {
        const limit = parseInt(e.message.split(':')[1], 10);
        return res.status(403).json(buildRosterLimitError(limit));
      }
      throw e;
    }

    // Send invitation email (fire-and-forget)
    const inviter = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { display_name: true },
    });
    sendTeamInviteEmail({
      to: emailLower,
      teamName: team.name,
      role: assignedRole,
      inviterName: inviter?.display_name || 'VarsityHub Coach',
      inviteToken: invite.id,
    }).catch(err => {
      console.error('[team-invites] Failed to send invite email:', err);
    });

    return res.status(201).json(invite);
  })
);
