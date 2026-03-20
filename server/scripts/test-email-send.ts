/**
 * Full Email System Test
 * Sends one test email for each major email type to a single address.
 * Usage:  SENDGRID_API_KEY=SG.xxx npx tsx scripts/test-email-send.ts
 *
 * Requires SENDGRID_API_KEY to be set. Template IDs are loaded from the
 * existing test-all-emails.sh values if not already in env.
 */

// ── Inject template IDs if not already set ──────────────────────────
const TEMPLATE_DEFAULTS: Record<string, string> = {
  SENDGRID_VERIFICATION_TEMPLATE_ID: 'd-584a4a9fe16449078e2cbc6d9d7be0d0',
  SENDGRID_PASSWORD_RESET_TEMPLATE_ID: 'd-97a704ec6a35434195364e0ed9dfaf21',
  SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID: 'd-6f11ea835053413296e159c91204b658',
  SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID: 'd-36ff36687ae8433ba49ae88e533904d6',
  SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID: 'd-5fe2c46068b04b928c941df25e1eb947',
  SENDGRID_REPORT_RESOLVED_TEMPLATE_ID: 'd-7bee5cf412b14f18988596796d86083b',
  SENDGRID_REPORT_DISMISSED_TEMPLATE_ID: 'd-9211e4a8ef2b465eae90dbb1dbe6ce2e',
  SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID: 'd-1548d11143ce47b28c9832cfbb0880d8',
  SENDGRID_CONTENT_REMOVED_TEMPLATE_ID: 'd-b27c753cafcb425aa7a7c9f8b577f844',
  SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID: 'd-d357a6414fa1437da02ccd7c6724711c',
  SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID: 'd-0941019230d9459b81ff602d937f7aa04',
  SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID: 'd-40f388da110d440ba32bf34c282fd2c0',
  SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID: 'd-5a9d8126df45488faccee9a194d60c30',
  SENDGRID_EVENT_APPROVED_TEMPLATE_ID: 'd-e76de706704646938e05a28e4c1a20d3',
  SENDGRID_EVENT_DENIED_TEMPLATE_ID: 'd-503431dd78274a628f43a1e6c1592b14',
  SENDGRID_EVENT_REMINDER_TEMPLATE_ID: 'd-2822ef2015da4036b477c958e7ab9d1b',
  SENDGRID_EVENT_UPDATED_TEMPLATE_ID: 'd-3c7d54711df4484e9ce1473478a7cf3e',
  SENDGRID_EVENT_CANCELED_TEMPLATE_ID: 'd-1df595aec25a438e8e63befc17e09f13',
  SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID: 'd-511e46f4646f974f18a8f33c12564de14b',
  SENDGRID_TEAM_INVITE_TEMPLATE_ID: 'd-14788def39174bb66bf186716cce166fa',
  SENDGRID_ORG_INVITE_TEMPLATE_ID: 'd-bc3bd0a683c843bf932721dafce626a3',
  SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID: 'd-bf680d9a1f704324970918978710d1a1',
  SENDGRID_PAYMENT_FAILED_TEMPLATE_ID: 'd-4f9bb915b560468ea5c5899b09005b56',
  SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID: 'd-9e31f68b55464074b530b889eb3bdfd8',
};

for (const [k, v] of Object.entries(TEMPLATE_DEFAULTS)) {
  if (!process.env[k]) process.env[k] = v;
}

// Ensure sender is set
if (!process.env.EMAIL_FROM && !process.env.FROM_EMAIL) {
  process.env.FROM_EMAIL = 'noreply@varsityhub.app';
}
if (!process.env.CUSTOMER_SERVICE_EMAIL) {
  process.env.CUSTOMER_SERVICE_EMAIL = 'support@varsityhub.app';
}

// ── Imports (after env is set) ──────────────────────────────────────
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountRecoveryEmail,
  sendLoginFromNewDeviceEmail,
  sendTeamInviteEmail,
  sendOrganizationInviteEmail,
  sendJoinRequestApproved,
  sendJoinRequestDenied,
  sendJoinRequestToAdmin,
  sendEventApprovedEmail,
  sendEventDeniedEmail,
  sendEventReminderEmail,
  sendEventSubmissionReceivedEmail,
  sendEventCanceledEmail,
  sendEventUpdatedEmail,
  sendEventRsvpConfirmedEmail,
  sendBillingNoticeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionExpiringEmail,
  sendAccountWarningEmail,
  sendContentRemovedEmail,
  sendAccountSuspension7DaysEmail,
  sendReportResolutionEmail,
  sendAdGoesLiveEmail,
  sendAdReservationEmail,
  sendAdPaymentConfirmedEmail,
} from '../src/lib/email.js';

// ── Config ──────────────────────────────────────────────────────────
const TO = 'customerservice@varsityhub.app';

if (!process.env.SENDGRID_API_KEY) {
  console.error('❌  SENDGRID_API_KEY is required. Export it before running.');
  process.exit(1);
}

console.log(`\n📧  Full Email System Test → ${TO}\n`);

type TestCase = {
  name: string;
  category: string;
  method: 'sendgrid_template' | 'generic_fallback' | 'inline_html' | 'direct';
  fn: () => Promise<boolean>;
};

const tests: TestCase[] = [
  // ── Auth & Security ─────────────────────────────────────────────
  {
    name: 'Verification Email',
    category: 'Auth',
    method: 'sendgrid_template',
    fn: () => sendVerificationEmail(TO, 'TEST-123456', 'Test User'),
  },
  {
    name: 'Password Reset',
    category: 'Auth',
    method: 'sendgrid_template',
    fn: () => sendPasswordResetEmail(TO, 'RESET-789012'),
  },
  {
    name: 'Password Changed',
    category: 'Auth',
    method: 'sendgrid_template',
    fn: () => sendPasswordChangedEmail(TO, 'Test User'),
  },
  {
    name: 'Account Recovery',
    category: 'Auth',
    method: 'sendgrid_template',
    fn: () => sendAccountRecoveryEmail(TO, 'Test User', new Date().toLocaleString()),
  },
  {
    name: 'Login from New Device',
    category: 'Auth',
    method: 'sendgrid_template',
    fn: () => sendLoginFromNewDeviceEmail({
      to: TO,
      userName: 'Test User',
      deviceInfo: 'iPhone 15 Pro — Safari',
      loginTime: new Date().toLocaleString(),
      ipAddress: '192.168.1.1',
      location: 'Stamford, CT',
    }),
  },

  // ── Team & Organization ─────────────────────────────────────────
  {
    name: 'Team Invite',
    category: 'Team',
    method: 'sendgrid_template',
    fn: () => sendTeamInviteEmail({
      to: TO,
      teamName: 'Varsity Eagles',
      recipientName: 'Test Player',
      role: 'athlete',
      inviterName: 'Coach Smith',
      inviteToken: 'test-token-abc',
    }),
  },
  {
    name: 'Organization Invite',
    category: 'Team',
    method: 'sendgrid_template',
    fn: () => sendOrganizationInviteEmail({
      to: TO,
      organizationName: 'Westhill HS Athletics',
      recipientName: 'Test Admin',
      role: 'org_admin',
      inviterName: 'Head Coach',
    }),
  },
  {
    name: 'Join Request → Admin',
    category: 'Team',
    method: 'sendgrid_template',
    fn: () => sendJoinRequestToAdmin({
      adminEmail: TO,
      userName: 'New Player',
      userEmail: 'newplayer@test.com',
      organizationName: 'Westhill HS Athletics',
    }),
  },
  {
    name: 'Join Request Approved',
    category: 'Team',
    method: 'sendgrid_template',
    fn: () => sendJoinRequestApproved({
      userEmail: TO,
      userName: 'New Player',
      organizationName: 'Westhill HS Athletics',
    }),
  },
  {
    name: 'Join Request Denied',
    category: 'Team',
    method: 'sendgrid_template',
    fn: () => sendJoinRequestDenied({
      userEmail: TO,
      userName: 'New Player',
      organizationName: 'Westhill HS Athletics',
      reason: 'Not currently accepting new members',
    }),
  },

  // ── Events ──────────────────────────────────────────────────────
  {
    name: 'Event Submission Received',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventSubmissionReceivedEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      eventDate: 'March 15, 2026',
      eventLocation: 'Veterans Park, Stamford CT',
      submitterName: 'Coach Smith',
    }),
  },
  {
    name: 'Event Approved',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventApprovedEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      eventDate: 'March 15, 2026',
      eventLocation: 'Veterans Park, Stamford CT',
    }),
  },
  {
    name: 'Event Denied',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventDeniedEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      reason: 'Venue not available on selected date',
    }),
  },
  {
    name: 'Event Reminder',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventReminderEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      eventDate: 'March 15, 2026',
      eventTime: '10:00 AM',
      eventLocation: 'Veterans Park, Stamford CT',
    }),
  },
  {
    name: 'Event Updated',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventUpdatedEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      changes: 'New time: 11:00 AM',
    }),
  },
  {
    name: 'Event Canceled',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventCanceledEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      reason: 'Weather — rescheduling to next week',
    }),
  },
  {
    name: 'Event RSVP Confirmed',
    category: 'Events',
    method: 'sendgrid_template',
    fn: () => sendEventRsvpConfirmedEmail({
      to: TO,
      eventName: 'Spring Lacrosse Tournament',
      eventDate: 'March 15, 2026',
      eventTime: '10:00 AM',
      eventLocation: 'Veterans Park, Stamford CT',
      attendeeName: 'Test User',
    }),
  },

  // ── Billing ─────────────────────────────────────────────────────
  {
    name: 'Billing Notice (payment_succeeded)',
    category: 'Billing',
    method: 'sendgrid_template',
    fn: () => sendBillingNoticeEmail({
      to: TO,
      type: 'payment_succeeded',
      planName: 'Veteran Plan',
      amount: '$9.99',
      perks: ['Unlimited teams', 'Priority support', 'Analytics'],
    }),
  },
  {
    name: 'Payment Failed',
    category: 'Billing',
    method: 'sendgrid_template',
    fn: () => sendPaymentFailedEmail({
      to: TO,
      userName: 'Test User',
      planName: 'Veteran Plan',
      amount: '$9.99',
      failureReason: 'Card declined',
      retryDate: 'March 10, 2026',
    }),
  },
  {
    name: 'Subscription Expiring',
    category: 'Billing',
    method: 'sendgrid_template',
    fn: () => sendSubscriptionExpiringEmail({
      to: TO,
      userName: 'Test User',
      planName: 'Veteran Plan',
      expiresDate: 'March 30, 2026',
      daysRemaining: 27,
      renewalPrice: '$9.99',
    }),
  },

  // ── Moderation ──────────────────────────────────────────────────
  {
    name: 'Account Warning',
    category: 'Moderation',
    method: 'sendgrid_template',
    fn: () => sendAccountWarningEmail({
      to: TO,
      userName: 'Test User',
      reason: 'Inappropriate content in post',
      warningLevel: 'first',
    }),
  },
  {
    name: 'Content Removed',
    category: 'Moderation',
    method: 'sendgrid_template',
    fn: () => sendContentRemovedEmail({
      to: TO,
      userName: 'Test User',
      contentType: 'post',
      reason: 'Violates community guidelines',
    }),
  },
  {
    name: 'Account Suspension (7 Days)',
    category: 'Moderation',
    method: 'sendgrid_template',
    fn: () => sendAccountSuspension7DaysEmail({
      to: TO,
      userName: 'Test User',
      reason: 'Repeated violations',
      suspensionEnd: 'March 10, 2026',
    }),
  },
  {
    name: 'Report Resolution',
    category: 'Moderation',
    method: 'sendgrid_template',
    fn: () => sendReportResolutionEmail({
      to: TO,
      userName: 'Test User',
      reportType: 'post',
      resolution: 'Content was removed',
      originalContent: 'The flagged post...',
    }),
  },

  // ── Ad-Specific ─────────────────────────────────────────────────
  {
    name: 'Ad Goes Live',
    category: 'Ads',
    method: 'generic_fallback',
    fn: () => sendAdGoesLiveEmail({
      to: TO,
      adTitle: 'Test Ad Campaign',
      businessName: 'Joe\'s Pizza',
      targetZip: '06902',
    }),
  },
  {
    name: 'Ad Reservation (pre-payment)',
    category: 'Ads',
    method: 'generic_fallback',
    fn: () => sendAdReservationEmail({
      to: TO,
      advertiserName: 'Test Advertiser',
      businessName: 'Joe\'s Pizza',
    }),
  },
  {
    name: 'Ad Payment Confirmation (dynamic template)',
    category: 'Ads',
    method: 'template',
    fn: () => sendAdPaymentConfirmedEmail({
      to: TO,
      businessName: 'Joe\'s Pizza',
      zipCode: '90210',
      amount: '$5.36',
      hoursLabel: '48 hrs (2 days)',
      dates: ['Sat, Mar 15, 2026', 'Sun, Mar 16, 2026'],
      adId: 'test-ad-123',
    }),
  },
];

// ── Run Tests ───────────────────────────────────────────────────────
async function run() {
  const results: Array<{ name: string; category: string; method: string; success: boolean; error?: string }> = [];

  for (const test of tests) {
    process.stdout.write(`  ⏳ ${test.name}...`);
    try {
      const ok = await test.fn();
      results.push({ name: test.name, category: test.category, method: test.method, success: ok });
      console.log(ok ? ' ✅' : ' ⚠️  returned false (may not be configured)');
    } catch (err: any) {
      results.push({ name: test.name, category: test.category, method: test.method, success: false, error: err?.message });
      console.log(` ❌  ${err?.message?.slice(0, 80)}`);
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  // ── Summary Report ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  EMAIL SYSTEM TEST REPORT');
  console.log('═'.repeat(70));

  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    console.log(`\n  📂 ${cat}`);
    for (const r of results.filter((r) => r.category === cat)) {
      const icon = r.success ? '✅' : '❌';
      const methodTag = `[${r.method}]`;
      console.log(`     ${icon} ${r.name.padEnd(35)} ${methodTag.padEnd(22)} ${r.error || ''}`);
    }
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`\n  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  // Show which emails use templates vs fallback
  console.log('\n' + '─'.repeat(70));
  console.log('  METHOD BREAKDOWN:');
  console.log('─'.repeat(70));
  const byMethod: Record<string, string[]> = {};
  for (const r of results) {
    (byMethod[r.method] ??= []).push(r.name);
  }
  for (const [method, names] of Object.entries(byMethod)) {
    console.log(`\n  ${method}:`);
    for (const n of names) console.log(`    • ${n}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  📬 All emails sent to: ${TO}`);
  console.log('  Check inbox and SendGrid Activity Feed for delivery confirmation.');
  console.log('═'.repeat(70) + '\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
