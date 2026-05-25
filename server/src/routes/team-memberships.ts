import { Router } from 'express';
import { z } from 'zod';
import { sendPushNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { canManageTeam as canManageTeamShared } from '../lib/teamAuthorization.js';
import { guardTeamMembershipMutation } from '../lib/teamEntitlements.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { requirePlan } from '../middleware/subscription.js';
import { registerIdValidation } from '../middleware/validateParams.js';
import { stripHtml } from '../lib/sanitizeHtml.js';
import { sendError } from '../lib/http/sendError.js';

// 'owner' is intentionally excluded — ownership can only be assigned through org creation or transfer-ownership endpoint
const VALID_ROLES = [
  'manager',
  'coach',
  'assistant_coach',
  'player',
  'parent',
  'member',
  'equipment',
  'health_wellness',
] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export const teamMembershipsRouter = Router();
registerIdValidation(teamMembershipsRouter);

// Thin wrapper preserving the existing (req, teamId) signature used by handlers
// in this router. Delegates to the shared lib so the boundary logic lives in
// one place.
async function canManageTeam(req: AuthedRequest, teamId: string): Promise<boolean> {
  return canManageTeamShared(req.user?.id ?? null, teamId);
}

// POST /team-memberships { team_id, user_id, role }
// CRITICAL: Only team owners/managers/coaches can add members to their teams
const createMembershipSchema = z.object({
  team_id: z.string().min(1),
  user_id: z.string().min(1),
  role: z.string().optional(),
});

teamMembershipsRouter.post(
  '/',
  requireAuth as any,
  requireOnboarded as any,
  requirePlan('rookie') as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return sendError(res, 401, 'Unauthorized');
      const parsed = createMembershipSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      const { team_id, user_id, role } = parsed.data;

      const canManage = await canManageTeam(req, String(team_id));
      if (!canManage) {
        return sendError(res, 403, 'PERMISSION_DENIED', {
          message: 'Only team staff or organization admins can add members to teams.',
        });
      }

      // Validate role against whitelist
      const assignedRole = String(role || 'member') as ValidRole;
      if (!VALID_ROLES.includes(assignedRole)) {
        return sendError(res, 400, 'Invalid role', { details: { valid_roles: VALID_ROLES } });
      }

      const team = await prisma.team.findUnique({
        where: { id: String(team_id) },
        select: { id: true },
      });
      if (!team) return sendError(res, 404, 'Team not found');
      const user = await prisma.user.findUnique({ where: { id: String(user_id) } });
      if (!user) return sendError(res, 404, 'User not found');

      // Enforce roster size limit and create membership atomically
      const teamIdStr = String(team_id);
      const userIdStr = String(user_id);

      const m = await prisma.$transaction(
        async tx => {
          const existingMembership = await tx.teamMembership.findUnique({
            where: { team_id_user_id: { team_id: teamIdStr, user_id: userIdStr } } as any,
            select: { role: true, status: true },
          });
          const guard = await guardTeamMembershipMutation(tx, {
            teamId: teamIdStr,
            nextRole: assignedRole,
            existingMembership,
          });
          if (!guard.ok) {
            const error = new Error(
              guard.body.code || guard.body.error || 'TEAM_MEMBERSHIP_GUARD_FAILED'
            );
            (error as any).status = guard.status;
            (error as any).body = guard.body;
            throw error;
          }

          return tx.teamMembership.upsert({
            where: { team_id_user_id: { team_id: teamIdStr, user_id: userIdStr } } as any,
            update: { role: assignedRole, status: 'active' },
            create: {
              team_id: teamIdStr,
              user_id: userIdStr,
              role: assignedRole,
              status: 'active',
            },
          });
        },
        { isolationLevel: 'Serializable' }
      );
      return res.status(201).json(m);
    } catch (err: any) {
      if (err?.status && err?.body) {
        return res.status(err.status).json(err.body);
      }
      console.error('[team-memberships] POST / error:', err);
      return sendError(res, 500, 'Internal server error');
    }
  })
);

// PATCH /team-memberships/:id { role? }
const VALID_STATUSES = ['active', 'archived'] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

const updateMembershipSchema = z.object({
  role: z.string().optional(),
  custom_position: z.string().nullable().optional(),
  status: z.enum(VALID_STATUSES).optional(),
});

teamMembershipsRouter.patch(
  '/:id',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return sendError(res, 401, 'Unauthorized');
      const id = String(req.params.id || '');
      if (!id) return sendError(res, 400, 'membership id required');
      const parsed = updateMembershipSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      const { role, custom_position, status } = parsed.data;

      const membership = await prisma.teamMembership.findUnique({ where: { id } });
      if (!membership) return sendError(res, 404, 'Membership not found');

      const canManage = await canManageTeam(req, membership.team_id);
      if (!canManage) {
        return sendError(res, 403, 'PERMISSION_DENIED', {
          message: 'Only team staff or organization admins can update roles.',
        });
      }

      if (!role && custom_position === undefined && !status)
        return sendError(res, 400, 'role, custom_position, or status is required');

      const data: Record<string, any> = {};
      if (role) {
        const validatedRole = String(role) as ValidRole;
        if (!VALID_ROLES.includes(validatedRole)) {
          return sendError(res, 400, 'Invalid role', { details: { valid_roles: VALID_ROLES } });
        }

        const guard = await guardTeamMembershipMutation(prisma, {
          teamId: membership.team_id,
          nextRole: validatedRole,
          existingMembership: { role: membership.role, status: membership.status },
          nextStatus: status ?? membership.status,
        });
        if (!guard.ok) {
          return res.status(guard.status).json(guard.body);
        }
        data.role = validatedRole;
      }
      if (status) {
        // When activating an archived member, re-check roster limits
        if (status === 'active' && membership.status !== 'active') {
          const guard = await guardTeamMembershipMutation(prisma, {
            teamId: membership.team_id,
            nextRole: (role as ValidRole) ?? (membership.role as ValidRole),
            existingMembership: { role: membership.role, status: membership.status },
            nextStatus: 'active',
          });
          if (!guard.ok) {
            return res.status(guard.status).json(guard.body);
          }
        }
        data.status = status;
      }
      if (custom_position !== undefined)
        data.custom_position = custom_position === null ? null : stripHtml(String(custom_position));

      const updated = await prisma.teamMembership.update({
        where: { id },
        data,
      });

      // Notify the affected member about role change
      if (data.role && membership.user_id !== req.user!.id) {
        try {
          const team = await prisma.team.findUnique({
            where: { id: membership.team_id },
            select: { id: true, name: true },
          });
          const teamName = team?.name || 'your team';

          await prisma.notification.create({
            data: {
              user_id: membership.user_id,
              actor_id: req.user!.id,
              type: 'TEAM_ROLE_CHANGED',
              meta: { team_id: membership.team_id, team_name: teamName, new_role: data.role },
            },
          });

          void sendPushNotification(
            membership.user_id,
            `Role updated on ${teamName}`,
            `Your role has been changed to ${data.role}`,
            { type: 'team_role_changed', team_id: membership.team_id, screen: 'team-page' }
          ).catch(pushErr => {
            console.error('[team-memberships] Failed to send role change push:', pushErr);
          });
        } catch (notifErr) {
          console.error('[team-memberships] Failed to send role change notification:', notifErr);
        }
      }

      return res.json(updated);
    } catch (err) {
      console.error('[team-memberships] PATCH /:id error:', err);
      return sendError(res, 500, 'Internal server error');
    }
  })
);

// DELETE /team-memberships/:id
teamMembershipsRouter.delete(
  '/:id',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return sendError(res, 401, 'Unauthorized');
      const id = String(req.params.id || '');
      if (!id) return sendError(res, 400, 'membership id required');

      const membership = await prisma.teamMembership.findUnique({ where: { id } });
      if (!membership) return sendError(res, 404, 'Membership not found');

      const canManage = await canManageTeam(req, membership.team_id);
      const isSelf = req.user.id === membership.user_id;
      if (!canManage && !isSelf) {
        return sendError(res, 403, 'PERMISSION_DENIED', {
          message: 'Only team staff or organization admins can remove members.',
        });
      }

      // ORG-5: Prevent removal of the sole team owner
      if (membership.role === 'owner') {
        const ownerCount = await prisma.teamMembership.count({
          where: { team_id: membership.team_id, role: 'owner' },
        });
        if (ownerCount <= 1) {
          return sendError(res, 400, 'SOLE_OWNER', {
            message: 'Cannot remove the only owner. Transfer ownership to another member first.',
          });
        }
      }

      await prisma.teamMembership.delete({ where: { id } });

      // Notify the removed member (only if removed by someone else, not self-leave)
      if (!isSelf) {
        try {
          const team = await prisma.team.findUnique({
            where: { id: membership.team_id },
            select: { id: true, name: true },
          });
          const teamName = team?.name || 'a team';

          await prisma.notification.create({
            data: {
              user_id: membership.user_id,
              actor_id: req.user!.id,
              type: 'TEAM_MEMBER_REMOVED',
              meta: { team_id: membership.team_id, team_name: teamName },
            },
          });

          void sendPushNotification(
            membership.user_id,
            `Removed from ${teamName}`,
            `You have been removed from ${teamName}`,
            { type: 'team_member_removed', team_id: membership.team_id, screen: 'teams' }
          ).catch(pushErr => {
            console.error('[team-memberships] Failed to send removal push:', pushErr);
          });
        } catch (notifErr) {
          console.error('[team-memberships] Failed to send removal notification:', notifErr);
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[team-memberships] DELETE /:id error:', err);
      return sendError(res, 500, 'Internal server error');
    }
  })
);

// ─────────────────────────────────────────────────────────────
// Team Join Requests
// ─────────────────────────────────────────────────────────────

const createJoinRequestSchema = z.object({
  team_id: z.string().min(1),
  message: z.string().max(500).optional(),
});

// POST /team-memberships/join-requests
// Athlete self-submits a request to join a team.
teamMembershipsRouter.post(
  '/join-requests',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const parsed = createJoinRequestSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, 'Validation failed', {
        details: parsed.error.flatten().fieldErrors,
      });

    const { team_id, message } = parsed.data;
    const userId = req.user.id;

    const team = await prisma.team.findUnique({
      where: { id: team_id },
      select: { id: true, name: true, is_private: true, status: true, organization_id: true },
    });
    if (!team || team.status !== 'active') return sendError(res, 404, 'Team not found');

    // Block if already a member
    const existing = await prisma.teamMembership.findUnique({
      where: { team_id_user_id: { team_id, user_id: userId } },
      select: { id: true },
    });
    if (existing)
      return sendError(res, 409, 'ALREADY_MEMBER', {
        message: 'You are already a member of this team.',
      });

    // Upsert: if a previous denied request exists, allow re-request
    const joinRequest = await prisma.teamJoinRequest.upsert({
      where: { team_id_user_id: { team_id, user_id: userId } },
      update: {
        status: 'pending',
        message: message ?? null,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        created_at: new Date(),
      },
      create: { team_id, user_id: userId, status: 'pending', message: message ?? null },
    });

    // Notify all team owners/managers
    try {
      const staffMembers = await prisma.teamMembership.findMany({
        where: { team_id, role: { in: ['owner', 'manager'] }, status: 'active' },
        select: { user_id: true },
        take: 20,
      });
      const requesterName =
        (req.user as any).display_name || (req.user as any).username || 'Someone';
      await Promise.all(
        staffMembers
          .filter(m => m.user_id !== userId)
          .map(m =>
            Promise.all([
              prisma.notification
                .create({
                  data: {
                    user_id: m.user_id,
                    actor_id: userId,
                    type: 'TEAM_JOIN_REQUEST',
                    meta: { team_id, team_name: team.name, join_request_id: joinRequest.id },
                  },
                })
                .catch(() => {}),
              sendPushNotification(
                m.user_id,
                `New join request for ${team.name}`,
                `${requesterName} wants to join your team`,
                {
                  type: 'team_join_request',
                  team_id,
                  join_request_id: joinRequest.id,
                  screen: 'team-join-requests',
                }
              ).catch(() => {}),
            ])
          )
      );
    } catch (notifErr) {
      console.error('[team-memberships] join-request notification error:', notifErr);
    }

    return res
      .status(201)
      .json({ ok: true, join_request: { id: joinRequest.id, status: joinRequest.status } });
  })
);

// GET /team-memberships/search-users?teamId=xxx&q=yyy
// Coaches can search existing users by name/username to add to their team.
// Excludes users already on the team and blocked users.
teamMembershipsRouter.get(
  '/search-users',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const teamId = String(req.query.teamId || '').trim();
    const q = String(req.query.q || '').trim();
    if (!teamId) return sendError(res, 400, 'teamId is required');
    if (!q || q.length < 2) return sendError(res, 400, 'q must be at least 2 characters');

    const canManage = await canManageTeam(req, teamId);
    if (!canManage) return sendError(res, 403, 'PERMISSION_DENIED');

    // Users already on the team (any status) — exclude from results
    const existingMembers = await prisma.teamMembership.findMany({
      where: { team_id: teamId },
      select: { user_id: true },
    });
    const existingUserIds = existingMembers.map(m => m.user_id);

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { notIn: existingUserIds } },
          { deleted_at: null },
          { banned: false },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { display_name: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, username: true, display_name: true, avatar_url: true },
      take: 20,
      orderBy: { username: 'asc' },
    });

    return res.json(users);
  })
);

// GET /team-memberships/join-requests?teamId=xxx
// Team owner/manager sees pending requests for their team.
teamMembershipsRouter.get(
  '/join-requests',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const teamId = req.query.teamId as string | undefined;
    if (!teamId) return sendError(res, 400, 'teamId query param required');

    const canManage = await canManageTeam(req, teamId);
    if (!canManage) return sendError(res, 403, 'PERMISSION_DENIED');

    const requests = await prisma.teamJoinRequest.findMany({
      where: { team_id: teamId, status: 'pending' },
      include: {
        user: { select: { id: true, display_name: true, username: true, avatar_url: true } },
      },
      orderBy: { created_at: 'asc' },
      take: 100,
    });

    return res.json(requests);
  })
);

// GET /team-memberships/join-requests/my
// Authenticated user sees all their own join requests.
teamMembershipsRouter.get(
  '/join-requests/my',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');

    const requests = await prisma.teamJoinRequest.findMany({
      where: { user_id: req.user.id },
      include: {
        team: { select: { id: true, name: true, logo_url: true, sport: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.json(requests);
  })
);

const reviewJoinRequestSchema = z.object({
  rejection_reason: z.string().max(500).optional(),
});

// POST /team-memberships/join-requests/:id/approve
teamMembershipsRouter.post(
  '/join-requests/:id/approve',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;

    const joinRequest = await prisma.teamJoinRequest.findUnique({
      where: { id },
      select: { id: true, team_id: true, user_id: true, status: true },
    });
    if (!joinRequest) return sendError(res, 404, 'Join request not found');
    if (joinRequest.status !== 'pending')
      return sendError(res, 409, 'Request is no longer pending');

    const canManage = await canManageTeam(req, joinRequest.team_id);
    if (!canManage) return sendError(res, 403, 'PERMISSION_DENIED');

    // IDOR-001: Prevent self-approval — a manager cannot approve their own join request
    if (joinRequest.user_id === req.user.id) {
      return sendError(res, 403, 'PERMISSION_DENIED', { message: 'You cannot approve your own join request.' });
    }

    // Approve atomically: update request + create membership
    const [, membership] = await prisma.$transaction([
      prisma.teamJoinRequest.update({
        where: { id },
        data: { status: 'approved', reviewed_at: new Date(), reviewed_by: req.user.id },
      }),
      prisma.teamMembership.upsert({
        where: { team_id_user_id: { team_id: joinRequest.team_id, user_id: joinRequest.user_id } },
        update: { status: 'active', role: 'member' },
        create: {
          team_id: joinRequest.team_id,
          user_id: joinRequest.user_id,
          role: 'member',
          status: 'active',
        },
      }),
    ]);

    // Notify the requester
    try {
      const team = await prisma.team.findUnique({
        where: { id: joinRequest.team_id },
        select: { id: true, name: true },
      });
      const teamName = team?.name || 'the team';
      await Promise.all([
        prisma.notification
          .create({
            data: {
              user_id: joinRequest.user_id,
              actor_id: req.user.id,
              type: 'TEAM_JOIN_APPROVED',
              meta: { team_id: joinRequest.team_id, team_name: teamName },
            },
          })
          .catch(() => {}),
        sendPushNotification(
          joinRequest.user_id,
          `You joined ${teamName}!`,
          'Your request to join the team was approved',
          { type: 'team_join_approved', team_id: joinRequest.team_id, screen: 'team-page' }
        ).catch(() => {}),
      ]);
    } catch (notifErr) {
      console.error('[team-memberships] approve notification error:', notifErr);
    }

    return res.json({ ok: true, membership: { id: membership.id, role: membership.role } });
  })
);

// POST /team-memberships/join-requests/:id/reject
teamMembershipsRouter.post(
  '/join-requests/:id/reject',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;
    const parsed = reviewJoinRequestSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, 'Validation failed', {
        details: parsed.error.flatten().fieldErrors,
      });

    const joinRequest = await prisma.teamJoinRequest.findUnique({
      where: { id },
      select: { id: true, team_id: true, user_id: true, status: true },
    });
    if (!joinRequest) return sendError(res, 404, 'Join request not found');
    if (joinRequest.status !== 'pending')
      return sendError(res, 409, 'Request is no longer pending');

    const canManage = await canManageTeam(req, joinRequest.team_id);
    if (!canManage) return sendError(res, 403, 'PERMISSION_DENIED');

    // IDOR-001: Prevent self-rejection — a manager cannot reject their own join request
    if (joinRequest.user_id === req.user.id) {
      return sendError(res, 403, 'PERMISSION_DENIED', { message: 'You cannot reject your own join request.' });
    }

    await prisma.teamJoinRequest.update({
      where: { id },
      data: {
        status: 'denied',
        rejection_reason: parsed.data.rejection_reason ?? null,
        reviewed_at: new Date(),
        reviewed_by: req.user.id,
      },
    });

    // Notify the requester
    try {
      const team = await prisma.team.findUnique({
        where: { id: joinRequest.team_id },
        select: { id: true, name: true },
      });
      const teamName = team?.name || 'the team';
      await Promise.all([
        prisma.notification
          .create({
            data: {
              user_id: joinRequest.user_id,
              actor_id: req.user.id,
              type: 'TEAM_JOIN_REJECTED',
              meta: { team_id: joinRequest.team_id, team_name: teamName },
            },
          })
          .catch(() => {}),
        sendPushNotification(
          joinRequest.user_id,
          `Update on your ${teamName} request`,
          'Your request to join the team was not approved',
          { type: 'team_join_rejected', team_id: joinRequest.team_id, screen: 'team-page' }
        ).catch(() => {}),
      ]);
    } catch (notifErr) {
      console.error('[team-memberships] reject notification error:', notifErr);
    }

    return res.json({ ok: true });
  })
);
