import { Router } from 'express';
import {
    sendBillingNoticeEmail,
    sendContentModerationEmail,
    sendOrganizationApprovalEmail,
    sendOrganizationDenialEmail,
    sendOrganizationInviteEmail,
    sendPasswordResetEmail,
    sendSecurityAlertEmail,
    sendTeamInviteEmail,
    sendVerificationEmail,
} from '../lib/email.js';

const router = Router();

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

router.post('/join-admin', async (req, res) => {
  // PHASE 1: Minimal accurate data from current backend schema
  // See docs/EMAIL_TEMPLATE_FUTURE_PHASE2.md for full vision requiring team/role/seat tracking
  const {
    adminEmail = 'admin@example.com',
    adminName = 'Director Johnson',
    requesterName = 'John Smith',
    requesterEmail = 'john@example.com',
    organizationName = 'Texas Elite Sports',
    message = 'I would love to volunteer as a coach.',
    requestId = 'req_123',
    requestedAt = new Date().toISOString(),
    approveUrl = 'https://varsityhub.app/org/req_123/approve',
    denyUrl = 'https://varsityhub.app/org/req_123/deny',
    orgLogoUrl,
  } = req.body || {};
  // DISABLED: sendJoinRequestToAdmin - template removed from approved list
  // const ok = await sendJoinRequestToAdmin({
  //   adminEmail,
  //   adminName,
  //   requesterName,
  //   requesterEmail,
  //   organizationName,
  //   message,
  //   requestId,
  //   requestedAt,
  //   approveUrl,
  //   denyUrl,
  //   orgLogoUrl,
  // });
  return res.json({ ok: false, message: 'Template disabled' });
});

router.post('/join-approved', async (req, res) => {
  const {
    userEmail = 'user@example.com',
    userName = 'John Smith',
    organizationName = 'Texas Elite Sports',
    adminName = 'Director Johnson',
    orgLogoUrl,
  } = req.body || {};
  // DISABLED: sendJoinRequestApproved - template removed from approved list
  // const ok = await sendJoinRequestApproved({
  //   userEmail,
  //   userName,
  //   organizationName,
  //   adminName,
  //   orgLogoUrl,
  // });
  return res.json({ ok: false, message: 'Template disabled' });
});

router.post('/join-denied', async (req, res) => {
  const {
    userEmail = 'user@example.com',
    userName = 'John Smith',
    organizationName = 'Texas Elite Sports',
    reason = 'We are currently at capacity.',
    orgLogoUrl,
  } = req.body || {};
  // DISABLED: sendJoinRequestDenied - template removed from approved list
  // const ok = await sendJoinRequestDenied({
  //   userEmail,
  //   userName,
  //   organizationName,
  //   reason,
  //   orgLogoUrl,
  // });
  return res.json({ ok: false, message: 'Template disabled' });
});

router.post('/moderation', async (req, res) => {
  const {
    to = 'user@example.com',
    action = 'removed',
    postId = 'post_abc123',
    reason = 'Violated community guidelines.',
    nextSteps,
  } = req.body || {};
  const ok = await sendContentModerationEmail({
    to,
    action,
    postId,
    reason,
    nextSteps,
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

router.post('/org-approval', async (req, res) => {
  const { to = 'user@example.com', organizationName = 'Texas Elite Sports', dashboardLink, orgLogoUrl } = req.body || {};
  const ok = await sendOrganizationApprovalEmail({ to, organizationName, dashboardLink, orgLogoUrl });
  return res.json({ ok });
});

router.post('/org-denial', async (req, res) => {
  const { to = 'user@example.com', organizationName = 'Texas Elite Sports', reason = 'Missing docs', orgLogoUrl } = req.body || {};
  const ok = await sendOrganizationDenialEmail({ to, organizationName, reason, orgLogoUrl });
  return res.json({ ok });
});

router.post('/security-alert', async (req, res) => {
  const {
    to = 'user@example.com',
    alertType = 'password_change',
    ipAddress = '203.0.113.42',
    location = 'Stamford, CT',
    manageUrl,
  } = req.body || {};
  const ok = await sendSecurityAlertEmail({
    to,
    alertType,
    ipAddress,
    location,
    manageUrl,
  });
  return res.json({ ok });
});

export const testEmailsRouter = router;
