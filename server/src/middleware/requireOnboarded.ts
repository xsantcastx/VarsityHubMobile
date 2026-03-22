import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { isEmailAdmin } from './requireAdmin.js';

/**
 * Middleware that rejects requests from users who haven't completed onboarding.
 * Also blocks coaches with PENDING approval_status from coach-only actions.
 * For coaches, verifies their org is admin_approved (god-admin gated).
 * Must be placed after auth middleware (requireAuth or requireVerified).
 */
export async function requireOnboarded(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { preferences: true, approval_status: true, paid_by_owner: true, email: true },
  });
  const prefs = u?.preferences as Record<string, unknown> | null;

  // God-admins bypass all onboarding/approval checks
  if (isEmailAdmin(u?.email)) {
    return next();
  }

  if (prefs?.onboarding_completed !== true) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  // Block coaches whose approval_status is not explicitly APPROVED.
  // PENDING and REJECTED are handled explicitly so clients can show accurate UX.
  if (prefs?.role === 'coach' && u?.approval_status === 'PENDING') {
    return res.status(403).json({
      error: 'Your coach account is pending approval.',
      code: 'APPROVAL_REQUIRED',
    });
  }
  if (prefs?.role === 'coach' && u?.approval_status === 'REJECTED') {
    return res.status(403).json({
      error: 'Your coach application was rejected. Please contact support.',
      code: 'APPROVAL_REJECTED',
    });
  }
  if (prefs?.role === 'coach' && u?.approval_status !== 'APPROVED') {
    return res.status(403).json({
      error: 'Your coach account is pending approval.',
      code: 'APPROVAL_REQUIRED',
    });
  }

  // Extra guard: coaches must belong to an admin-approved org
  if (prefs?.role === 'coach' && u?.approval_status === 'APPROVED') {
    const orgId = prefs?.organization_id as string | undefined;
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { admin_approved: true },
      });
      if (org && !org.admin_approved) {
        return res.status(403).json({
          error: 'Your organization is pending approval.',
          code: 'APPROVAL_REQUIRED',
        });
      }
    }
  }

  // Approved coach accounts that selected a paid tier must complete checkout
  // before accessing coach tools, unless their league owner covers billing.
  if (prefs?.role === 'coach' && u?.approval_status === 'APPROVED' && u?.paid_by_owner !== true) {
    const pendingPlan = String((prefs?.pending_plan as string | undefined) || '').toLowerCase();
    const currentPlan = String((prefs?.plan as string | undefined) || '').toLowerCase();
    const selectedPlan = pendingPlan || currentPlan;
    const requiresPayment = selectedPlan === 'veteran' || selectedPlan === 'legend';
    const paymentPending = prefs?.payment_pending === true;
    const paymentApproved = prefs?.payment_approved === true;
    const joinRequestPending = prefs?.join_request_pending === true;
    const canCheckoutNow = paymentApproved || !joinRequestPending;

    if (requiresPayment && paymentPending && canCheckoutNow) {
      return res.status(403).json({
        error: 'Checkout required before accessing coach tools.',
        code: 'PAYMENT_REQUIRED',
        pending_plan: selectedPlan,
      });
    }
  }

  return next();
}
