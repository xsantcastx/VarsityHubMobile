import { Router } from 'express';
import {
    sendBillingNoticeEmail,
    sendContentModerationEmail,
    sendEndOfDayTransactionReport,
    sendJoinRequestApproved,
    sendJoinRequestDenied,
    sendJoinRequestToAdmin,
    sendOrganizationApprovalEmail,
    sendOrganizationDenialEmail,
    sendOrganizationInviteEmail,
    sendPasswordResetEmail,
    sendTeamInviteEmail,
    sendVerificationEmail,
    sendAccountWarningEmail,
    sendContentRemovedEmail,
    sendAccountSuspension7DaysEmail,
    sendAccountSuspension45DaysEmail,
    sendAccountPermanentBanEmail,
    sendLoginFromNewDeviceEmail,
    sendAccountRecoveryEmail,
    sendEventSubmissionReceivedEmail,
    sendEventApprovedEmail,
    sendEventDeniedEmail,
    sendEventReminderEmail,
    sendEventUpdatedEmail,
    sendEventCanceledEmail,
    sendEventRsvpConfirmedEmail,
    sendRosterThresholdAlertEmail,
    sendPaymentFailedEmail,
    sendSubscriptionExpiringEmail,
    sendReportResolutionEmail,
} from '../lib/email.js';
import { getEndOfDayReport } from '../lib/transactionLogger.js';

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
  const {
    adminEmail = 'admin@example.com',
    adminName = 'Director Johnson',
    requesterName = 'John Smith',
    organizationName = 'Texas Elite Sports',
    message = 'I would love to volunteer as a coach.',
    requestId = 'req_test_123',
    orgLogoUrl,
  } = req.body || {};
  const ok = await sendJoinRequestToAdmin({
    adminEmail,
    adminName,
    requesterName,
    organizationName,
    message,
    requestId,
    orgLogoUrl,
  });
  return res.json({ ok });
});

router.post('/join-approved', async (req, res) => {
  const {
    userEmail = 'user@example.com',
    userName = 'John Smith',
    organizationName = 'Texas Elite Sports',
    adminName = 'Director Johnson',
    orgLogoUrl,
  } = req.body || {};
  const ok = await sendJoinRequestApproved({
    userEmail,
    userName,
    organizationName,
    adminName,
    orgLogoUrl,
  });
  return res.json({ ok });
});

router.post('/join-denied', async (req, res) => {
  const {
    userEmail = 'user@example.com',
    userName = 'John Smith',
    organizationName = 'Texas Elite Sports',
    reason = 'We are currently at capacity.',
    orgLogoUrl,
  } = req.body || {};
  const ok = await sendJoinRequestDenied({
    userEmail,
    userName,
    organizationName,
    reason,
    orgLogoUrl,
  });
  return res.json({ ok });
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

router.post('/transaction-report', async (req, res) => {
  const { to = 'emancero@varsityhub.app', date } = req.body || {};
  
  try {
    // Get report for specified date or today
    const reportDate = date ? new Date(date) : undefined;
    const report = await getEndOfDayReport(reportDate);
    
    const ok = await sendEndOfDayTransactionReport({
      to,
      report,
    });
    
    return res.json({ 
      ok, 
      reportDate: report.date,
      summary: report.summary,
      message: ok ? 'Transaction report sent successfully' : 'Failed to send transaction report'
    });
  } catch (error) {
    console.error('[test-emails] Transaction report test failed:', error);
    return res.status(500).json({ 
      ok: false, 
      error: (error as any).message || 'Unknown error' 
    });
  }
});

// Test endpoints for new email templates
router.post('/account-warning', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', warningReason = 'Violation of community guidelines' } = req.body || {};
  const ok = await sendAccountWarningEmail({ to, userName, warningReason });
  return res.json({ ok });
});

router.post('/content-removed', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', contentType = 'post', removalReason = 'Violated guidelines' } = req.body || {};
  const ok = await sendContentRemovedEmail({ to, userName, contentType, removalReason });
  return res.json({ ok });
});

router.post('/suspension-7days', async (req, res) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const { to = 'test@example.com', userName = 'Test User', reason = 'Repeated violations' } = req.body || {};
  const ok = await sendAccountSuspension7DaysEmail({
    to,
    userName,
    suspensionReason: reason,
    suspensionEndDate: futureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });
  return res.json({ ok });
});

router.post('/suspension-45days', async (req, res) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 45);
  const { to = 'test@example.com', userName = 'Test User', reason = 'Severe violations' } = req.body || {};
  const ok = await sendAccountSuspension45DaysEmail({
    to,
    userName,
    suspensionReason: reason,
    suspensionEndDate: futureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });
  return res.json({ ok });
});

router.post('/permanent-ban', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', reason = 'Severe and repeated violations' } = req.body || {};
  const ok = await sendAccountPermanentBanEmail({ to, userName, banReason: reason });
  return res.json({ ok });
});

router.post('/login-new-device', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', deviceType = 'iPhone 14 Pro', deviceLocation = 'San Francisco, CA' } = req.body || {};
  const ok = await sendLoginFromNewDeviceEmail({
    to,
    userName,
    deviceType,
    deviceLocation,
    loginTime: new Date().toLocaleString(),
  });
  return res.json({ ok });
});

router.post('/account-recovery', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User' } = req.body || {};
  const ok = await sendAccountRecoveryEmail(to, userName, new Date().toLocaleString());
  return res.json({ ok });
});

router.post('/event-submission-received', async (req, res) => {
  const { to = 'test@example.com', coachName = 'Test Coach', eventName = 'Test Event' } = req.body || {};
  const ok = await sendEventSubmissionReceivedEmail({
    to,
    coachName,
    eventName,
    eventDate: '2025-02-15',
    eventTime: '7:00 PM',
    eventLocation: 'Test Location',
    statusLink: 'https://varsityhub.app/events/my-events',
  });
  return res.json({ ok });
});

router.post('/event-approved', async (req, res) => {
  const { to = 'test@example.com', coachName = 'Test Coach', eventName = 'Test Event' } = req.body || {};
  const ok = await sendEventApprovedEmail({
    to,
    coachName,
    eventName,
    eventDate: '2025-02-15',
    eventTime: '7:00 PM',
    eventLocation: 'Test Location',
    eventId: 'test-event-123',
    eventLink: 'https://varsityhub.app/event-detail?id=test-event-123',
  });
  return res.json({ ok });
});

router.post('/event-denied', async (req, res) => {
  const { to = 'test@example.com', coachName = 'Test Coach', eventName = 'Test Event', reason = 'Event conflicts' } = req.body || {};
  const ok = await sendEventDeniedEmail({
    to,
    coachName,
    eventName,
    denialReason: reason,
    resubmitLink: 'https://varsityhub.app/create-fan-event',
    supportLink: 'mailto:support@varsityhub.app',
  });
  return res.json({ ok });
});

router.post('/event-reminder', async (req, res) => {
  const { to = 'test@example.com', recipientName = 'Test User', eventName = 'Test Event' } = req.body || {};
  const ok = await sendEventReminderEmail({
    to,
    recipientName,
    eventName,
    eventDate: '2025-02-15',
    eventTime: '7:00 PM',
    eventLocation: 'Test Location',
    eventId: 'test-event-123',
    checkInLink: 'https://varsityhub.app/event-detail?id=test-event-123',
    calendarLink: 'https://varsityhub.app/event-detail?id=test-event-123',
    directionsLink: 'https://varsityhub.app/event-detail?id=test-event-123',
    preferencesLink: 'https://varsityhub.app/settings',
  });
  return res.json({ ok });
});

router.post('/event-updated', async (req, res) => {
  const { to = 'test@example.com', recipientName = 'Test User', eventName = 'Test Event' } = req.body || {};
  const ok = await sendEventUpdatedEmail({
    to,
    recipientName,
    eventName,
    eventDate: '2025-02-15',
    eventId: 'test-event-123',
    eventDetailLink: 'https://varsityhub.app/event-detail?id=test-event-123',
    changeSummary: 'Event time updated',
  });
  return res.json({ ok });
});

router.post('/event-canceled', async (req, res) => {
  const { to = 'test@example.com', recipientName = 'Test User', eventName = 'Test Event', reason = 'Weather' } = req.body || {};
  const ok = await sendEventCanceledEmail({
    to,
    recipientName,
    eventName,
    eventDate: '2025-02-15',
    cancelReason: reason,
    upcomingEventsLink: 'https://varsityhub.app/events',
    contactOrganizerLink: 'mailto:support@varsityhub.app',
  });
  return res.json({ ok });
});

router.post('/event-rsvp-confirmed', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', eventName = 'Test Event' } = req.body || {};
  const ok = await sendEventRsvpConfirmedEmail({
    to,
    userName,
    eventName,
    eventDate: '2025-02-15',
    eventTime: '7:00 PM',
    eventLocation: 'Test Location',
    eventLink: 'https://varsityhub.app/event-detail?id=test-event-123',
  });
  return res.json({ ok });
});

router.post('/roster-threshold', async (req, res) => {
  const { to = 'test@example.com', coachName = 'Test Coach', teamName = 'Test Team', rosterCount = 25 } = req.body || {};
  const ok = await sendRosterThresholdAlertEmail({
    to,
    coachName,
    teamName,
    rosterCount,
    thresholdCost: 5.00,
    manageBillingUrl: 'https://varsityhub.app/settings/manage-subscription',
  });
  return res.json({ ok });
});

router.post('/payment-failed', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', amount = '$49.99' } = req.body || {};
  const ok = await sendPaymentFailedEmail({
    to,
    userName,
    amount,
    paymentDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });
  return res.json({ ok });
});

router.post('/subscription-expiring', async (req, res) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const { to = 'test@example.com', userName = 'Test User', planName = 'Veteran Plan' } = req.body || {};
  const ok = await sendSubscriptionExpiringEmail({
    to,
    userName,
    planName,
    expiresDate: futureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    daysRemaining: 7,
    renewalPrice: '$1.50/month',
  });
  return res.json({ ok });
});

router.post('/report-resolved', async (req, res) => {
  const { to = 'test@example.com', userName = 'Test User', resolutionStatus = 'resolved' } = req.body || {};
  const ok = await sendReportResolutionEmail({
    to,
    userName,
    reportId: 'test-report-123',
    reportType: 'spam',
    resolutionStatus,
    resolutionReason: resolutionStatus === 'resolved' ? 'Content was removed' : 'No violation found',
  });
  return res.json({ ok });
});

export const testEmailsRouter = router;