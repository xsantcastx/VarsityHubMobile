import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import type { AuthedRequest } from '../middleware/auth.js';
import {
    sendBillingNoticeEmail,
    sendOrganizationInviteEmail,
    sendPasswordResetEmail,
    sendTeamInviteEmail,
    sendVerificationEmail,
    sendEventApprovedEmail,
    sendEventDeniedEmail,
} from '../lib/email.js';
import { getEndOfDayReport } from '../lib/transactionLogger.js';

const router = Router();

// SECURITY: All test email routes require admin authentication
// Additionally block in production unless explicitly enabled
const isDev = process.env.NODE_ENV !== 'production';
const allowTestEmails = process.env.ALLOW_TEST_EMAILS === 'true';

router.use(requireAdmin as any);
router.use((req: AuthedRequest, res, next) => {
  if (!isDev && !allowTestEmails) {
    return res.status(403).json({
      error: 'Test email endpoints are disabled in production',
      hint: 'Set ALLOW_TEST_EMAILS=true to enable (not recommended)'
    });
  }
  next();
});

router.post('/verification', async (req, res) => {
  const { to = 'test@example.com', token = '123456', name = 'Test User' } = req.body || {};
  const ok = await sendVerificationEmail(to, token, name);
  return res.json({ ok });
});

router.post('/password-reset', async (req, res) => {
  const { to = 'test@example.com', code = '654321' } = req.body || {};
  const ok = await sendPasswordResetEmail(to, code);
  return res.json({ ok });
});

router.post('/team-invite', async (req, res) => {
  const {
    to = 'test@example.com',
    teamName = 'Dallas Lady Tigers',
    organizationName = 'Texas Elite Sports',
    role = 'player',
    inviterName = 'Coach Smith',
    teamHeroUrl,
    teamLogoUrl,
    primaryColor = '#2563EB',
  } = req.body || {};
  const ok = await sendTeamInviteEmail({
    to,
    teamName,
    organizationName,
    role,
    inviterName,
    teamHeroUrl,
    teamLogoUrl,
    primaryColor,
  });
  return res.json({ ok });
});

router.post('/org-invite', async (req, res) => {
  const {
    to = 'test@example.com',
    organizationName = 'Texas Elite Sports',
    role = 'coach',
    inviterName = 'Director Johnson',
    orgLogoUrl,
    primaryColor = '#2563EB',
  } = req.body || {};
  const ok = await sendOrganizationInviteEmail({
    to,
    organizationName,
    role,
    inviterName,
    orgLogoUrl,
    primaryColor,
  });
  return res.json({ ok });
});

router.post('/billing', async (req, res) => {
  const {
    to = 'user@example.com',
    type = 'payment_succeeded',
    planName = 'VarsityHub Pro',
    amount = '$49.99',
    teamName,
    orgName,
    perks = ['Unlimited posts', 'Analytics', 'Custom branding'],
  } = req.body || {};
  const ok = await sendBillingNoticeEmail({
    to,
    type,
    planName,
    amount,
    teamName,
    orgName,
    perks,
  });
  return res.json({ ok });
});

router.post('/transaction-report', async (req, res) => {
  const { date } = req.body || {};

  try {
    // Get report for specified date or today
    const reportDate = date ? new Date(date) : undefined;
    const report = await getEndOfDayReport(reportDate);

    // Email sending for transaction report removed as part of email cleanup
    return res.json({
      ok: true,
      reportDate: report.date,
      summary: report.summary,
      message: 'Transaction report retrieved (email sending removed)'
    });
  } catch (error) {
    console.error('[test-emails] Transaction report test failed:', error);
    return res.status(500).json({
      ok: false,
      error: (error as any).message || 'Unknown error'
    });
  }
});

export const testEmailsRouter = router;