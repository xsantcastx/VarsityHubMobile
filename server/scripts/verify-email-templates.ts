#!/usr/bin/env ts-node
/**
 * Email Template Verification Script
 * 
 * Verifies that all SendGrid email templates are properly configured
 * and can send test emails end-to-end.
 * 
 * Usage:
 *   ts-node server/scripts/verify-email-templates.ts
 *   ts-node server/scripts/verify-email-templates.ts --test-to=emilmancero@gmail.com
 */

import '../src/lib/load-env.ts';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountRecoveryEmail,
  sendLoginFromNewDeviceEmail,
  sendAccountWarningEmail,
  sendContentRemovedEmail,
  sendAccountSuspension7DaysEmail,
  sendAccountSuspension45DaysEmail,
  sendAccountPermanentBanEmail,
  sendEventSubmissionReceivedEmail,
  sendEventApprovedEmail,
  sendEventDeniedEmail,
  sendEventReminderEmail,
  sendEventUpdatedEmail,
  sendEventCanceledEmail,
  sendEventRsvpConfirmedEmail,
  sendTeamInviteEmail,
  sendOrganizationInviteEmail,
  sendRosterThresholdAlertEmail,
  sendReportResolutionEmail,
  sendPaymentFailedEmail,
  sendSubscriptionExpiringEmail,
} from '../src/lib/email.js';

const TEST_EMAIL = process.argv.find(arg => arg.startsWith('--test-to='))?.split('=')[1] || 'emilmancero@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@varsityhub.app';

interface TestResult {
  name: string;
  templateId?: string;
  success: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function testEmail(name: string, templateId: string | undefined, fn: () => Promise<boolean>): Promise<void> {
  console.log(`\n🧪 Testing: ${name}${templateId ? ` (Template: ${templateId})` : ' (No template ID)'}`);
  
  if (!templateId) {
    results.push({ name, templateId, success: false, error: 'Template ID not configured' });
    console.log('   ⚠️  SKIPPED: Template ID not configured');
    return;
  }
  
  try {
    const success = await fn();
    if (success) {
      results.push({ name, templateId, success: true });
      console.log(`   ✅ SUCCESS: Email sent to ${TEST_EMAIL}`);
    } else {
      results.push({ name, templateId, success: false, error: 'Function returned false' });
      console.log(`   ❌ FAILED: Function returned false`);
    }
  } catch (error: any) {
    results.push({ name, templateId, success: false, error: error?.message || 'Unknown error' });
    console.log(`   ❌ FAILED: ${error?.message || 'Unknown error'}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📧 Email Template Verification Script');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📬 Test recipient: ${TEST_EMAIL}`);
  console.log(`📤 From: ${FROM_EMAIL}`);
  console.log(`\n🔍 Verifying all email templates...\n`);

  // Auth & Security
  await testEmail(
    'Verification Email',
    process.env.SENDGRID_VERIFICATION_TEMPLATE_ID,
    () => sendVerificationEmail(TEST_EMAIL, '123456', 'Test User')
  );

  await testEmail(
    'Password Reset Email',
    process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID,
    () => sendPasswordResetEmail(TEST_EMAIL, '654321')
  );

  await testEmail(
    'Password Changed Email',
    process.env.SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID,
    () => sendPasswordChangedEmail(TEST_EMAIL, 'Test User')
  );

  await testEmail(
    'Account Recovery Email',
    process.env.SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID,
    () => sendAccountRecoveryEmail(TEST_EMAIL, 'Test User', new Date().toLocaleString())
  );

  await testEmail(
    'Login from New Device Email',
    process.env.SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID,
    () => sendLoginFromNewDeviceEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      deviceType: 'iPhone 14 Pro',
      deviceLocation: 'San Francisco, CA',
      loginTime: new Date().toLocaleString(),
    })
  );

  // Moderation & Trust
  await testEmail(
    'Report Resolved Email',
    process.env.SENDGRID_REPORT_RESOLVED_TEMPLATE_ID,
    () => sendReportResolutionEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      reportId: 'test-report-123',
      reportType: 'spam',
      resolutionStatus: 'resolved',
      resolutionReason: 'Content was removed',
    })
  );

  await testEmail(
    'Report Dismissed Email',
    process.env.SENDGRID_REPORT_DISMISSED_TEMPLATE_ID,
    () => sendReportResolutionEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      reportId: 'test-report-456',
      reportType: 'harassment',
      resolutionStatus: 'dismissed',
      resolutionReason: 'No violation found',
    })
  );

  await testEmail(
    'Account Warning Email',
    process.env.SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID,
    () => sendAccountWarningEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      warningReason: 'Violation of community guidelines',
      offenseCount: 1,
    })
  );

  await testEmail(
    'Content Removed Email',
    process.env.SENDGRID_CONTENT_REMOVED_TEMPLATE_ID,
    () => sendContentRemovedEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      contentType: 'post',
      contentTitle: 'Test Post',
      removalReason: 'Violated community guidelines',
    })
  );

  // Suspensions
  const futureDate7 = new Date();
  futureDate7.setDate(futureDate7.getDate() + 7);
  
  await testEmail(
    'Account Suspension (7 days) Email',
    process.env.SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID,
    () => sendAccountSuspension7DaysEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      suspensionReason: 'Repeated violations',
      suspensionEndDate: futureDate7.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    })
  );

  const futureDate45 = new Date();
  futureDate45.setDate(futureDate45.getDate() + 45);
  
  await testEmail(
    'Account Suspension (45 days) Email',
    process.env.SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID,
    () => sendAccountSuspension45DaysEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      suspensionReason: 'Severe violations',
      suspensionEndDate: futureDate45.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    })
  );

  await testEmail(
    'Account Permanent Ban Email',
    process.env.SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID,
    () => sendAccountPermanentBanEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      banReason: 'Severe and repeated violations',
    })
  );

  // Events
  await testEmail(
    'Event Submission Received Email',
    process.env.SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID,
    () => sendEventSubmissionReceivedEmail({
      to: TEST_EMAIL,
      coachName: 'Test Coach',
      eventName: 'Championship Game',
      eventDate: '2025-02-15',
      eventTime: '7:00 PM',
      eventLocation: 'Madison Square Garden, New York, NY',
      submissionDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      statusLink: 'https://varsityhub.app/events/my-events',
    })
  );

  await testEmail(
    'Event Approved Email',
    process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID,
    () => sendEventApprovedEmail({
      to: TEST_EMAIL,
      coachName: 'Test Coach',
      eventName: 'Championship Game',
      eventDate: '2025-02-15',
      eventTime: '7:00 PM',
      eventLocation: 'Madison Square Garden, New York, NY',
      eventId: 'test-event-123',
      eventLink: 'https://varsityhub.app/event-detail?id=test-event-123',
      manageLink: 'https://varsityhub.app/events',
    })
  );

  await testEmail(
    'Event Denied Email',
    process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID,
    () => sendEventDeniedEmail({
      to: TEST_EMAIL,
      coachName: 'Test Coach',
      eventName: 'Test Event',
      denialReason: 'Event conflicts with existing schedule',
      resubmitLink: 'https://varsityhub.app/create-fan-event',
      supportLink: 'mailto:support@varsityhub.app',
    })
  );

  await testEmail(
    'Event Reminder Email',
    process.env.SENDGRID_EVENT_REMINDER_TEMPLATE_ID,
    () => sendEventReminderEmail({
      to: TEST_EMAIL,
      recipientName: 'Test User',
      eventName: 'Championship Game',
      eventDate: '2025-02-15',
      eventTime: '7:00 PM',
      eventLocation: 'Madison Square Garden, New York, NY',
      eventId: 'test-event-123',
      checkInLink: 'https://varsityhub.app/event-detail?id=test-event-123',
      calendarLink: 'https://varsityhub.app/event-detail?id=test-event-123',
      directionsLink: 'https://varsityhub.app/event-detail?id=test-event-123',
      preferencesLink: 'https://varsityhub.app/settings',
    })
  );

  await testEmail(
    'Event Updated Email',
    process.env.SENDGRID_EVENT_UPDATED_TEMPLATE_ID,
    () => sendEventUpdatedEmail({
      to: TEST_EMAIL,
      recipientName: 'Test User',
      eventName: 'Championship Game',
      eventDate: '2025-02-15',
      eventId: 'test-event-123',
      eventDetailLink: 'https://varsityhub.app/event-detail?id=test-event-123',
      changeSummary: 'Event time changed from 7:00 PM to 8:00 PM',
    })
  );

  await testEmail(
    'Event Canceled Email',
    process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID,
    () => sendEventCanceledEmail({
      to: TEST_EMAIL,
      recipientName: 'Test User',
      eventName: 'Championship Game',
      eventDate: '2025-02-15',
      cancelReason: 'Weather conditions',
      upcomingEventsLink: 'https://varsityhub.app/events',
      contactOrganizerLink: 'mailto:support@varsityhub.app',
    })
  );

  await testEmail(
    'Event RSVP Confirmed Email',
    process.env.SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID,
    () => sendEventRsvpConfirmedEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      eventName: 'Championship Game',
      eventDate: '2025-02-15',
      eventTime: '7:00 PM',
      eventLocation: 'Madison Square Garden, New York, NY',
      eventLink: 'https://varsityhub.app/event-detail?id=test-event-123',
    })
  );

  // Team & Organization
  await testEmail(
    'Team Invite Email',
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID,
    () => sendTeamInviteEmail({
      to: TEST_EMAIL,
      teamName: 'Dallas Lady Tigers',
      recipientName: 'Test Player',
      organizationName: 'Texas Elite Sports',
      role: 'player',
      inviterName: 'Coach Smith',
    })
  );

  await testEmail(
    'Organization Invite Email',
    process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID,
    () => sendOrganizationInviteEmail({
      to: TEST_EMAIL,
      organizationName: 'Texas Elite Sports',
      role: 'coach',
      inviterName: 'Director Johnson',
    })
  );

  await testEmail(
    'Roster Threshold Alert Email',
    process.env.SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID,
    () => sendRosterThresholdAlertEmail({
      to: TEST_EMAIL,
      coachName: 'Test Coach',
      teamName: 'Dallas Lady Tigers',
      rosterCount: 25,
      thresholdCost: 5.00,
      manageBillingUrl: 'https://varsityhub.app/settings/manage-subscription',
    })
  );

  // Billing
  await testEmail(
    'Payment Failed Email',
    process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID,
    () => sendPaymentFailedEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      amount: '$49.99',
      paymentDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      retryUrl: 'https://varsityhub.app/settings/manage-subscription',
    })
  );

  await testEmail(
    'Subscription Expiring Email',
    process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID,
    () => sendSubscriptionExpiringEmail({
      to: TEST_EMAIL,
      userName: 'Test User',
      planName: 'Veteran Plan',
      expiresDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      daysRemaining: 7,
      renewalPrice: '$1.00/month',
      renewLink: 'https://varsityhub.app/settings/manage-subscription',
    })
  );

  // Print Summary
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 Verification Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`   ✓ ${r.name}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`   ✗ ${r.name}${r.error ? ` - ${r.error}` : ''}`);
      if (r.templateId) {
        console.log(`     Template ID: ${r.templateId}`);
      }
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  
  // Check for missing template IDs
  const requiredTemplates = [
    'SENDGRID_VERIFICATION_TEMPLATE_ID',
    'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
    'SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID',
    'SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID',
    'SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID',
    'SENDGRID_REPORT_RESOLVED_TEMPLATE_ID',
    'SENDGRID_REPORT_DISMISSED_TEMPLATE_ID',
    'SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID',
    'SENDGRID_CONTENT_REMOVED_TEMPLATE_ID',
    'SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID',
    'SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID',
    'SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID',
    'SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID',
    'SENDGRID_EVENT_APPROVED_TEMPLATE_ID',
    'SENDGRID_EVENT_DENIED_TEMPLATE_ID',
    'SENDGRID_EVENT_REMINDER_TEMPLATE_ID',
    'SENDGRID_EVENT_UPDATED_TEMPLATE_ID',
    'SENDGRID_EVENT_CANCELED_TEMPLATE_ID',
    'SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID',
    'SENDGRID_TEAM_INVITE_TEMPLATE_ID',
    'SENDGRID_ORG_INVITE_TEMPLATE_ID',
    'SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID',
    'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID',
    'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID',
  ];

  const missingTemplates = requiredTemplates.filter(key => !process.env[key]);
  
  if (missingTemplates.length > 0) {
    console.log('\n⚠️  Missing Template IDs:');
    missingTemplates.forEach(key => {
      console.log(`   - ${key}`);
    });
  }

  console.log('\n');
  
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
