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
import { sendPushNotification } from './notifications.js';
import { invalidateMeCacheForUser, updateUserAndInvalidate } from './userCache.js';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

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

function getPreferencesObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  return {};
}

function buildOrganizationOwnerApprovedPreferences(
  currentPrefs: unknown,
  organization: { id: string; name: string }
) {
  return {
    ...getPreferencesObject(currentPrefs),
    role: 'coach',
    organization_id: organization.id,
    organization_name: organization.name,
    proceeding_as_fan: false,
  };
}

function buildCoachApprovedPreferences(currentPrefs: unknown) {
  const next = {
    ...getPreferencesObject(currentPrefs),
    role: 'coach',
    join_request_pending: false,
    proceeding_as_fan: false,
  } as Record<string, any>;
  delete next.pending_plan;
  delete next.payment_pending;
  delete next.payment_approved;
  return next;
}

function buildCoachRejectedPreferences(currentPrefs: unknown) {
  const next = {
    ...getPreferencesObject(currentPrefs),
    role: 'coach',
    join_request_pending: false,
  } as Record<string, any>;
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
    include: { leagueOwner: { select: { id: true, display_name: true, email: true, preferences: true } } },
  });
  if (!org) return { error: 'Organization not found', status: 404 };
  if (org.admin_approved) return { already: true };

  // Atomic approval: org + owner approval_status
  const txOps: any[] = [
    prisma.organization.updateMany({
      where: { id: orgId, admin_approved: false },
      data: {
        admin_approved: true,
        approved_by: adminId || 'email-token',
        approved_at: new Date(),
      },
    }),
  ];

  // Set owner's approval_status
  let ownerId = org.leagueOwner?.id;
  if (!ownerId) {
    const ownerMembership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, role: 'owner' },
      select: { user_id: true },
    });
    ownerId = ownerMembership?.user_id ?? undefined;
  }
  if (ownerId) {
    txOps.push(
      prisma.user.update({
        where: { id: ownerId },
        data: {
          approval_status: 'APPROVED',
          rejected_at: null,
          rejection_reason: null,
          preferences: buildOrganizationOwnerApprovedPreferences(
            org.leagueOwner?.preferences,
            { id: orgId, name: org.name }
          ),
        },
      }),
    );
  }
  const [updated] = await prisma.$transaction(txOps);
  if (ownerId) {
    await invalidateMeCacheForUser(ownerId);
  }

  // Race-condition guard: another admin already approved
  if (updated.count === 0) return { already: true };

  // ── Fire-and-forget notifications ──
  if (org.leagueOwner?.email) {
    sendLeagueApprovedEmail({
      to: org.leagueOwner.email,
      ownerName: org.leagueOwner.display_name || 'League Owner',
      leagueName: org.name,
      note: opts?.note,
    }).catch((err) => console.error('[approvalService] League approved email error:', (err as any)?.message || err));
  }

  if (org.leagueOwner?.id) {
    sendPushNotification(
      org.leagueOwner.id,
      'Organization Approved!',
      `Your organization "${org.name}" has been approved on VarsityHub.`,
      { type: 'org_approved', organization_id: orgId },
    ).catch((err) => console.warn('[approvalService] org approved push failed:', (err as any)?.message || err));

    prisma.notification.create({
      data: {
        user_id: org.leagueOwner.id,
        type: 'ORG_APPROVED' as any,
        meta: { organization_id: orgId, organization_name: org.name },
      },
    }).catch((err) => console.error('[approvalService] org approved in-app notification failed:', (err as any)?.message || err));
  }

  await notifyAllAdminsOfLeagueAction({
    action: 'league_approved',
    leagueName: org.name,
    ownerName: org.leagueOwner?.display_name || undefined,
    ownerEmail: org.leagueOwner?.email || undefined,
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
    include: { leagueOwner: { select: { id: true, display_name: true, email: true, preferences: true } } },
  });
  if (!org) return { error: 'Organization not found', status: 404 };

  const reason = opts?.reason || null;

  // Cascade: reject org, unlink teams, revoke memberships, reject owner
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: orgId },
      data: {
        status: 'rejected',
        admin_approved: false,
        // v1.0.2: track rejection for 48hr cooldown
        rejected_at: new Date(),
        rejection_reason: reason,
      },
    });
    // organization_id is non-nullable — soft-delete teams by setting status instead
    await tx.team.updateMany({
      where: { organization_id: orgId },
      data: { status: 'inactive' },
    });
    await tx.organizationMembership.deleteMany({
      where: { organization_id: orgId },
    });
    if (org.leagueOwner?.id) {
      await tx.user.update({
        where: { id: org.leagueOwner.id },
        data: {
          approval_status: 'REJECTED',
          paid_by_owner: false,
          // v1.0.2: mirror org cooldown onto owner so their re-apply path is gated too
          rejected_at: new Date(),
          rejection_reason: reason,
          preferences: {
            ...buildCoachRejectedPreferences(org.leagueOwner.preferences),
            organization_id: orgId,
            organization_name: org.name,
          },
        },
      });
    }
  });
  if (org.leagueOwner?.id) {
    await invalidateMeCacheForUser(org.leagueOwner.id);
  }

  // ── Fire-and-forget notifications ──
  // v1.0.2: `reason` is declared above (line 146) as `string | null`. Use || undefined
  // where downstream signatures expect `string | undefined`.
  if (org.leagueOwner?.id) {
    sendPushNotification(
      org.leagueOwner.id,
      'League Not Approved',
      `Your league "${org.name}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
      { type: 'org_rejected', organization_id: orgId },
    ).catch(() => {});

    prisma.notification.create({
      data: {
        user_id: org.leagueOwner.id,
        type: 'ORG_REJECTED',
        meta: { organization_id: orgId, organization_name: org.name, reason: reason || undefined },
      },
    }).catch(() => {});
  }

  if (org.leagueOwner?.email) {
    sendLeagueRejectedEmail({
      to: org.leagueOwner.email,
      ownerName: org.leagueOwner.display_name || 'League Owner',
      leagueName: org.name,
      reason: reason || undefined,
    }).catch(() => {});
  }

  await notifyAllAdminsOfLeagueAction({
    action: 'league_rejected',
    leagueName: org.name,
    ownerName: org.leagueOwner?.display_name || undefined,
    ownerEmail: org.leagueOwner?.email || undefined,
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
  adminId: string,
  prisma: PrismaClient,
  opts?: { note?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, display_name: true, username: true, approval_status: true, preferences: true },
  });
  if (!user) return { error: 'User not found', status: 404 };
  if (user.approval_status !== 'PENDING') return { error: 'User is not pending approval', status: 400 };

  // Check org prerequisite: if coach has an org, it must be admin_approved
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const orgId = prefs?.organization_id;
  if (orgId) {
    const orgApproved = await isOrganizationApproved(orgId, prisma);
    if (!orgApproved) {
      return { error: 'Organization must be approved by VarsityHub before approving coaches.', status: 403 };
    }
  }

  // BUG FIX: set paid_by_owner: true so the coach inherits the org owner's plan
  await updateUserAndInvalidate(prisma, {
    where: { id: userId },
    data: {
      approval_status: 'APPROVED',
      paid_by_owner: true,
      rejected_at: null,
      rejection_reason: null,
      preferences: buildCoachApprovedPreferences(user.preferences),
    },
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
    }).catch((err) => console.error('[approvalService] coach approved email failed:', err));
  }

  prisma.notification.create({
    data: {
      user_id: userId,
      type: 'JOIN_REQUEST_APPROVED',
      meta: { approved_by: 'admin', note: note || undefined },
    },
  }).catch(() => {});

  sendPushNotification(
    userId,
    'Congratulations!',
    `Congratulations on being accepted as a coach! Tap to complete your setup.${note ? ` Note: ${note}` : ''}`,
    { type: 'coach_approved', screen: 'onboarding' },
  ).catch(() => {});

  return { ok: true, user };
}

/**
 * Admin coach rejection — used from /admin/coaches/:id/reject.
 */
export async function rejectCoach(
  userId: string,
  adminId: string,
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

  // v1.0.2: persist rejected_at + reason so requireOnboarded / auth handlers
  // can enforce 48hr cooldown on re-apply (see REJECTION_COOLDOWN_MS below).
  await updateUserAndInvalidate(prisma, {
    where: { id: userId },
    data: {
      approval_status: 'REJECTED',
      paid_by_owner: false,
      rejected_at: new Date(),
      rejection_reason: reason || null,
      preferences: buildCoachRejectedPreferences(user.preferences),
    },
  });

  // ── Fire-and-forget notifications ──
  if (user.email) {
    const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    const orgName = prefs?.organization_name || 'VarsityHub';
    sendCoachRejectedEmail({
      to: user.email,
      coachName: user.display_name || user.username || 'Coach',
      leagueName: orgName,
      reason: reason || undefined,
    }).catch((err) => console.error('[approvalService] coach rejected email failed:', err));
  }

  prisma.notification.create({
    data: {
      user_id: userId,
      type: 'COACH_REJECTED',
      meta: { rejected_by: 'admin', reason: reason || null },
    },
  }).catch(() => {});

  sendPushNotification(
    userId,
    'Application Update',
    `Your coach application was not approved.${reason ? ` Reason: ${reason}` : ''}`,
    { type: 'coach_rejected', screen: 'onboarding' },
  ).catch(() => {});

  return { ok: true, user };
}

// ────────────────────────────────────────────────────────────────────────────
// Ad approval
// ────────────────────────────────────────────────────────────────────────────

export async function approveAd(
  adId: string,
  adminId: string | null,
  prisma: PrismaClient,
  opts?: { note?: string },
) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) return { error: 'Ad not found', status: 404 };
  if (ad.status !== 'pending') return { error: `Ad status is '${ad.status}', not 'pending'`, status: 400 };

  const updated = await prisma.ad.update({
    where: { id: adId },
    data: {
      status: 'approved',
      payment_status: ad.payment_status === 'paid' ? 'paid' : 'pending_approval',
      ...(opts?.note ? { admin_note: opts.note } : {}),
    },
  });

  // ── Fire-and-forget notifications ──
  if (ad.contact_email) {
    sendAdApprovedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined, note: opts?.note || undefined })
      .catch((err) => console.error('[approvalService] ad approved email error:', (err as any)?.message || err));
  }
  if (ad.user_id) {
    sendPushNotification(
      ad.user_id,
      'Ad Approved!',
      `Your ad for "${ad.business_name || 'your business'}" has been approved. Tap to complete payment.`,
      { type: 'ad_approved', ad_id: adId },
    ).catch((err) => console.warn('[approvalService] ad approved push failed:', (err as any)?.message || err));

    prisma.notification.create({
      data: { user_id: ad.user_id, type: 'AD_APPROVED' as any, meta: { ad_id: adId, business_name: ad.business_name } },
    }).catch((err) => console.error('[approvalService] ad approved in-app notification failed:', (err as any)?.message || err));
  }

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

  // v1.0.2 pass 8: if ad was already paid before admin rejection, refund the user.
  // Previously the ad was reset to draft + unpaid but the money stayed with VarsityHub.
  let refundResult: { ok: boolean; amount?: number; refund_id?: string; error?: string } | null = null;
  if (ad.payment_status === 'paid' && ad.user_id) {
    try {
      // Find the matching transaction log entry to get the payment intent
      const tx = await prisma.transactionLog.findFirst({
        where: { user_id: ad.user_id, order_id: adId, transaction_type: 'AD_PURCHASE', status: 'COMPLETED' },
        orderBy: { created_at: 'desc' },
      });
      if (tx?.stripe_payment_intent_id) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' as any });
        const refund = await stripe.refunds.create({
          payment_intent: tx.stripe_payment_intent_id,
          reason: 'requested_by_customer',
          metadata: { reason: 'admin_rejected_ad', ad_id: adId, admin_id: adminId || 'unknown' },
        });
        refundResult = { ok: true, amount: refund.amount ?? tx.total_cents ?? undefined, refund_id: refund.id };
        // Update transaction log with refund info
        await prisma.transactionLog.update({
          where: { id: tx.id },
          data: {
            status: 'REFUNDED' as any,
            metadata: {
              ...(tx.metadata as any || {}),
              refund_reason: 'admin_rejected_ad',
              stripe_refund_id: refund.id,
              refunded_amount_cents: refund.amount ?? tx.total_cents,
              refunded_at: new Date().toISOString(),
            },
          },
        }).catch((e: any) => console.error('[approvalService] failed to update tx log on ad reject refund:', e));
      } else {
        refundResult = { ok: false, error: 'no_payment_intent_found' };
        console.error('[approvalService] CRITICAL: ad rejected after payment but no payment_intent found to refund', { adId, userId: ad.user_id });
      }
    } catch (refundErr: any) {
      refundResult = { ok: false, error: refundErr?.message || 'refund_api_failed' };
      console.error('[approvalService] CRITICAL: ad reject refund FAILED — manual intervention needed', { adId, error: refundErr?.message });
    }
  }

  await prisma.$transaction([
    prisma.adReservation.deleteMany({ where: { ad_id: adId } }),
    prisma.ad.update({
      where: { id: adId },
      data: {
        status: 'draft',
        // v1.0.2 pass 8: payment_status reflects refund outcome (not just blanket "unpaid")
        payment_status: refundResult?.ok ? 'refunded' : ad.payment_status === 'paid' ? 'refund_pending' : 'unpaid',
        ...(opts?.reason ? { admin_note: opts.reason } : {}),
      },
    }),
  ]);

  // ── Fire-and-forget notifications ──
  const reason = opts?.reason;
  if (ad.contact_email) {
    sendAdRejectedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined, reason: reason || undefined })
      .catch((err) => console.warn('[approvalService] ad reject email failed:', (err as any)?.message || err));
  }
  if (ad.user_id) {
    sendPushNotification(
      ad.user_id,
      'Ad Needs Changes',
      `Your ad for "${ad.business_name || 'your business'}" was not approved.${reason ? ` Reason: ${reason}` : ' Please review and resubmit.'}`,
      { type: 'ad_rejected', ad_id: adId },
    ).catch((err) => console.warn('[approvalService] ad reject push failed:', (err as any)?.message || err));

    prisma.notification.create({
      data: { user_id: ad.user_id, type: 'AD_REJECTED' as any, meta: { ad_id: adId, business_name: ad.business_name, reason: reason || null } },
    }).catch((err) => console.error('[approvalService] ad rejected in-app notification failed:', (err as any)?.message || err));
  }

  const updated = await prisma.ad.findUnique({ where: { id: adId } });
  return { ad: updated };
}

// ────────────────────────────────────────────────────────────────────────────
// Event approval
// ────────────────────────────────────────────────────────────────────────────

export async function approveEvent(
  eventId: string,
  adminId: string,
  prisma: PrismaClient,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: 'Event not found', status: 404 };
  if (event.approval_status === 'approved') return { error: 'Event already approved', status: 400 };
  if (event.approval_status === 'rejected') return { error: 'Event already rejected', status: 400 };
  if (event.approval_status !== 'pending') return { error: 'Invalid state', status: 400 };

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'approved',
      status: 'approved',
      approved_by: adminId,
      approved_at: new Date(),
    },
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
    ).catch((err) => console.warn('[approvalService] event approved push failed:', err));

    prisma.notification.create({
      data: { user_id: updated.creator_id, type: 'EVENT_APPROVED', meta: { event_id: eventId, event_title: updated.title } },
    }).catch((err) => console.error('[approvalService] event approved in-app notification failed:', (err as any)?.message || err));

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
      }).catch((err) => console.warn('[approvalService] event approved email failed:', err));
    }
  }

  return { ok: true, event: updated };
}

export async function rejectEvent(
  eventId: string,
  adminId: string,
  prisma: PrismaClient,
  opts?: { reason?: string },
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: 'Event not found', status: 404 };
  if (event.approval_status === 'approved') return { error: 'Event already approved', status: 400 };
  if (event.approval_status === 'rejected') return { error: 'Event already rejected', status: 400 };
  if (event.approval_status !== 'pending') return { error: 'Invalid state', status: 400 };

  const reason = opts?.reason;

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'rejected',
      status: 'rejected',
      rejected_reason: reason,
      approved_by: null,
      approved_at: null,
    },
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
    ).catch((err) => console.warn('[approvalService] event rejected push failed:', err));

    prisma.notification.create({
      data: { user_id: updated.creator_id, type: 'EVENT_REJECTED', meta: { event_id: eventId, event_title: updated.title, reason: reason || null } },
    }).catch((err) => console.error('[approvalService] event rejected in-app notification failed:', (err as any)?.message || err));

    const creator = (updated as any).creator;
    if (creator?.email) {
      sendEventDeniedEmail({
        to: creator.email,
        recipientName: creator.display_name || 'User',
        eventTitle: updated.title,
        reason: reason || undefined,
      }).catch((err) => console.warn('[approvalService] event denied email failed:', err));
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
      preferences: { path: ['role'], equals: 'coach' },
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
      preferences: { path: ['role'], equals: 'coach' },
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
