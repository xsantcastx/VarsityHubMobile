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

  // Allow team creation during onboarding (coach creates team in step 3 before onboarding completes)
  const isTeamsCreateRoute =
    req.baseUrl === '/teams' &&
    req.method === 'POST' &&
    (req.path === '/' || req.path === '/create');
  if (req.body?.onboarding === true && isTeamsCreateRoute && prefs?.onboarding_completed !== true) {
    return next();
  }

  if (prefs?.onboarding_completed !== true) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  // Block coaches whose approval_status is not explicitly APPROVED.
  // The Prisma default is APPROVED (for fans), but coaches must be set to PENDING
  // during onboarding and only transition to APPROVED via god-admin or org-admin action.
  if (prefs?.role === 'coach' && u?.approval_status !== 'APPROVED') {
    const isRejected = u?.approval_status === 'REJECTED';
    return res.status(403).json({
      error: isRejected
        ? 'Your coach application was not approved. Contact support@varsityhub.app for assistance.'
        : 'Your coach account is pending approval.',
      code: isRejected ? 'APPROVAL_REJECTED' : 'APPROVAL_REQUIRED',
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
