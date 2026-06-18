/**
 * Unified Approval Service
 *
 * Centralises the approve/reject logic for organizations, coaches, ads, and events.
 * Each function:
 *   1. Validates current state (idempotent — won't re-approve)
 *   2. Runs DB mutations inside a transaction
 *   3. Dispatches notifications (email + push + in-app) with error isolation
 *      so a notification failure never blocks the approval write.
 */

import type { PrismaClient } from '@prisma/client';
import {
  sendLeagueApprovedEmail,
  sendLeagueRejectedEmail,
  sendCoachApprovedEmail,
  sendCoachRejectedEmail,
  sendAdApprovedEmail,
  sendAdRejectedEmail,
  sendEventApprovedEmail,
  sendEventDeniedEmail,
  sendAdminActionConfirmationEmail,
} from './email.js';
import { sendPushNotification } from './pushNotifications.js';
import { invalidateMeCacheForUser } from './userCache.js';
import { addBreadcrumb, captureException } from './sentry.js';
import {
  buildAuthStateColumns,
  getCanonicalOrganizationId,
  getPreferencesObject,
  mergeAuthStateIntoPreferences,
} from './userAuthState.js';
import { buildBillingStateColumns } from './userBillingState.js';
import { getLatestCoachApplication } from './coachApplications.js';
import { getOrganizationJoinRequestStateForUser } from './organizationWorkflowState.js';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Standard error reporter for fire-and-forget approval-notification emails.
 * Emails in this file are intentionally fire-and-forget so a notification
 * failure does not block the approval write — but we still need the
 * operator to see the failure in Sentry, otherwise a user is silently
 * never notified that they were approved/rejected.
 */
function reportEmailFailure(
  emailType: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  console.warn(`[approvalService] ${emailType} email failed:`, (err as any)?.message || err);
  captureException(err instanceof Error ? err : new Error(String(err)), {
    context: 'approval_service_email_failed',
    email_type: emailType,
    ...(extra || {}),
  });
}

/**
 * Standard error reporter for best-effort approval push notifications.
 * Push failures must never block the approval write, but they do need
 * Sentry visibility so delivery regressions are visible before users report
 * them manually.
 */
function reportPushFailure(
  notificationType: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  console.warn(`[approvalService] ${notificationType} push failed:`, (err as any)?.message || err);
  captureException(err instanceof Error ? err : new Error(String(err)), {
    context: 'approval_service_push_failed',
    notification_type: notificationType,
    ...(extra || {}),
  });
}

/**
 * Check whether an organization is admin-approved.
 * Use this before team creation, coach approval, etc.
 */
export async function isOrganizationApproved(
  orgId: string,
  prisma: PrismaClient,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { admin_approved: true },
  });
  return org?.admin_approved === true;
}

async function notifyAllAdminsOfLeagueAction(params: {
  action: 'league_approved' | 'league_rejected';
  leagueName: string;
  ownerName?: string;
  ownerEmail?: string;
  reason?: string;
}) {
  const { getAllAdminEmails } = await import('./adminEmails.js');
  const adminEmails = getAllAdminEmails();

  await Promise.all(
    adminEmails.map((to) =>
      sendAdminActionConfirmationEmail({
        to,
        action: params.action,
        leagueName: params.leagueName,
        ownerName: params.ownerName,
        ownerEmail: params.ownerEmail,
        reason: params.reason,
      }).catch((err) => {
        console.error(
          `[approvalService] Admin confirmation email failed (${params.action}) for ${to}:`,
          (err as any)?.message || err
        );
      })
    )
  );
}

async function notifyAllAdminsOfAdAction(params: {
  action: 'ad_approved' | 'ad_rejected';
  adName: string;
  reason?: string;
}) {
  const { getAllAdminEmails } = await import('./adminEmails.js');
  const adminEmails = getAllAdminEmails();

  await Promise.all(
    adminEmails.map((to) =>
      sendAdminActionConfirmationEmail({
        to,
        action: params.action,
        // Reuse the template contract field for the reviewed item name so
        // ad moderation gets the same admin confirmation fan-out as leagues.
        leagueName: params.adName,
        reason: params.reason,
      }).catch((err) => {
        console.error(
          `[approvalService] Admin confirmation email failed (${params.action}) for ${to}:`,
          (err as any)?.message || err
        );
      })
    )
  );
}

async function createApprovalNotification(
  prisma: PrismaClient,
  params: {
    data: any;
    errorMessage: string;
    sentryContext: string;
    extra?: Record<string, any>;
  },
) {
  try {
    await prisma.notification.create({ data: params.data });
  } catch (err) {
    console.error(`[approvalService] ${params.errorMessage}:`, (err as any)?.message || err);
    captureException(err as Error, {
      context: params.sentryContext,
      notification_type: params.data?.type ?? 'unknown',
      userId: params.data?.user_id ?? null,
      actorId: params.data?.actor_id ?? null,
      ...params.extra,
    });
  }
}

async function resolveOrganizationOwner(
  prisma: PrismaClient,
  orgId: string,
  fallbackOwner?: {
    id?: string | null;
    display_name?: string | null;
    email?: string | null;
    preferences?: unknown;
  } | null,
) {
  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: orgId, role: 'owner', status: 'active' },
    select: { user_id: true },
  });
  const ownerId = ownerMembership?.user_id || fallbackOwner?.id || null;
  if (!ownerId) return null;
  if (fallbackOwner?.id === ownerId) return fallbackOwner;
  return prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, display_name: true, email: true, preferences: true },
  });
}

function buildOrganizationOwnerApprovedPreferences(
  currentPrefs: unknown,
  organization: { id: string; name: string }
) {
  const next = mergeAuthStateIntoPreferences(getPreferencesObject(currentPrefs), {
    role: 'coach',
    organization_id: organization.id,
    proceeding_as_fan: false,
  });
  next.organization_name = organization.name;
  return next;
}

function buildCoachApprovedPreferences(currentPrefs: unknown) {
  const next = mergeAuthStateIntoPreferences(getPreferencesObject(currentPrefs), {
    role: 'coach',
    proceeding_as_fan: false,
  }) as Record<string, any>;
  Object.assign(next, {
    join_request_pending: false,
  });
  delete next.pending_plan;
  delete next.payment_pending;
  delete next.payment_approved;
  return next;
}

function buildCoachRejectedPreferences(currentPrefs: unknown) {
  const next = mergeAuthStateIntoPreferences(getPreferencesObject(currentPrefs), {
    role: 'coach',
  }) as Record<string, any>;
  Object.assign(next, {
    join_request_pending: false,
  });
  delete next.team_id;
  delete next.team_name;
  return next;
}

// ────────────────────────────────────────────────────────────────────────────
// Organization approval
// ────────────────────────────────────────────────────────────────────────────

export async function approveOrganization(
  orgId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { note?: string },
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      status: true,
      admin_approved: true,
      league_owner_id: true,
      leagueOwner: {
        select: { id: true, display_name: true, email: true, preferences: true },
      },
    },
  });
  if (!org) return { error: 'Organization not found', status: 404 };
  if (org.status === 'rejected') return { error: 'Organization already rejected', status: 409 as const, finalState: 'rejected' as const };
  if (org.admin_approved) return { already: true };
  // IDOR: an admin must not approve their own league/organization.
  if (adminId && adminId === org.league_owner_id) {
    return { error: 'You cannot approve your own organization', status: 403 as const };
  }
  const owner = await resolveOrganizationOwner(prisma, orgId, org.leagueOwner);

  // Atomic approval: org + owner approval_status
  const txOps: any[] = [
    prisma.organization.updateMany({
      where: { id: orgId, admin_approved: false, status: { not: 'rejected' } },
      data: {
        admin_approved: true,
        approved_by: adminId || 'email-token',
        approved_at: new Date(),
        league_owner_id: owner?.id || org.league_owner_id || null,
      },
    }),
  ];

  // Set owner's approval_status
  const ownerId = owner?.id ?? undefined;
  if (ownerId) {
    txOps.push(
      prisma.user.update({
        where: { id: ownerId },
        data: {
          approval_status: 'APPROVED',
          rejected_at: null,
          rejection_reason: null,
          preferences: buildOrganizationOwnerApprovedPreferences(
            owner?.preferences,
            { id: orgId, name: org.name }
          ),
          ...buildAuthStateColumns({
            role: 'coach',
            organization_id: orgId,
            proceeding_as_fan: false,
            coach_agreement_accepted_at: new Date(),
            coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
          }),
        },
      }),
    );
  }
  const [updated] = await prisma.$transaction(txOps);
  if (ownerId) {
    await invalidateMeCacheForUser(ownerId);
  }

  // Race-condition guard: another admin already approved
  if (updated.count === 0) {
    const current = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { admin_approved: true, status: true },
    });
    if (current?.status === 'rejected') {
      return { error: 'Organization already rejected', status: 409 as const, finalState: 'rejected' as const };
    }
    return { already: true };
  }

  // ── Fire-and-forget notifications ──
  if (owner?.email) {
    sendLeagueApprovedEmail({
      to: owner.email,
      ownerName: owner.display_name || 'League Owner',
      leagueName: org.name,
      note: opts?.note,
    }).catch((err) => reportEmailFailure('league_approved', err, { user_id: owner?.id, org_id: org.id }));
  }

  if (owner?.id) {
    await createApprovalNotification(prisma, {
      data: {
        user_id: owner.id,
        type: 'ORG_APPROVED' as any,
        meta: { organization_id: orgId, organization_name: org.name },
      },
      errorMessage: 'org approved in-app notification failed',
      sentryContext: 'organization_approval_notification_failed',
      extra: { orgId, adminId: adminId || 'email-token' },
    });

    sendPushNotification(
      owner.id,
      'Organization Approved!',
      `Your organization "${org.name}" has been approved on VarsityHub.`,
      { type: 'org_approved', organization_id: orgId },
    ).catch((err) =>
      reportPushFailure('org_approved', err, { user_id: owner?.id, org_id: orgId })
    );
  }

  await notifyAllAdminsOfLeagueAction({
    action: 'league_approved',
    leagueName: org.name,
    ownerName: owner?.display_name || undefined,
    ownerEmail: owner?.email || undefined,
  });

  return { ok: true, org };
}

export async function rejectOrganization(
  orgId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { reason?: string },
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      status: true,
      admin_approved: true,
      league_owner_id: true,
      leagueOwner: {
        select: { id: true, display_name: true, email: true, preferences: true },
      },
    },
  });
  if (!org) return { error: 'Organization not found', status: 404 };
  if (org.status === 'rejected') return { already: true };
  if (org.admin_approved) return { error: 'Organization already approved', status: 409 as const, finalState: 'approved' as const };
  const owner = await resolveOrganizationOwner(prisma, orgId, org.leagueOwner);

  const reason = opts?.reason || null;

  // Cascade: reject org, unlink teams, revoke memberships, reject owner
  const didReject = await prisma.$transaction(async (tx) => {
    const updated = await tx.organization.updateMany({
      where: { id: orgId, status: { not: 'rejected' }, admin_approved: false },
      data: {
        status: 'rejected',
        admin_approved: false,
        // v1.0.2: track rejection for 48hr cooldown
        rejected_at: new Date(),
        rejection_reason: reason,
        league_owner_id: owner?.id || org.league_owner_id || null,
      },
    });
    if (updated.count === 0) return false;
    // organization_id is non-nullable — soft-delete teams by archiving them.
    await tx.team.updateMany({
      where: { organization_id: orgId },
      data: { status: 'archived' },
    });
    await tx.organizationMembership.deleteMany({
      where: { organization_id: orgId },
    });
    if (owner?.id) {
      await tx.user.update({
        where: { id: owner.id },
        data: {
          approval_status: 'REJECTED',
          paid_by_owner: false,
          // v1.0.2: mirror org cooldown onto owner so their re-apply path is gated too
          rejected_at: new Date(),
          rejection_reason: reason,
          preferences: {
            ...buildCoachRejectedPreferences(owner.preferences),
            organization_id: orgId,
            organization_name: org.name,
          },
        },
      });
    }
    return true;
  });
  if (!didReject) {
    const current = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { admin_approved: true, status: true },
    });
    if (current?.admin_approved) {
      return { error: 'Organization already approved', status: 409 as const, finalState: 'approved' as const };
    }
    return { already: true };
  }
  if (owner?.id) {
    await invalidateMeCacheForUser(owner.id);
  }

  // ── Fire-and-forget notifications ──
  // v1.0.2: `reason` is declared above (line 146) as `string | null`. Use || undefined
  // where downstream signatures expect `string | undefined`.
  if (owner?.id) {
    await createApprovalNotification(prisma, {
      data: {
        user_id: owner.id,
        type: 'ORG_REJECTED',
        meta: { organization_id: orgId, organization_name: org.name, reason: reason || undefined },
      },
      errorMessage: 'org rejected in-app notification failed',
      sentryContext: 'organization_rejection_notification_failed',
      extra: { orgId, adminId: adminId || 'email-token', reason: reason || null },
    });

    sendPushNotification(
      owner.id,
      'League Not Approved',
      `Your league "${org.name}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
      { type: 'org_rejected', organization_id: orgId },
    ).catch((err) =>
      reportPushFailure('org_rejected', err, {
        user_id: owner?.id,
        org_id: orgId,
        reason: reason || null,
      })
    );
  }

  if (owner?.email) {
    sendLeagueRejectedEmail({
      to: owner.email,
      ownerName: owner.display_name || 'League Owner',
      leagueName: org.name,
      reason: reason || undefined,
    }).catch((err) => reportEmailFailure('league_rejected', err, { user_id: owner?.id, org_id: org.id }));
  }

  await notifyAllAdminsOfLeagueAction({
    action: 'league_rejected',
    leagueName: org.name,
    ownerName: owner?.display_name || undefined,
    ownerEmail: owner?.email || undefined,
    reason: reason || undefined,
  });

  return { ok: true, org };
}

// ────────────────────────────────────────────────────────────────────────────
// Coach approval (admin path)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Admin coach approval — used from /admin/coaches/:id/approve.
 * BUG FIX: now sets paid_by_owner: true (was missing before).
 * Also checks org approval prerequisite when the coach has an org.
 */
export async function approveCoach(
  userId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { note?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, display_name: true, username: true, approval_status: true, preferences: true },
  });
  if (!user) return { error: 'User not found', status: 404 };
  if (user.approval_status !== 'PENDING') return { error: 'User is not pending approval', status: 400 };
  // IDOR: an admin must not approve their own coach application.
  if (adminId && adminId === userId) {
    return { error: 'You cannot approve your own coach application', status: 403 as const };
  }

  // Check org prerequisite: if coach has an org, it must be admin_approved
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const orgId = getCanonicalOrganizationId(user as any);
  if (orgId) {
    const orgApproved = await isOrganizationApproved(orgId, prisma);
    if (!orgApproved) {
      return { error: 'Organization must be approved by VarsityHub before approving coaches.', status: 403 };
    }
  }

  // BUG FIX: set paid_by_owner: true so the coach inherits the org owner's plan.
  // When the coach came through a league join request (has organization_id in prefs),
  // also create org/team memberships — otherwise the coach is "approved" but not
  // actually attached to the league they requested to join.
  const teamId = prefs?.team_id as string | undefined;
  const latestApplication = await getLatestCoachApplication(prisma as any, userId);

  const txOps: any[] = [
    prisma.user.update({
      where: { id: userId },
      data: {
        approval_status: 'APPROVED',
        paid_by_owner: true,
        rejected_at: null,
        rejection_reason: null,
        preferences: buildCoachApprovedPreferences(user.preferences),
        ...buildAuthStateColumns({
          role: 'coach',
          organization_id: orgId ?? null,
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
    }),
  ];

  if (latestApplication?.status === 'submitted') {
    txOps.push(
      prisma.coachApplication.update({
        where: { id: latestApplication.id },
        data: {
          status: 'approved',
          reviewed_at: new Date(),
          reviewed_by: adminId,
          review_note: opts?.note || null,
        },
      }),
    );
  }

  // Create org membership if the coach has an organization
  if (orgId) {
    txOps.push(
      prisma.organizationMembership.upsert({
        where: { organization_id_user_id: { organization_id: orgId, user_id: userId } as any },
        update: { role: 'coach', status: 'active' },
        create: { organization_id: orgId, user_id: userId, role: 'coach', status: 'active' },
        select: { id: true },
      }),
    );

    // If there's a pending join request, mark it approved
    const pendingJoinRequest = await getOrganizationJoinRequestStateForUser(orgId, userId);
    if (pendingJoinRequest?.status === 'pending') {
      txOps.push(
        prisma.organizationJoinRequest.updateMany({
          where: { id: pendingJoinRequest.id, status: 'pending' },
          data: { status: 'approved', reviewed_at: new Date(), reviewed_by: adminId },
        }),
      );
    }
  }

  // Create team membership if the coach was assigned to a specific team
  if (teamId) {
    txOps.push(
      prisma.teamMembership.upsert({
        where: { team_id_user_id: { team_id: teamId, user_id: userId } as any },
        update: { role: 'coach', status: 'active' },
        create: { team_id: teamId, user_id: userId, role: 'coach', status: 'active' },
      }),
    );
  }

  await prisma.$transaction(txOps);
  await invalidateMeCacheForUser(userId);
  addBreadcrumb('Coach approval committed', 'approval.coach', 'info', {
    action: 'approve',
    user_id: userId,
    organization_id: orgId || null,
  });

  const note = opts?.note;

  // ── Fire-and-forget notifications ──
  if (user.email) {
    const orgName = prefs?.organization_name || 'VarsityHub';
    sendCoachApprovedEmail({
      to: user.email,
      coachName: user.display_name || user.username || 'Coach',
      leagueName: orgName,
      note: note || undefined,
      destination: orgId ? 'organization' : 'coach_agreement',
    }).catch((err) => reportEmailFailure('coach_approved', err, { user_id: user.id }));
  }

  await createApprovalNotification(prisma, {
    data: {
      user_id: userId,
      type: 'JOIN_REQUEST_APPROVED',
      meta: { approved_by: 'admin', note: note || undefined },
    },
    errorMessage: 'coach approved in-app notification failed',
    sentryContext: 'coach_approval_notification_failed',
    extra: { userId, adminId, note: note || null },
  });

  sendPushNotification(
    userId,
    'Congratulations!',
    `Congratulations on being accepted as a coach! Tap to complete your setup.${note ? ` Note: ${note}` : ''}`,
    { type: 'coach_approved', screen: 'onboarding' },
  ).catch((err) => reportPushFailure('coach_approved', err, { user_id: userId, admin_id: adminId }));

  return { ok: true, user };
}

/**
 * Admin coach rejection — used from /admin/coaches/:id/reject.
 */
export async function rejectCoach(
  userId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { reason?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, display_name: true, username: true, approval_status: true, preferences: true },
  });
  if (!user) return { error: 'User not found', status: 404 };
  if (user.approval_status !== 'PENDING') return { error: 'User is not pending approval', status: 400 };

  const reason = opts?.reason;
  const rejectedAt = new Date();
  const latestApplication = await getLatestCoachApplication(prisma as any, userId);

  // v1.0.2: persist rejected_at + reason so requireOnboarded / auth handlers
  // can enforce 48hr cooldown on re-apply (see REJECTION_COOLDOWN_MS below).
  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        approval_status: 'REJECTED',
        paid_by_owner: false,
        rejected_at: rejectedAt,
        rejection_reason: reason || null,
        preferences: buildCoachRejectedPreferences(user.preferences),
        ...buildAuthStateColumns({
          role: 'coach',
          organization_id: getCanonicalOrganizationId(user as any),
        }),
      },
    });
    if (latestApplication?.status === 'submitted') {
      await tx.coachApplication.update({
        where: { id: latestApplication.id },
        data: {
          status: 'rejected',
          reviewed_at: rejectedAt,
          reviewed_by: adminId,
          review_note: reason || null,
        },
      });
    }
  });
  await invalidateMeCacheForUser(userId);

  // In-app notification is the guaranteed channel — the pending-approval screen
  // reads the rejection reason from here. Await it so a DB write failure surfaces
  // to Sentry instead of dying as an unhandled rejection.
  await createApprovalNotification(prisma, {
    data: {
      user_id: userId,
      type: 'COACH_REJECTED',
      meta: { rejected_by: 'admin', reason: reason || null },
    },
    errorMessage: 'coach rejected in-app notification failed',
    sentryContext: 'coach_rejection_notification_failed',
    extra: { userId, adminId, reason: reason || null },
  });

  // Email and push are best-effort — in-app above is the canonical record.
  if (user.email) {
    const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    const orgName = prefs?.organization_name || 'VarsityHub';
    sendCoachRejectedEmail({
      to: user.email,
      coachName: user.display_name || user.username || 'Coach',
      leagueName: orgName,
      reason: reason || undefined,
    }).catch((err) => {
      console.error('[approvalService] coach rejected email failed:', err);
      captureException(err as Error, { context: 'coach_rejection_email_failed', userId });
    });
  }

  sendPushNotification(
    userId,
    'Application Update',
    `Your coach application was not approved.${reason ? ` Reason: ${reason}` : ''}`,
    { type: 'coach_rejected', screen: 'onboarding' },
  ).catch((err) =>
    reportPushFailure('coach_rejected', err, {
      user_id: userId,
      admin_id: adminId,
      reason: reason || null,
    })
  );

  return { ok: true, user };
}

// ────────────────────────────────────────────────────────────────────────────
// Ad approval
// ────────────────────────────────────────────────────────────────────────────

export async function approveAd(
  adId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: {
    note?: string;
    /**
     * Required when `banner_moderation_status === 'flagged'`. The reason is
     * persisted in `admin_note` alongside the top moderation labels so the
     * decision is auditable after the fact.
     */
    bannerOverride?: { reason: string };
  },
) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) return { error: 'Ad not found', status: 404 };
  if (ad.status !== 'pending') return { error: `Ad status is '${ad.status}', not 'pending'`, status: 400 };
  // IDOR guard: an admin must not approve an ad they personally own.
  if (adminId && ad.user_id === adminId) {
    return { error: 'You cannot approve your own ad', status: 403 as const };
  }

  // Banner moderation gate. A flagged banner requires an explicit override +
  // reason so a flagged image can never silently reach production. Moderation
  // errors (could-not-scan) are allowed through but annotated automatically so
  // support can tell the difference between "scanned clean" and "scan failed".
  const moderationStatus = (ad as any).banner_moderation_status as
    | 'clean'
    | 'flagged'
    | 'error'
    | null;
  const rawLabels = (ad as any).banner_moderation_labels;
  const moderationLabels: Array<{ name: string; confidence: number }> = Array.isArray(rawLabels)
    ? (rawLabels as any[]).filter((l) => l && typeof l === 'object' && typeof l.name === 'string')
    : [];
  const moderationScore = (ad as any).banner_moderation_score as number | null;
  const moderationError = (ad as any).banner_moderation_error as string | null;

  let derivedAdminNote: string | null = opts?.note?.trim() || null;

  if (moderationStatus === 'flagged') {
    const reason = opts?.bannerOverride?.reason?.trim() || '';
    if (reason.length < 10 || reason.length > 2000) {
      return {
        error: 'banner_moderation_flag_requires_override',
        status: 409 as const,
        moderation: {
          status: moderationStatus,
          score: moderationScore,
          labels: moderationLabels.slice(0, 5),
        },
      };
    }
    const topLabels = moderationLabels
      .slice(0, 3)
      .map((l) => `${l.name} (${Math.round(l.confidence)}%)`)
      .join(', ');
    const overrideLine = `[moderation override] reason: ${reason} | top labels: ${topLabels || 'none captured'} | admin: ${adminId || 'unknown'}`;
    derivedAdminNote = derivedAdminNote ? `${overrideLine}\n${derivedAdminNote}` : overrideLine;
    console.warn(
      `[approvalService] Ad ${adId} approved over moderation flag by ${adminId || 'unknown'}. Reason: ${reason}. Labels: ${topLabels}`
    );
  } else if (moderationStatus === 'error') {
    const note = `[moderation] Approved without successful scan: ${(moderationError || 'unknown').slice(0, 200)}`;
    derivedAdminNote = derivedAdminNote ? `${note}\n${derivedAdminNote}` : note;
    console.warn(
      `[approvalService] Ad ${adId} approved despite moderation error: ${moderationError || 'unknown'}`
    );
  }

  const guard = await prisma.ad.updateMany({
    where: { id: adId, status: 'pending' },
    data: {
      status: 'approved',
      payment_status: ad.payment_status === 'paid' ? 'paid' : 'unpaid',
      ...(derivedAdminNote ? { admin_note: derivedAdminNote } : {}),
    },
  });
  if (guard.count === 0) {
    addBreadcrumb('Ad approval lost race', 'approval.ad', 'warning', {
      action: 'approve',
      ad_id: adId,
    });
    return { error: 'Ad approval status changed before approval could be applied', status: 409 };
  }
  const updated = await prisma.ad.findUnique({ where: { id: adId } });

  // ── Fire-and-forget notifications ──
  if (ad.contact_email) {
    sendAdApprovedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined, note: opts?.note || undefined })
      .catch((err) => reportEmailFailure('ad_approved', err, { ad_id: adId, user_id: ad.user_id }));
  }
  if (ad.user_id) {
    await createApprovalNotification(prisma, {
      data: {
        user_id: ad.user_id,
        type: 'AD_APPROVED' as any,
        meta: { ad_id: adId, business_name: ad.business_name },
      },
      errorMessage: 'ad approved in-app notification failed',
      sentryContext: 'ad_approval_notification_failed',
      extra: { adId, adminId: adminId || null },
    });

    sendPushNotification(
      ad.user_id,
      'Ad Approved!',
      `Your ad for "${ad.business_name || 'your business'}" has been approved. Tap to complete payment.`,
      { type: 'ad_approved', ad_id: adId },
    ).catch((err) =>
      reportPushFailure('ad_approved', err, { ad_id: adId, user_id: ad.user_id, admin_id: adminId })
    );
  }

  await notifyAllAdminsOfAdAction({
    action: 'ad_approved',
    adName: ad.business_name || 'Untitled Ad',
  });

  return { ad: updated };
}

export async function rejectAd(
  adId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { reason?: string },
) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) return { error: 'Ad not found', status: 404 };
  if (ad.status !== 'pending') return { error: `Ad status is '${ad.status}', not 'pending'`, status: 400 };
  // IDOR guard: an admin must not reject an ad they personally own.
  if (adminId && ad.user_id === adminId) {
    return { error: 'You cannot reject your own ad', status: 403 as const };
  }

  const guard = await prisma.$transaction(async (tx) => {
    const transition = await tx.ad.updateMany({
      where: { id: adId, status: 'pending' },
      data: {
        status: 'draft',
        payment_status: ad.payment_status === 'paid' ? 'refund_pending' : 'unpaid',
        ...(opts?.reason ? { admin_note: opts.reason } : {}),
      },
    });
    if (transition.count === 0) return { count: 0 };
    await tx.adReservation.deleteMany({ where: { ad_id: adId } });
    return { count: transition.count };
  });
  if (guard.count === 0) {
    addBreadcrumb('Ad rejection lost race', 'approval.ad', 'warning', {
      action: 'reject',
      ad_id: adId,
    });
    return { error: 'Ad approval status changed before rejection could be applied', status: 409 };
  }

  // Refund only after the pending row has been claimed, so concurrent
  // moderator actions cannot issue a refund for an ad that another admin approved.
  let refundResult: { ok: boolean; amount?: number; refund_id?: string; error?: string } | null = null;
  if (ad.payment_status === 'paid' && ad.user_id) {
    try {
      const tx = await prisma.transactionLog.findFirst({
        where: {
          user_id: ad.user_id,
          order_id: adId,
          transaction_type: 'AD_PURCHASE',
          status: 'COMPLETED',
        },
        orderBy: { created_at: 'desc' },
      });
      if (tx?.stripe_payment_intent_id) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
          apiVersion: '2024-06-20' as any,
          timeout: 20000,
          maxNetworkRetries: 2,
        });
        const refund = await stripe.refunds.create({
          payment_intent: tx.stripe_payment_intent_id,
          reason: 'requested_by_customer',
          metadata: { reason: 'admin_rejected_ad', ad_id: adId, admin_id: adminId || 'unknown' },
        });
        refundResult = {
          ok: true,
          amount: refund.amount ?? tx.total_cents ?? undefined,
          refund_id: refund.id,
        };
        await prisma.transactionLog
          .update({
            where: { id: tx.id },
            data: {
              status: 'REFUNDED' as any,
              metadata: {
                ...((tx.metadata as any) || {}),
                refund_reason: 'admin_rejected_ad',
                stripe_refund_id: refund.id,
                refunded_amount_cents: refund.amount ?? tx.total_cents,
                refunded_at: new Date().toISOString(),
              },
            },
          })
          .catch((e: any) =>
            console.error('[approvalService] failed to update tx log on ad reject refund:', e)
          );
      } else {
        refundResult = { ok: false, error: 'no_payment_intent_found' };
        console.error(
          '[approvalService] CRITICAL: ad rejected after payment but no payment_intent found to refund',
          { adId, userId: ad.user_id }
        );
      }
    } catch (refundErr: any) {
      refundResult = { ok: false, error: refundErr?.message || 'refund_api_failed' };
      console.error('[approvalService] CRITICAL: ad reject refund FAILED — manual intervention needed', {
        adId,
        error: refundErr?.message,
      });
    }
  }

  if (refundResult?.ok) {
    await prisma.ad.update({
      where: { id: adId },
      data: { payment_status: 'refunded' },
    });
  }

  // ── Fire-and-forget notifications ──
  const reason = opts?.reason;
  if (ad.contact_email) {
    sendAdRejectedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined, reason: reason || undefined })
      .catch((err) => reportEmailFailure('ad_rejected', err, { ad_id: adId, user_id: ad.user_id }));
  }
  if (ad.user_id) {
    await createApprovalNotification(prisma, {
      data: {
        user_id: ad.user_id,
        type: 'AD_REJECTED' as any,
        meta: { ad_id: adId, business_name: ad.business_name, reason: reason || null },
      },
      errorMessage: 'ad rejected in-app notification failed',
      sentryContext: 'ad_rejection_notification_failed',
      extra: { adId, adminId: adminId || null, reason: reason || null },
    });

    sendPushNotification(
      ad.user_id,
      'Ad Needs Changes',
      `Your ad for "${ad.business_name || 'your business'}" was not approved.${reason ? ` Reason: ${reason}` : ' Please review and resubmit.'}`,
      { type: 'ad_rejected', ad_id: adId },
    ).catch((err) =>
      reportPushFailure('ad_rejected', err, {
        ad_id: adId,
        user_id: ad.user_id,
        admin_id: adminId,
        reason: reason || null,
      })
    );
  }

  await notifyAllAdminsOfAdAction({
    action: 'ad_rejected',
    adName: ad.business_name || 'Untitled Ad',
    reason: reason || undefined,
  });

  const updated = await prisma.ad.findUnique({ where: { id: adId } });
  return { ad: updated };
}

// ────────────────────────────────────────────────────────────────────────────
// Event approval
// ────────────────────────────────────────────────────────────────────────────

export async function approveEvent(
  eventId: string,
  adminId: string | null,
  prisma: PrismaClient,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: 'Event not found', status: 404 };
  if (event.approval_status === 'approved') return { error: 'Event already approved', status: 400 };
  if (event.approval_status === 'rejected') return { error: 'Event already rejected', status: 400 };
  if (event.approval_status !== 'pending') return { error: 'Invalid state', status: 400 };
  // IDOR: an admin must not approve their own event submission.
  if (adminId && adminId === event.creator_id) {
    return { error: 'You cannot approve your own event', status: 403 as const };
  }

  const guard = await prisma.event.updateMany({
    where: { id: eventId, approval_status: 'pending' },
    data: {
      approval_status: 'approved',
      status: 'approved',
      approved_by: adminId,
      approved_at: new Date(),
    },
  });
  if (guard.count === 0) {
    addBreadcrumb('Event approval lost race', 'approval.event', 'warning', {
      action: 'approve',
      event_id: eventId,
    });
    const current = await prisma.event.findUnique({
      where: { id: eventId },
      select: { approval_status: true },
    });
    return {
      error: `Event state changed during review (now ${current?.approval_status ?? 'unknown'}). Refresh and try again.`,
      status: 409,
    };
  }

  const updated = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      creator: { select: { id: true, display_name: true, email: true } },
    },
  });

  // ── Fire-and-forget notifications ──
  if (updated.creator_id) {
    sendPushNotification(
      updated.creator_id,
      'Event Approved',
      `Your event "${updated.title}" has been approved and is now visible to everyone!`,
      { type: 'event_approved', event_id: eventId, screen: 'event-detail', event_id_param: eventId },
    ).catch((err) =>
      reportPushFailure('event_approved', err, {
        event_id: eventId,
        user_id: updated.creator_id,
        admin_id: adminId,
      })
    );

    await createApprovalNotification(prisma, {
      data: {
        user_id: updated.creator_id,
        type: 'EVENT_APPROVED',
        meta: { event_id: eventId, event_title: updated.title },
      },
      errorMessage: 'event approved in-app notification failed',
      sentryContext: 'event_approval_notification_failed',
      extra: { eventId, userId: updated.creator_id, adminId },
    });

    // Email
    const creator = (updated as any).creator;
    if (creator?.email) {
      const eventDate = updated.date ? new Date(updated.date) : new Date();
      sendEventApprovedEmail({
        to: creator.email,
        recipientName: creator.display_name || 'Fan',
        eventTitle: updated.title,
        eventDate: eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        eventTime: eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        eventLocation: updated.location || '',
        eventId,
      }).catch((err) => reportEmailFailure('event_approved', err, { event_id: eventId, user_id: creator?.id }));
    }
  }

  return { ok: true, event: updated };
}

export async function rejectEvent(
  eventId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { reason?: string },
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: 'Event not found', status: 404 };
  if (event.approval_status === 'approved') return { error: 'Event already approved', status: 400 };
  if (event.approval_status === 'rejected') return { error: 'Event already rejected', status: 400 };
  if (event.approval_status !== 'pending') return { error: 'Invalid state', status: 400 };

  const reason = opts?.reason;

  const guard = await prisma.event.updateMany({
    where: { id: eventId, approval_status: 'pending' },
    data: {
      approval_status: 'rejected',
      status: 'rejected',
      rejected_reason: reason,
      approved_by: null,
      approved_at: null,
    },
  });
  if (guard.count === 0) {
    addBreadcrumb('Event rejection lost race', 'approval.event', 'warning', {
      action: 'reject',
      event_id: eventId,
    });
    const current = await prisma.event.findUnique({
      where: { id: eventId },
      select: { approval_status: true },
    });
    return {
      error: `Event state changed during review (now ${current?.approval_status ?? 'unknown'}). Refresh and try again.`,
      status: 409,
    };
  }

  const updated = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      creator: { select: { id: true, display_name: true, email: true } },
    },
  });

  // ── Fire-and-forget notifications ──
  if (updated.creator_id) {
    const reasonText = reason ? ` Reason: ${reason}` : '';
    sendPushNotification(
      updated.creator_id,
      'Event Not Approved',
      `Your event "${updated.title}" was not approved.${reasonText}`,
      { type: 'event_rejected', event_id: eventId, reason: reason || null, screen: 'event-detail', event_id_param: eventId },
    ).catch((err) =>
      reportPushFailure('event_rejected', err, {
        event_id: eventId,
        user_id: updated.creator_id,
        admin_id: adminId,
        reason: reason || null,
      })
    );

    await createApprovalNotification(prisma, {
      data: {
        user_id: updated.creator_id,
        type: 'EVENT_REJECTED',
        meta: { event_id: eventId, event_title: updated.title, reason: reason || null },
      },
      errorMessage: 'event rejected in-app notification failed',
      sentryContext: 'event_rejection_notification_failed',
      extra: { eventId, userId: updated.creator_id, adminId, reason: reason || null },
    });

    const creator = (updated as any).creator;
    if (creator?.email) {
      sendEventDeniedEmail({
        to: creator.email,
        recipientName: creator.display_name || 'User',
        eventTitle: updated.title,
        reason: reason || undefined,
      }).catch((err) => reportEmailFailure('event_denied', err, { event_id: eventId, user_id: creator?.id }));
    }
  }

  return { ok: true, event: updated };
}

// ────────────────────────────────────────────────────────────────────────────
// Scheduled auto-expiration helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Send reminder to admins about coaches pending > 7 days.
 * Called by scheduler daily.
 */
export async function remindPendingCoachApprovals(prisma: PrismaClient): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const staleCoaches = await prisma.user.findMany({
    where: {
      approval_status: 'PENDING',
      OR: [
        { role: 'coach' as any },
        { preferences: { path: ['role'], equals: 'coach' } },
      ],
      created_at: { lt: sevenDaysAgo },
    },
    select: { id: true, display_name: true, email: true, created_at: true },
    take: 50,
  });

  if (staleCoaches.length === 0) return 0;

  console.log(`[approval-reminder] ${staleCoaches.length} coach(es) pending > 7 days`);

  return staleCoaches.length;
}

/**
 * Auto-reject coaches pending > 30 days with no admin action.
 * Called by scheduler daily. Sends rejection email with reason.
 */
export async function autoExpirePendingCoaches(prisma: PrismaClient): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const expiredCoaches = await prisma.user.findMany({
    where: {
      approval_status: 'PENDING',
      OR: [
        { role: 'coach' as any },
        { preferences: { path: ['role'], equals: 'coach' } },
      ],
      created_at: { lt: thirtyDaysAgo },
    },
    select: { id: true, display_name: true, email: true },
    take: 50,
  });

  for (const coach of expiredCoaches) {
    await rejectCoach(coach.id, 'system', prisma, {
      reason: 'Application expired after 30 days without admin review. Please re-apply.',
    }).catch((err) => {
      console.error(`[auto-expire] Failed to expire coach ${coach.id}:`, err);
    });
  }

  if (expiredCoaches.length > 0) {
    console.log(`[auto-expire] Expired ${expiredCoaches.length} coach application(s)`);
  }

  return expiredCoaches.length;
}

/**
 * Auto-reject pending events past their event date.
 * Called by scheduler daily.
 */
export async function autoExpireStaleEvents(prisma: PrismaClient): Promise<number> {
  const now = new Date();

  const result = await prisma.event.updateMany({
    where: {
      approval_status: 'pending',
      date: { lt: now },
    },
    data: {
      approval_status: 'rejected',
      rejected_reason: 'Auto-expired: event date has passed',
    },
  });

  if (result.count > 0) {
    console.log(`[auto-expire] Expired ${result.count} past-date pending event(s)`);
  }

  return result.count;
}
