import type { Prisma } from '@prisma/client';
import { getOrganizationOwner } from './organizationAuthorization.js';
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
// verifies the signature. This module revalidates the capability's current
// owner and application attempt under the same org lock as ownership transfer.
// The Serializable transaction persists the decision, membership, user state,
// in-app notification and audit together. Only its winner sends external notices.

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
 * (authenticated request vs bound email recipient) and the
 * notification-failure reporting style each path has always used.
 */
export type JoinRequestReviewContext =
  | { via: 'app'; req: AuthedRequest }
  | { via: 'email-link'; requestCreatedAt: string };

class JoinRequestReviewError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function assertCurrentReviewAuthority(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    applicantId: string;
    reviewerUserId: string;
    createdAt: Date;
    context: JoinRequestReviewContext;
  }
) {
  if (params.applicantId === params.reviewerUserId) {
    throw new JoinRequestReviewError(403, 'You cannot review your own join request');
  }
  // Also used by transfer-ownership; authority cannot change between this read
  // and the decision commit. Serializable conflicts remain safely retryable.
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${params.organizationId} FOR UPDATE`;
  if (params.context.via === 'app') {
    const reviewer = await tx.user.findUnique({
      where: { id: params.reviewerUserId },
      select: { email: true, email_verified: true },
    });
    if (reviewer?.email_verified && isAdminEmail(reviewer.email)) return;
  }
  const owner = await getOrganizationOwner(params.organizationId, tx);
  if (!owner || owner.id !== params.reviewerUserId) {
    throw new JoinRequestReviewError(
      403,
      'Ownership changed. Open VarsityHub to review this request.'
    );
  }
  if (
    params.context.via === 'email-link' &&
    params.createdAt.toISOString() !== params.context.requestCreatedAt
  ) {
    throw new JoinRequestReviewError(
      409,
      'This link belongs to an earlier request. Open VarsityHub to review the current request.'
    );
  }
}

async function recordJoinRequestDecision(
  tx: Prisma.TransactionClient,
  params: {
    approved: boolean;
    reviewerUserId: string;
    applicantId: string;
    organization: { id: string; name: string };
    context: JoinRequestReviewContext;
    reason?: string;
  }
) {
  const { approved, reviewerUserId, applicantId, organization, context, reason } = params;
  const reviewer = await tx.user.findUnique({
    where: { id: reviewerUserId },
    select: { email: true },
  });
  await tx.notification.create({
    data: {
      user_id: applicantId,
      actor_id: reviewerUserId,
      type: approved ? 'JOIN_REQUEST_APPROVED' : 'JOIN_REQUEST_DENIED',
      meta: {
        organization_id: organization.id,
        organization_name: organization.name,
        ...(!approved && reason ? { reason } : {}),
      },
    },
  });
  await tx.adminActivityLog.create({
    data: {
      admin_id: reviewerUserId,
      admin_email: reviewer?.email || 'unknown',
      action: approved ? 'APPROVE_JOIN_REQUEST' : 'DENY_JOIN_REQUEST',
      target_type: 'user',
      target_id: applicantId,
      description: `${approved ? 'Approved' : 'Denied'} coach join request for org ${organization.name}${context.via === 'email-link' ? ' (via email link)' : ''}`,
      metadata: {
        source: context.via,
        organization_id: organization.id,
        ...(reason ? { reason } : {}),
      },
    },
  });
}

function isSerializationConflict(err: unknown): boolean {
  const error = err as { code?: string; meta?: { code?: string } };
  // Raw SELECT FOR UPDATE surfaces PostgreSQL 40001 as P2010; Prisma writes
  // surface the same retryable conflict as P2034.
  return error?.code === 'P2034' || (error?.code === 'P2010' && error.meta?.code === '40001');
}

async function runJoinRequestDecisionTransaction(
  work: (tx: Prisma.TransactionClient) => Promise<void>
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      // Retry only rolled-back DB serialization conflicts. Each fresh transaction
      // rechecks authority+attempt; external notifications run after this returns.
      if (!isSerializationConflict(error) || attempt >= 2) throw error;
    }
  }
}

function decisionFailure(
  err: unknown,
  context: JoinRequestReviewContext
): JoinRequestDecisionResult | null {
  if (err instanceof JoinRequestReviewError)
    return { ok: false, status: err.status, error: err.message };
  if ((err as { message?: string })?.message === 'JOIN_REQUEST_ALREADY_REVIEWED') {
    return {
      ok: false,
      status: context.via === 'email-link' ? 409 : 400,
      error: ALREADY_REVIEWED_ERROR,
    };
  }
  if (isSerializationConflict(err)) {
    return {
      ok: false,
      status: 503,
      error: 'Another review or ownership change is in progress. Please retry this request.',
    };
  }
  return null;
}

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
    await runJoinRequestDecisionTransaction(async tx => {
      await assertCurrentReviewAuthority(tx, {
        organizationId: joinRequest.organization_id,
        applicantId: joinRequest.user_id,
        reviewerUserId,
        createdAt: joinRequest.created_at,
        context,
      });
      // Re-check status inside transaction to prevent race condition (ORG-4)
      const transition = await tx.organizationJoinRequest.updateMany({
        where: { id: requestId, status: 'pending', created_at: joinRequest.created_at },
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
      await recordJoinRequestDecision(tx, {
        approved: true,
        reviewerUserId,
        applicantId: joinRequest.user_id,
        organization: { id: joinRequest.organization_id, name: organization.name },
        context,
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
    });
  } catch (err: any) {
    const failure = decisionFailure(err, context);
    if (failure) return failure;
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
    await runJoinRequestDecisionTransaction(async tx => {
      await assertCurrentReviewAuthority(tx, {
        organizationId: joinRequest.organization_id,
        applicantId: joinRequest.user_id,
        reviewerUserId,
        createdAt: joinRequest.created_at,
        context,
      });
      const transition = await tx.organizationJoinRequest.updateMany({
        where: { id: requestId, status: 'pending', created_at: joinRequest.created_at },
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
      await recordJoinRequestDecision(tx, {
        approved: false,
        reviewerUserId,
        applicantId: user.id,
        organization: { id: joinRequest.organization_id, name: organization.name },
        context,
        reason,
      });
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
    });
  } catch (err: any) {
    const failure = decisionFailure(err, context);
    if (failure) return failure;
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

  return { ok: true };
}
