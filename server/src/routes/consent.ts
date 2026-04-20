/**
 * Parental consent routes — the parent/guardian-facing surface.
 *
 * Auth model:
 *   - GET  /consent/:token             → public, no auth (parent has no account)
 *   - POST /consent/:token/approve     → public, token IS the auth
 *   - POST /consent/:token/deny        → public, token IS the auth
 *   - POST /me/consent/resend          → minor's own session, auth required
 *
 * The minor's own access to /me/consent/resend is intentionally allowed
 * through the parental-consent gate (see middleware/requireParentalConsent.ts)
 * so a minor whose parent didn't act can request a fresh email.
 */

import { Router } from 'express';
import escapeHtml from 'escape-html';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  lookupConsentByToken,
  recordConsentApproval,
  recordConsentDenial,
  issueConsentToken,
} from '../lib/parentalConsent.js';
import { sendParentalConsentRequestEmail } from '../lib/email.js';
import { invalidateMeCacheForUser } from '../lib/userCache.js';

export const consentRouter = Router();

const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');

function landingPage(safeTitle: string, safeMessage: string, success: boolean): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:60px auto;padding:24px;text-align:center;color:#111827;">
<h2 style="color:${success ? '#16A34A' : '#DC2626'};margin-bottom:12px;">${safeTitle}</h2>
<p style="color:#374151;line-height:1.5;">${safeMessage}</p>
<p style="margin-top:24px;"><a href="${APP_BASE_URL}" style="color:#1B3A6B;text-decoration:none;">Return to VarsityHub</a></p>
</body></html>`;
}

function consentForm(rawToken: string, safeMinorName: string): string {
  const safeToken = escapeHtml(rawToken);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parental Consent — VarsityHub</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:40px auto;padding:24px;color:#111827;">
<h2 style="color:#1B3A6B;">Parental Consent Required</h2>
<p style="line-height:1.5;">Your child <strong>${safeMinorName}</strong> has signed up for VarsityHub. As a youth-sports platform serving users 13–17, we require a parent or guardian to confirm consent before their account becomes active.</p>
<p style="line-height:1.5;color:#374151;">By approving, you confirm you are the parent or guardian and consent to your child's use of VarsityHub under our <a href="${APP_BASE_URL}/privacy" style="color:#1B3A6B;">Privacy Policy</a>.</p>
<form method="POST" action="/consent/${safeToken}/approve" style="margin-top:24px;display:inline-block;">
  <button type="submit" style="background:#16A34A;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Approve</button>
</form>
<form method="POST" action="/consent/${safeToken}/deny" style="margin-top:12px;display:inline-block;margin-left:8px;">
  <button type="submit" style="background:#fff;color:#DC2626;border:1px solid #DC2626;padding:12px 28px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Deny</button>
</form>
<p style="margin-top:32px;font-size:12px;color:#6B7280;">Questions? Contact ${escapeHtml(process.env.CUSTOMER_SERVICE_EMAIL || 'support@varsityhub.app')}.</p>
</body></html>`;
}

// GET /consent/:token — landing page for the parent
consentRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const lookup = await lookupConsentByToken(token);
    if (!lookup.ok) {
      const messages = {
        not_found: 'This consent link is invalid. Please check the URL or request a new email.',
        expired: 'This consent link has expired. Please ask your child to request a new one from the app.',
        already_resolved: 'This consent request has already been handled. No further action needed.',
      };
      return res
        .status(lookup.reason === 'not_found' ? 404 : 410)
        .type('html')
        .send(landingPage('Consent Link Unavailable', messages[lookup.reason], false));
    }
    const minor = await prisma.user.findUnique({
      where: { id: lookup.userId },
      select: { display_name: true, username: true },
    });
    const minorName = minor?.display_name || minor?.username || 'your child';
    return res.type('html').send(consentForm(token, escapeHtml(minorName)));
  })
);

// POST /consent/:token/approve
consentRouter.post(
  '/:token/approve',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const lookup = await lookupConsentByToken(token);
    if (!lookup.ok) {
      return res
        .status(lookup.reason === 'not_found' ? 404 : 410)
        .type('html')
        .send(landingPage('Consent Link Unavailable', 'This link can no longer be used.', false));
    }
    await recordConsentApproval(lookup.userId);
    await invalidateMeCacheForUser(lookup.userId);
    return res
      .type('html')
      .send(
        landingPage(
          'Consent Approved',
          'Thank you. Your child can now access the full app.',
          true
        )
      );
  })
);

// POST /consent/:token/deny
consentRouter.post(
  '/:token/deny',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const lookup = await lookupConsentByToken(token);
    if (!lookup.ok) {
      return res
        .status(lookup.reason === 'not_found' ? 404 : 410)
        .type('html')
        .send(landingPage('Consent Link Unavailable', 'This link can no longer be used.', false));
    }
    await recordConsentDenial(lookup.userId, 'Denied by parent or guardian');
    await invalidateMeCacheForUser(lookup.userId);
    return res
      .type('html')
      .send(
        landingPage(
          'Consent Denied',
          'Your child\'s account has been disabled. To reverse this, contact support.',
          false
        )
      );
  })
);

// Standalone handler for POST /me/consent/resend — minor requests a fresh
// consent email be sent to their stored parent_email. Mounted in app.ts at a
// path that doesn't collide with the public /consent/:token landing routes.
// Enforces: must be in pending state, must have parent_email on file.
export const handleConsentResend = [
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        display_name: true,
        parent_email: true,
        parental_consent_status: true,
      } as any,
    });
    const u = user as any;
    if (!u) return res.status(404).json({ error: 'NOT_FOUND' });
    if (u.parental_consent_status !== 'pending') {
      return res.status(400).json({
        error: 'CONSENT_NOT_PENDING',
        message: 'Consent is not in a pending state — nothing to resend.',
      });
    }
    if (!u.parent_email) {
      return res.status(400).json({
        error: 'PARENT_EMAIL_MISSING',
        message: 'No parent email on file. Update onboarding to provide one.',
      });
    }
    const rawToken = await issueConsentToken(u.id);
    await sendParentalConsentRequestEmail({
      to: u.parent_email,
      minorDisplayName: u.display_name || undefined,
      minorEmail: u.email,
      consentToken: rawToken,
      expiresInDays: 14,
    });
    return res.json({ ok: true });
  }),
];
