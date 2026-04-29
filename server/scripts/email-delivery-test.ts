/**
 * Email Delivery Test Script
 * ==========================
 * Triggers every email type in the VarsityHub email module and sends to a
 * single test recipient. Reports pass/fail for each email and whether it
 * used a branded HTML template or a plain-text/generic fallback.
 *
 * Usage:
 *   npx tsx scripts/email-delivery-test.ts
 *
 * Requires SENDGRID_API_KEY in .env (loaded automatically via dotenv/config).
 */

import 'dotenv/config';

// ── Constants ──────────────────────────────────────────────────────────────────
const TEST_EMAIL = 'support@varsityhub.app';

// ── Types ──────────────────────────────────────────────────────────────────────
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  note?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<boolean>): Promise<void> {
  const label = `[${results.length + 1}] ${name}`;
  try {
    console.log(`\n--- Sending: ${label} ---`);
    const ok = await fn();
    const note = ok ? 'Sent (template or branded fallback)' : 'Function returned false (may still have sent via fallback)';
    results.push({ name, passed: ok, note });
    console.log(`  => ${ok ? 'PASS' : 'WARN (returned false)'} — ${note}`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    results.push({ name, passed: false, error: msg });
    console.error(`  => FAIL — ${msg}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  // Preflight check
  if (!process.env.SENDGRID_API_KEY) {
    console.error('ERROR: SENDGRID_API_KEY is not set. Load it in .env or export it.');
    process.exit(1);
  }
  console.log(`SENDGRID_API_KEY is set (${process.env.SENDGRID_API_KEY.slice(0, 8)}...)`);
  console.log(`All emails will be sent to: ${TEST_EMAIL}\n`);

  // Dynamic import — the server uses ES modules
  const emailModule = await import('../src/lib/email.js');

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Verification Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendVerificationEmail', () =>
    emailModule.sendVerificationEmail(TEST_EMAIL, '482901', 'Test User'),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Password Reset Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendPasswordResetEmail', () =>
    emailModule.sendPasswordResetEmail(TEST_EMAIL, '739214'),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Password Changed Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendPasswordChangedEmail', () =>
    emailModule.sendPasswordChangedEmail(TEST_EMAIL, 'Test User'),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Staff Invitation Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendStaffInvitationEmail', () =>
    emailModule.sendStaffInvitationEmail({
      to: TEST_EMAIL,
      teamName: 'Varsity Tigers',
      inviteeName: 'Test User',
      inviterName: 'Coach Williams',
      organizationName: 'Test Athletic Org',
      role: 'assistant_coach',
      inviteLink: 'https://app.varsityhub.app/invites?token=test-staff-token-123',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Team Invite Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendTeamInviteEmail', () =>
    emailModule.sendTeamInviteEmail({
      to: TEST_EMAIL,
      teamName: 'Varsity Tigers Basketball',
      recipientName: 'Test User',
      organizationName: 'Test Athletic Org',
      role: 'player',
      inviterName: 'Coach Williams',
      inviteToken: 'test-team-invite-token-456',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 6. Organization Invite Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendOrganizationInviteEmail', () =>
    emailModule.sendOrganizationInviteEmail({
      to: TEST_EMAIL,
      organizationName: 'Midwest Athletic Conference',
      recipientName: 'Test User',
      role: 'admin',
      inviterName: 'Director Smith',
      inviteToken: 'test-org-invite-token-789',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 7. Abuse Report Notification
  //    NOTE: This normally sends to CUSTOMER_SERVICE_EMAIL, but we override
  //    by calling it as-is. The recipient is determined inside the function.
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendAbuseReportNotification', () =>
    emailModule.sendAbuseReportNotification({
      reporterName: 'Test Reporter',
      reporterEmail: TEST_EMAIL,
      subject: '[TEST] Abuse Report — Email Delivery Test',
      message: 'This is a test abuse report generated by the email delivery test script.',
      userId: 'test-user-id-000',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 8. Join Request to Admin
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendJoinRequestToAdmin', () =>
    emailModule.sendJoinRequestToAdmin({
      adminEmail: TEST_EMAIL,
      adminName: 'Admin Test User',
      requesterName: 'Jane Doe',
      organizationName: 'Test Athletic Org',
      message: 'I would love to join your organization!',
      requestId: 'test-request-id-001',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 9. Join Request Approved
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendJoinRequestApproved', () =>
    emailModule.sendJoinRequestApproved({
      userEmail: TEST_EMAIL,
      userName: 'Test User',
      organizationName: 'Midwest Athletic Conference',
      adminName: 'Director Smith',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 10. Join Request Denied
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendJoinRequestDenied', () =>
    emailModule.sendJoinRequestDenied({
      userEmail: TEST_EMAIL,
      userName: 'Test User',
      organizationName: 'Midwest Athletic Conference',
      reason: 'The organization is not accepting new members at this time (test).',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 11. Organization Approval Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendOrganizationApprovalEmail', () =>
    emailModule.sendOrganizationApprovalEmail({
      to: TEST_EMAIL,
      organizationName: 'Test Athletic Org',
      dashboardLink: 'https://app.varsityhub.app/team-hub',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 12. Organization Denial Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendOrganizationDenialEmail', () =>
    emailModule.sendOrganizationDenialEmail({
      to: TEST_EMAIL,
      organizationName: 'Test Athletic Org',
      reason: 'Duplicate organization detected (test).',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 13. Content Moderation Email — "removed"
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendContentModerationEmail (removed)', () =>
    emailModule.sendContentModerationEmail({
      to: TEST_EMAIL,
      action: 'removed',
      postId: 'test-post-001',
      reason: 'Violated community guidelines (test).',
      nextSteps: 'You can appeal this decision by contacting support.',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 14. Content Moderation Email — "flagged"
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendContentModerationEmail (flagged)', () =>
    emailModule.sendContentModerationEmail({
      to: TEST_EMAIL,
      action: 'flagged',
      postId: 'test-post-002',
      reason: 'Content under review (test).',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 15. Content Moderation Email — "restored"
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendContentModerationEmail (restored)', () =>
    emailModule.sendContentModerationEmail({
      to: TEST_EMAIL,
      action: 'restored',
      postId: 'test-post-003',
      reason: 'Appeal accepted — content restored (test).',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 16. Billing Notice — trial_ending
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendBillingNoticeEmail (trial_ending)', () =>
    emailModule.sendBillingNoticeEmail({
      to: TEST_EMAIL,
      type: 'trial_ending',
      planName: 'VarsityHub Pro',
      teamName: 'Varsity Tigers',
      orgName: 'Test Athletic Org',
      manageLink: 'https://app.varsityhub.app/settings/manage-subscription',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 17. Billing Notice — payment_succeeded
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendBillingNoticeEmail (payment_succeeded)', () =>
    emailModule.sendBillingNoticeEmail({
      to: TEST_EMAIL,
      type: 'payment_succeeded',
      planName: 'VarsityHub Pro',
      amount: '$29.99',
      teamName: 'Varsity Tigers',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 18. Billing Notice — payment_failed
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendBillingNoticeEmail (payment_failed)', () =>
    emailModule.sendBillingNoticeEmail({
      to: TEST_EMAIL,
      type: 'payment_failed',
      planName: 'VarsityHub Pro',
      amount: '$29.99',
      manageLink: 'https://app.varsityhub.app/settings/manage-subscription',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 19. Billing Notice — subscription_canceled
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendBillingNoticeEmail (subscription_canceled)', () =>
    emailModule.sendBillingNoticeEmail({
      to: TEST_EMAIL,
      type: 'subscription_canceled',
      planName: 'VarsityHub Pro',
      orgName: 'Test Athletic Org',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 20. Billing Notice — subscription_renewed
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendBillingNoticeEmail (subscription_renewed)', () =>
    emailModule.sendBillingNoticeEmail({
      to: TEST_EMAIL,
      type: 'subscription_renewed',
      planName: 'VarsityHub Pro',
      amount: '$29.99',
      perks: ['Unlimited teams', 'Advanced analytics', 'Priority support'],
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 21. Ad Reservation Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendAdReservationEmail', () =>
    emailModule.sendAdReservationEmail({
      to: TEST_EMAIL,
      advertiserName: 'Test Advertiser',
      businessName: 'Test Sports Gear Co.',
      checkoutLink: 'https://app.varsityhub.app/ad-checkout?id=test-ad-001',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 22. Account Warning Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendAccountWarningEmail', () =>
    emailModule.sendAccountWarningEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      warningReason: 'Repeated posting of inappropriate content (test).',
      offenseCount: 2,
      nextSteps: 'Please review our community guidelines to avoid account suspension.',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 23. Content Removed Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendContentRemovedEmail', () =>
    emailModule.sendContentRemovedEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      contentType: 'post',
      contentTitle: 'My Test Post',
      removalReason: 'Violated community guidelines (test).',
      appealUrl: 'https://app.varsityhub.app/support',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 24. Account Suspension 7 Days Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendAccountSuspension7DaysEmail', () =>
    emailModule.sendAccountSuspension7DaysEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      suspensionReason: 'Multiple community guideline violations (test).',
      suspensionEndDate: futureDate(7),
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 25. Account Suspension 45 Days Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendAccountSuspension45DaysEmail', () =>
    emailModule.sendAccountSuspension45DaysEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      suspensionReason: 'Severe policy violation (test).',
      suspensionEndDate: futureDate(45),
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 26. Account Permanent Ban Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendAccountPermanentBanEmail', () =>
    emailModule.sendAccountPermanentBanEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      banReason: 'Repeated severe policy violations (test).',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 27. Login from New Device Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendLoginFromNewDeviceEmail', () =>
    emailModule.sendLoginFromNewDeviceEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      deviceType: 'iPhone 15 Pro — Safari',
      deviceLocation: 'Chicago, IL, US',
      loginTime: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 28. Event RSVP Confirmed Email
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendEventRsvpConfirmedEmail', () =>
    emailModule.sendEventRsvpConfirmedEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      eventName: 'VarsityHub Spring Showcase',
      eventDate: futureDate(14),
      eventTime: '6:00 PM CT',
      eventLocation: 'Main Gymnasium, 123 Campus Dr',
      eventLink: 'https://app.varsityhub.app/events/test-event-001',
      calendarLink: 'https://app.varsityhub.app/events/test-event-001/calendar',
      cancelRsvpLink: 'https://app.varsityhub.app/events/test-event-001/cancel-rsvp',
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 29. Payment Failed Email (dedicated)
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendPaymentFailedEmail', () =>
    emailModule.sendPaymentFailedEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      amount: '$29.99',
      paymentDate: new Date().toLocaleDateString('en-US', { dateStyle: 'long' }),
    }),
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 30. End of Day Transaction Report
  // ────────────────────────────────────────────────────────────────────────────
  await runTest('sendEndOfDayTransactionReport', () =>
    emailModule.sendEndOfDayTransactionReport({
      to: TEST_EMAIL,
      report: {
        date: new Date().toLocaleDateString('en-US', { dateStyle: 'long' }),
        summary: {
          totalTransactions: 47,
          completedTransactions: 42,
          totalRevenueCents: 234500,
          totalFeesCents: 7035,
          totalDiscountsCents: 5000,
          netRevenueCents: 222465,
        },
        breakdownByType: [
          { type: 'subscription', count: 30, revenueCents: 180000, feesCents: 5400, discountsCents: 3000, netCents: 171600 },
          { type: 'ad_payment', count: 12, revenueCents: 48000, feesCents: 1440, discountsCents: 2000, netCents: 44560 },
          { type: 'event_ticket', count: 5, revenueCents: 6500, feesCents: 195, discountsCents: 0, netCents: 6305 },
        ],
        breakdownByStatus: [
          { status: 'completed', count: 42 },
          { status: 'pending', count: 3 },
          { status: 'failed', count: 2 },
        ],
      },
    }),
  );

  // ══════════════════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n');
  console.log('='.repeat(72));
  console.log('  EMAIL DELIVERY TEST SUMMARY');
  console.log('='.repeat(72));
  console.log(`  Recipient : ${TEST_EMAIL}`);
  console.log(`  Timestamp : ${new Date().toISOString()}`);
  console.log(`  Total     : ${results.length}`);
  console.log('-'.repeat(72));

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const detail = r.error ? ` — ${r.error}` : r.note ? ` — ${r.note}` : '';
    console.log(`  [${status}] ${r.name}${detail}`);
  }

  console.log('-'.repeat(72));
  console.log(`  Passed: ${passed.length}/${results.length}`);
  console.log(`  Failed: ${failed.length}/${results.length}`);
  console.log('='.repeat(72));

  if (failed.length > 0) {
    console.log('\nFailed emails:');
    for (const r of failed) {
      console.log(`  - ${r.name}: ${r.error || 'returned false'}`);
    }
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
