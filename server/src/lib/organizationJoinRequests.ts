import { logAdminActivity, logAdminActivityFromReq } from './adminActivityLogger.js';
import { debugLog } from './debugLog.js';
import { sendCoachApprovedEmail, sendCoachRejectedEmail } from './email.js';
import { sendPushNotification } from './notifications.js';
import { getOrganizationJoinRequestState } from './organizationWorkflowState.js';
import { prisma } from './prisma.js';
import { captureException } from './sentry.js';
import {
  buildAuthStateColumns,
  getPreferencesObject,
  mergeAuthStateIntoPreferences,
} from './userAuthState.js';
import { buildBillingStateColumns } from './userBillingState.js';
import { invalidateMeCacheForUser } from './userCache.js';
import { isAdminEmail } from './adminEmails.js';
import type { AuthedRequest } from '../middleware/auth.js';

// =====================================================
// ORGANIZATION JOIN REQUEST APPROVAL / DENIAL CORE
// =====================================================
//
// Single implementation of the coach join-request decision transition,
// shared by BOTH review surfaces:
//   - the authenticated app routes (POST /join-requests/:requestId/approve|deny)
//   - the email-link review path (signed review token, no app login)
//
// Authorization stays with the caller: the app routes enforce the IDOR
// self-approval guard and the owner/platform-admin gate; the email path
// verifies the signed review token. This module only executes the decided
// transition: Serializable transaction (status re-check + membership +
// user-state mutation), cache invalidation, notifications, and the
// AdminActivityLog emission.

const ALREADY_REVIEWED_ERROR = 'This request has already been reviewed';

/**
 * True when the user already owns an approved organization of their own.
 *
 * `approval_status`, `paid_by_owner`, and the active `organization_id` are
 * GLOBAL User columns, but a join request is a decision about ONE org. For an
 * established league owner those writes are cross-tenant damage: requesting to
 * join another league demoted them to PENDING (locking them out of their own
 * org), and that league's owner denying it flipped them to REJECTED with a
 * 48h cooldown and no self-service recovery. Callers use this to skip the
 * global state writes for owners; coaches with no approved org of their own
 * still move PENDING -> APPROVED/REJECTED as before, which is the vetting funnel.
 */
export async function ownsApprovedOrganization(
  userId: string,
  excludeOrganizationId?: string | null
): Promise<boolean> {
  const owned = await prisma.organization.findFirst({
    where: {
      admin_approved: true,
      status: 'active',
      ...(excludeOrganizationId ? { id: { not: excludeOrganizationId } } : {}),
      OR: [
        { league_owner_id: userId },
        { memberships: { some: { user_id: userId, role: 'owner', status: 'active' } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(owned);
}

export type JoinRequestDecisionResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Which surface the reviewer acted from. Drives the AdminActivityLog source
 * (request-derived actor vs 'league-owner-email-action') and the
 * notification-failure reporting style each path has always used.
 */
export type JoinRequestReviewContext = { via: 'app'; req: AuthedRequest } | { via: 'email-link' };

export function reportApprovalNotificationFailure(
  channel: 'email' | 'push' | 'in_app',
  context: string,
  err: unknown,
  extra: Record<string, unknown>
): void {
  console.error(`[organizations] ${context} ${channel} failed:`, (err as any)?.message || err);
  captureException(err instanceof Error ? err : new Error(String(err)), {
    context,
    notification_channel: channel,
    ...extra,
  });
}

function buildApprovedCoachPreferences(params: {
  currentPrefs: unknown;
  organization: { id: string; name: string };
  teamId?: string | null;
  teamName?: string | null;
}): Record<string, any> {
  const next = mergeAuthStateIntoPreferences(getPreferencesObject(params.currentPrefs), {
    role: 'coach',
    organization_id: params.organization.id,
    proceeding_as_fan: false,
  }) as Record<string, any>;
  next.organization_name = params.organization.name;
  next.join_request_pending = false;

  if (params.teamId) next.team_id = params.teamId;
  if (params.teamName) next.team_name = params.teamName;

  delete next.pending_plan;
  delete next.payment_pending;
  delete next.payment_approved;

  return next;
}

function buildRejectedCoachPreferences(params: {
  currentPrefs: unknown;
  organization?: { id: string; name: string } | null;
}): Record<string, any> {
  const next = mergeAuthStateIntoPreferences(getPreferencesObject(params.currentPrefs), {
    role: 'coach',
  }) as Record<string, any>;
  next.join_request_pending = false;

  if (params.organization) {
    next.organization_id = params.organization.id;
    next.organization_name = params.organization.name;
  }

  delete next.team_id;
  delete next.team_name;

  return next;
}

async function loadJoinRequestDecisionContext(
  requestId: string,
  options: { includeAdminApproved?: boolean } = {}
) {
  const joinRequest = await getOrganizationJoinRequestState(requestId);
  const [organization, user] = await Promise.all([
    joinRequest
      ? prisma.organization.findUnique({
          where: { id: joinRequest.organization_id },
          select: {
            id: true,
            name: true,
            ...(options.includeAdminApproved ? { admin_approved: true } : {}),
          },
        })
      : Promise.resolve(null),
    joinRequest
      ? prisma.user.findUnique({
          where: { id: joinRequest.user_id },
          select: { id: true, email: true, display_name: true, preferences: true },
        })
      : Promise.resolve(null),
  ]);

  return { joinRequest, organization, user };
}

export async function approveJoinRequest(params: {
  requestId: string;
  reviewerUserId: string;
  context: JoinRequestReviewContext;
}): Promise<JoinRequestDecisionResult> {
  const { requestId, reviewerUserId, context } = params;

  const { joinRequest, organization, user } = await loadJoinRequestDecisionContext(requestId, {
    includeAdminApproved: true,
  });
  if (!joinRequest || !organization || !user) {
    return { ok: false, status: 404, error: 'Join request not found' };
  }
  if (joinRequest.status !== 'pending') {
    return { ok: false, status: 400, error: ALREADY_REVIEWED_ERROR };
  }
  // SECURITY: Only allow approving join requests for admin-approved organizations.
  // Without this, coaches could get APPROVED status by joining an unapproved org.
  if (!organization.admin_approved) {
    return {
      ok: false,
      status: 403,
      error: 'Organization must be approved by VarsityHub before accepting members.',
    };
  }

  // An established league owner joining a second org gains membership there,
  // but keeps their own global account state: they are already APPROVED, they
  // pay for their own org (`paid_by_owner` must stay false), and their active
  // organization must not be repointed at the org they just joined.
  const targetOwnsApprovedOrg = await ownsApprovedOrganization(
    joinRequest.user_id,
    joinRequest.organization_id
  );

  // ORG-8 + ORG-4: Serializable isolation with status re-check inside transaction
  try {
    await prisma.$transaction(
      async tx => {
        // Re-check status inside transaction to prevent race condition (ORG-4)
        const transition = await tx.organizationJoinRequest.updateMany({
          where: { id: requestId, status: 'pending' },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: reviewerUserId,
          },
        });
        if (transition.count === 0) {
          throw new Error('JOIN_REQUEST_ALREADY_REVIEWED');
        }
        await tx.organizationMembership.upsert({
          where: {
            organization_id_user_id: {
              organization_id: joinRequest.organization_id,
              user_id: joinRequest.user_id,
            } as any,
          },
          update: { role: 'coach', status: 'active' },
          create: {
            organization_id: joinRequest.organization_id,
            user_id: joinRequest.user_id,
            role: 'coach',
            status: 'active',
          },
          select: { id: true },
        });
        if (targetOwnsApprovedOrg) return;
        await tx.user.update({
          where: { id: joinRequest.user_id },
          data: {
            approval_status: 'APPROVED',
            paid_by_owner: true,
            rejected_at: null,
            rejection_reason: null,
            preferences: buildApprovedCoachPreferences({
              currentPrefs: user.preferences,
              organization: {
                id: joinRequest.organization_id,
                name: organization.name,
              },
            }),
            ...buildAuthStateColumns({
              role: 'coach',
              organization_id: joinRequest.organization_id,
              proceeding_as_fan: false,
              coach_agreement_accepted_at: new Date(),
              coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
            }),
            ...buildBillingStateColumns({
              pending_plan: null,
              payment_pending: false,
              payment_approved: false,
            }),
          },
        });
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (err: any) {
    if (err?.message === 'JOIN_REQUEST_ALREADY_REVIEWED') {
      return { ok: false, status: 400, error: ALREADY_REVIEWED_ERROR };
    }
    throw err;
  }

  await invalidateMeCacheForUser(joinRequest.user_id);

  // Email the coach that they were approved (fire-and-forget)
  if (user.email) {
    sendCoachApprovedEmail({
      to: user.email,
      coachName: user.display_name || 'Coach',
      leagueName: organization.name,
    }).catch(err => {
      if (context.via === 'email-link') {
        reportApprovalNotificationFailure(
          'email',
          'coach_join_request_approved_email_failed',
          err,
          {
            organizationId: joinRequest.organization_id,
            userId: joinRequest.user_id,
            actorId: reviewerUserId,
          }
        );
      } else {
        console.error('[orgs] Failed to send coach approved email:', (err as any)?.message);
      }
    });
  }

  // Push notification so coach knows they were approved
  sendPushNotification(
    joinRequest.user_id,
    'Join Request Approved',
    `Your request to join ${organization.name} was approved!`,
    { type: 'join_request_approved', organization_id: joinRequest.organization_id }
  )
    .then(() => {
      debugLog(`[notif] push sent JOIN_REQUEST_APPROVED to user=${joinRequest.user_id}`);
    })
    .catch(err => {
      if (context.via === 'email-link') {
        reportApprovalNotificationFailure('push', 'join_request_approval_push_failed', err, {
          organizationId: joinRequest.organization_id,
          userId: joinRequest.user_id,
          actorId: reviewerUserId,
        });
      } else {
        console.error(
          '[notif] Failed to send push for JOIN_REQUEST_APPROVED:',
          (err as any)?.message || err
        );
      }
    });

  // In-app notification so it shows in the Updates page
  try {
    const notif = await prisma.notification.create({
      data: {
        user_id: joinRequest.user_id,
        actor_id: reviewerUserId,
        type: 'JOIN_REQUEST_APPROVED',
        meta: {
          organization_id: joinRequest.organization_id,
          organization_name: organization.name,
        },
      },
    });
    debugLog(
      `[notif] JOIN_REQUEST_APPROVED created id=${notif.id} for user=${joinRequest.user_id}`
    );
  } catch (err) {
    if (context.via === 'email-link') {
      reportApprovalNotificationFailure(
        'in_app',
        'join_request_approval_notification_failed',
        err,
        {
          organizationId: joinRequest.organization_id,
          userId: joinRequest.user_id,
          actorId: reviewerUserId,
        }
      );
    } else {
      console.error(
        '[notif] Failed to create JOIN_REQUEST_APPROVED notification:',
        (err as any)?.message || err
      );
      captureException(err as Error, {
        context: 'join_request_approval_notification_failed',
        organizationId: joinRequest.organization_id,
        userId: joinRequest.user_id,
        actorId: reviewerUserId,
      });
    }
  }

  if (context.via === 'email-link') {
    await logAdminActivity(
      reviewerUserId,
      'league-owner-email-action',
      'APPROVE_JOIN_REQUEST',
      'user',
      joinRequest.user_id,
      `Approved coach join request for org ${organization.name} (via email link)`
    );
  } else {
    await logAdminActivityFromReq(
      context.req,
      'APPROVE_JOIN_REQUEST',
      'user',
      joinRequest.user_id,
      `Approved coach join request for org ${organization.name}`
    );
  }

  return { ok: true };
}

export async function denyJoinRequest(params: {
  requestId: string;
  reviewerUserId: string;
  context: JoinRequestReviewContext;
  reason?: string;
}): Promise<JoinRequestDecisionResult> {
  const { requestId, reviewerUserId, context, reason } = params;

  const { joinRequest, organization, user } = await loadJoinRequestDecisionContext(requestId);
  if (!joinRequest || !organization || !user) {
    return { ok: false, status: 404, error: 'Join request not found' };
  }
  if (joinRequest.status !== 'pending') {
    return { ok: false, status: 400, error: ALREADY_REVIEWED_ERROR };
  }
  // Platform admins must never be pushed into coach REJECTED (pending-approval
  // routing loop, no self-service recovery). This is also the one REJECTED path
  // a non-admin org owner can trigger against an admin. isAdminEmail() returns
  // false for a null email.
  if (isAdminEmail(user.email)) {
    captureException(new Error('[denyJoinRequest] refused: target is a platform admin'), {
      tags: { area: 'coach-approval' },
      extra: { requestId, reviewerUserId },
    });
    return { ok: false, status: 403, error: 'Cannot reject a platform admin' };
  }

  // An established league owner must not be pushed into global REJECTED by
  // another org's owner — that would lock them out of the league they run,
  // with no self-service recovery. Deny only the request in that case.
  const targetOwnsApprovedOrg = await ownsApprovedOrganization(
    user.id,
    joinRequest.organization_id
  );

  try {
    await prisma.$transaction(
      async tx => {
        const transition = await tx.organizationJoinRequest.updateMany({
          where: { id: requestId, status: 'pending' },
          data: {
            status: 'denied',
            reviewed_at: new Date(),
            reviewed_by: reviewerUserId,
            rejection_reason: reason || null,
          },
        });
        if (transition.count === 0) {
          throw new Error('JOIN_REQUEST_ALREADY_REVIEWED');
        }
        if (targetOwnsApprovedOrg) return;
        await tx.user.update({
          where: { id: user.id },
          data: {
            approval_status: 'REJECTED',
            paid_by_owner: false,
            rejected_at: new Date(),
            rejection_reason: reason || null,
            preferences: buildRejectedCoachPreferences({
              currentPrefs: user.preferences,
              organization: {
                id: joinRequest.organization_id,
                name: organization.name,
              },
            }),
            ...buildAuthStateColumns({
              role: 'coach',
              organization_id: joinRequest.organization_id,
            }),
          },
        });
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (err: any) {
    if (err?.message === 'JOIN_REQUEST_ALREADY_REVIEWED') {
      return { ok: false, status: 400, error: ALREADY_REVIEWED_ERROR };
    }
    throw err;
  }

  await invalidateMeCacheForUser(user.id);

  // Email the coach that they were denied (fire-and-forget)
  if (user.email) {
    sendCoachRejectedEmail({
      to: user.email,
      coachName: user.display_name || 'Coach',
      leagueName: organization.name,
      reason: reason || undefined,
    }).catch(err =>
      console.error('[orgs] Failed to send coach rejected email:', (err as any)?.message)
    );
  }

  // Push notification so the coach sees the denial immediately
  sendPushNotification(
    user.id,
    'Join Request Declined',
    `Your request to join ${organization.name} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
    { type: 'join_request_denied', organization_id: joinRequest.organization_id }
  )
    .then(() => {
      debugLog(`[notif] push sent JOIN_REQUEST_DENIED to user=${user.id}`);
    })
    .catch(err => {
      console.error(
        '[notif] Failed to send push for JOIN_REQUEST_DENIED:',
        (err as any)?.message || err
      );
    });

  // Create in-app notification for the denied user
  try {
    await prisma.notification.create({
      data: {
        user_id: user.id,
        actor_id: reviewerUserId,
        type: 'JOIN_REQUEST_DENIED',
        meta: {
          organization_id: joinRequest.organization_id,
          organization_name: organization.name,
          reason: reason || undefined,
        },
      },
    });
  } catch (notifErr) {
    console.warn('[organizations] Failed to create denial notification:', notifErr);
    captureException(notifErr as Error, {
      context: 'join_request_denial_notification_failed',
      organizationId: joinRequest.organization_id,
      userId: user.id,
      actorId: reviewerUserId,
      reason: reason || null,
    });
  }

  if (context.via === 'email-link') {
    await logAdminActivity(
      reviewerUserId,
      'league-owner-email-action',
      'DENY_JOIN_REQUEST',
      'user',
      joinRequest.user_id,
      `Denied coach join request for org ${organization.name} (via email link)`,
      reason ? { reason } : undefined
    );
  } else {
    await logAdminActivityFromReq(
      context.req,
      'DENY_JOIN_REQUEST',
      'user',
      joinRequest.user_id,
      `Denied coach join request for org ${organization.name}`,
      reason ? { reason } : undefined
    );
  }

  return { ok: true };
}
