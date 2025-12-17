#!/usr/bin/env npx tsx
/**
 * Comprehensive Email Test Suite
 * Tests all 40+ email templates with realistic test data
 * 
 * Usage: npx tsx scripts/test-all-emails.ts
 * 
 * Environment: Reads from .env and server/.env
 * Output: Console output + test-results.json
 */

import { config as loadEnv } from 'dotenv';
import 'dotenv/config';

// Load environment variables
loadEnv({ path: '.env', override: true });
loadEnv({ path: 'server/.env', override: true });

// Dynamic imports to avoid module issues
async function runTests() {
  const {
    // Auth emails
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendPasswordChangedEmail,
    sendAccountRecoveryEmail,
    sendLoginFromNewDeviceEmail,
    
    // Moderation emails
    sendReportResolutionEmail,
    sendReportDismissedEmail,
    sendAccountWarningEmail,
    sendContentRemovedEmail,
    sendAccountSuspensionEmail,
    sendAccountPermanentBanEmail,
    
    // Event emails
    sendEventSubmissionReceivedEmail,
    sendEventApprovedEmail,
    sendEventDeniedEmail,
    sendEventReminderEmail,
    sendEventUpdatedEmail,
    sendEventCanceledEmail,
    sendEventRsvpConfirmedEmail,
    
    // Team & Organization emails
    sendOrganizationInvitationEmail,
    sendTeamInvitationEmail,
    sendAthleteInvitationEmail,
    sendRoleAssignmentEmail,
    sendRosterThresholdEmail,
    sendInvitationDeclinedEmail,
    sendTeamRosterUpdateEmail,
    sendStaffMemberJoinedEmail,
    sendUserConfirmationEmail,
    
    // Billing emails
    sendPaymentFailedEmail,
    sendSubscriptionExpiringEmail,
  } = await import('../src/lib/email.js');

  const testEmail = 'emilmancero@gmail.com';
  const now = new Date();
  const todayFormatted = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
  const timeFormatted = now.toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
  const tomorrowFormatted = new Date(now.getTime() + 86400000).toLocaleDateString('en-US', { timeZone: 'America/Chicago' });

  const results: Record<string, { success: boolean; message: string }> = {};
  let passed = 0;
  let failed = 0;

  // Test utilities
  const test = async (name: string, fn: () => Promise<boolean>) => {
    try {
      const result = await fn();
      results[name] = { success: result, message: result ? '✅ SENT' : '❌ FAILED' };
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      results[name] = { success: false, message: `❌ ERROR: ${error instanceof Error ? error.message : String(error)}` };
      console.log(`❌ ${name} - ERROR: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  };

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          📧 COMPREHENSIVE EMAIL TEMPLATE TEST SUITE             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🔑 AUTH & SECURITY EMAILS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  await test('Verification Email', () =>
    sendVerificationEmail(testEmail, 'verify_code_123', 'Emil')
  );

  await test('Password Reset Email', () =>
    sendPasswordResetEmail(testEmail, 'reset_code_456', 'Emil')
  );

  await test('Password Changed Email', () =>
    sendPasswordChangedEmail(testEmail, 'Emil', todayFormatted)
  );

  await test('Account Recovery Email', () =>
    sendAccountRecoveryEmail(testEmail, 'Emil', 'recovery_code_789')
  );

  await test('Login from New Device Email', () =>
    sendLoginFromNewDeviceEmail(testEmail, 'Emil', 'iPhone 15', 'Dallas, TX', todayFormatted)
  );

  console.log('\n📋 MODERATION & TRUST EMAILS');
  console.log('─────────────────────────────────────────────────────────────────');

  await test('Report Resolved - Resolved', () =>
    sendReportResolutionEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_001',
      reportType: 'Abuse',
      resolutionStatus: 'resolved',
      resolutionReason: 'Issue has been addressed',
      appealUrl: 'https://varsityhub.app/appeal',
      submitDate: todayFormatted,
      resolutionDate: todayFormatted,
    })
  );

  await test('Report Dismissed Email', () =>
    sendReportDismissedEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_002',
      reportType: 'Spam',
      dismissalReason: 'No violation found',
      appealUrl: 'https://varsityhub.app/appeal',
    })
  );

  await test('Account Warning Email', () =>
    sendAccountWarningEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_003',
      violationType: 'Harassment',
      warningReason: 'Please follow community guidelines',
      appealUrl: 'https://varsityhub.app/appeal',
    })
  );

  await test('Content Removed Email', () =>
    sendContentRemovedEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_004',
      contentType: 'Post',
      removalReason: 'Hate speech',
      contentPreview: 'Your recent post was removed',
      appealUrl: 'https://varsityhub.app/appeal',
    })
  );

  await test('Account Suspension (7 Days)', () =>
    sendAccountSuspensionEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_005',
      violationType: 'Abusive behavior',
      suspensionDays: 7,
      suspensionDate: todayFormatted,
      reinstatementDate: tomorrowFormatted,
      suspensionReason: 'Repeated policy violations',
      appealUrl: 'https://varsityhub.app/appeal',
    })
  );

  await test('Account Suspension (45 Days)', () =>
    sendAccountSuspensionEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_006',
      violationType: 'Fraud',
      suspensionDays: 45,
      suspensionDate: todayFormatted,
      reinstatementDate: tomorrowFormatted,
      suspensionReason: 'Severe violation of terms',
      appealUrl: 'https://varsityhub.app/appeal',
    })
  );

  await test('Account Permanent Ban', () =>
    sendAccountPermanentBanEmail({
      to: testEmail,
      userName: 'Emil',
      reportId: 'rep_007',
      violationType: 'Severe harassment',
      banReason: 'Zero tolerance violation',
      appealUrl: 'https://varsityhub.app/appeal',
    })
  );

  console.log('\n🎪 EVENT MANAGEMENT EMAILS');
  console.log('─────────────────────────────────────────────────────────────────');

  await test('Event Submission Received', () =>
    sendEventSubmissionReceivedEmail({
      to: testEmail,
      coachName: 'Coach Smith',
      eventName: 'Elite Showcase 2025',
      eventDate: 'Friday, January 24, 2025',
      eventTime: '6:00 PM',
      eventLocation: 'Dallas, TX',
      eventDescription: 'Regional invitational tournament',
      reviewTimeframe: '24-48 hours',
      supportEmail: 'support@varsityhub.app',
      dashboardLink: 'https://varsityhub.app/events/dashboard',
    })
  );

  await test('Event Approved', () =>
    sendEventApprovedEmail({
      to: testEmail,
      coachName: 'Coach Smith',
      eventName: 'Elite Showcase 2025',
      eventDate: 'Friday, January 24, 2025',
      eventTime: '6:00 PM',
      eventLocation: 'Dallas, TX',
      eventDetailLink: 'https://varsityhub.app/events/123',
    })
  );

  await test('Event Denied', () =>
    sendEventDeniedEmail({
      to: testEmail,
      coachName: 'Coach Smith',
      eventName: 'Elite Showcase 2025',
      eventDate: 'Friday, January 24, 2025',
      eventTime: '6:00 PM',
      eventLocation: 'Dallas, TX',
      reason: 'Missing required documentation',
      resubmitLink: 'https://varsityhub.app/events/resubmit/123',
    })
  );

  await test('Event Reminder', () =>
    sendEventReminderEmail({
      to: testEmail,
      userName: 'Emil',
      eventName: 'Elite Showcase 2025',
      eventDate: 'Friday, January 24, 2025',
      eventTime: '6:00 PM',
      eventLocation: 'Dallas, TX',
      eventDetailLink: 'https://varsityhub.app/events/123',
    })
  );

  await test('Event Updated', () =>
    sendEventUpdatedEmail({
      to: testEmail,
      userName: 'Emil',
      eventName: 'Elite Showcase 2025',
      updatedFields: 'Location and time',
      eventDate: 'Saturday, January 25, 2025',
      eventTime: '7:00 PM',
      eventLocation: 'Austin, TX',
      eventDetailLink: 'https://varsityhub.app/events/123',
    })
  );

  await test('Event Canceled', () =>
    sendEventCanceledEmail({
      to: testEmail,
      userName: 'Emil',
      eventName: 'Elite Showcase 2025',
      eventDate: 'Friday, January 24, 2025',
      eventTime: '6:00 PM',
      eventLocation: 'Dallas, TX',
      reason: 'Weather conditions',
      eventDetailLink: 'https://varsityhub.app/events/123',
    })
  );

  await test('Event RSVP Confirmed', () =>
    sendEventRsvpConfirmedEmail({
      to: testEmail,
      userName: 'Emil',
      eventName: 'Elite Showcase 2025',
      eventDate: 'Friday, January 24, 2025',
      eventTime: '6:00 PM',
      eventLocation: 'Dallas, TX',
      rsvpConfirmedAt: `${todayFormatted} at ${timeFormatted}`,
      organizationName: 'VarsityHub',
      eventDetailLink: 'https://varsityhub.app/events/123',
      calendarLink: 'https://varsityhub.app/calendar/add/123',
      cancelRsvpLink: 'https://varsityhub.app/rsvp/cancel/123',
    })
  );

  console.log('\n👥 TEAM & ORGANIZATION EMAILS');
  console.log('─────────────────────────────────────────────────────────────────');

  await test('Organization Invitation', () =>
    sendOrganizationInvitationEmail({
      to: testEmail,
      organizationName: 'Texas Elite Sports',
      inviterName: 'Director Johnson',
      role: 'Coach',
      inviteLink: 'https://varsityhub.app/org/invite/abc123',
    })
  );

  await test('Team Invitation', () =>
    sendTeamInvitationEmail({
      to: testEmail,
      recipientName: 'Emil',
      teamName: 'Dallas Lady Tigers',
      inviterName: 'Coach Smith',
      role: 'Player',
      acceptLink: 'https://varsityhub.app/team/accept/def456',
      declineLink: 'https://varsityhub.app/team/decline/def456',
    })
  );

  await test('Athlete Invitation', () =>
    sendAthleteInvitationEmail({
      to: testEmail,
      inviterName: 'Coach Smith',
      athleteName: 'Emil Mancero',
      teamName: 'Dallas Lady Tigers',
      role: 'Forward',
      acceptLink: 'https://varsityhub.app/athlete/accept/ghi789',
      declineLink: 'https://varsityhub.app/athlete/decline/ghi789',
    })
  );

  await test('Role Assignment', () =>
    sendRoleAssignmentEmail({
      to: testEmail,
      assigneeName: 'Emil',
      roleName: 'Team Admin',
      grantedBy: 'Director Johnson',
      organizationName: 'Texas Elite Sports',
      dashboardLink: 'https://varsityhub.app/admin/dashboard',
    })
  );

  await test('Roster Threshold', () =>
    sendRosterThresholdEmail({
      to: testEmail,
      teamName: 'Dallas Lady Tigers',
      currentRosterSize: 18,
      rosterLimit: 20,
      manageRosterLink: 'https://varsityhub.app/team/roster/manage',
    })
  );

  await test('Invitation Declined', () =>
    sendInvitationDeclinedEmail({
      to: testEmail,
      inviteeName: 'New Player',
      role: 'Player',
      teamName: 'Dallas Lady Tigers',
      nextSteps: 'You can invite another player',
      dashboardLink: 'https://varsityhub.app/team/invites',
    })
  );

  await test('Team Roster Update', () =>
    sendTeamRosterUpdateEmail({
      to: testEmail,
      teamName: 'Dallas Lady Tigers',
      updatedBy: 'Coach Smith',
      changesSummary: 'Added 2 new players to the roster',
      rosterLink: 'https://varsityhub.app/team/roster',
    })
  );

  await test('Staff Member Joined', () =>
    sendStaffMemberJoinedEmail({
      to: testEmail,
      staffName: 'Coach Taylor',
      role: 'Assistant Coach',
      teamName: 'Dallas Lady Tigers',
      dashboardLink: 'https://varsityhub.app/team/staff',
    })
  );

  await test('User Confirmation', () =>
    sendUserConfirmationEmail({
      to: testEmail,
      organizationName: 'Texas Elite Sports',
      userName: 'Emil',
      dashboardLink: 'https://varsityhub.app/dashboard',
    })
  );

  console.log('\n💳 BILLING & PAYMENT EMAILS');
  console.log('─────────────────────────────────────────────────────────────────');

  await test('Payment Failed', () =>
    sendPaymentFailedEmail({
      to: testEmail,
      userName: 'Emil',
      paymentMethodLast4: '4242',
      failedAmount: '$49.99',
      failedDate: todayFormatted,
      planName: 'Pro Plan',
      retryDate: tomorrowFormatted,
      updatePaymentLink: 'https://varsityhub.app/billing/payment-method',
      contactSupportLink: 'https://varsityhub.app/support',
    })
  );

  await test('Subscription Expiring', () =>
    sendSubscriptionExpiringEmail({
      to: testEmail,
      userName: 'Emil',
      planName: 'Pro Plan',
      renewalDate: tomorrowFormatted,
      price: '$49.99',
      billingPortalLink: 'https://varsityhub.app/billing',
      changePlanLink: 'https://varsityhub.app/billing/change-plan',
      cancelLink: 'https://varsityhub.app/billing/cancel',
    })
  );

  // Results Summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      📊 TEST RESULTS SUMMARY                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const total = passed + failed;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`📊 TOTAL:  ${total}`);
  console.log(`📈 SUCCESS RATE: ${percentage}%\n`);

  // Detailed results
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    console.log('─────────────────────────────────────────────────────────────────');
    Object.entries(results).forEach(([name, result]) => {
      if (!result.success) {
        console.log(`  • ${name}: ${result.message}`);
      }
    });
    console.log();
  }

  // Save results to file
  const resultsFile = {
    timestamp: new Date().toISOString(),
    summary: {
      passed,
      failed,
      total,
      successRate: `${percentage}%`,
    },
    results,
    testEmail,
  };

  const fs = await import('fs').then(m => m.promises);
  await fs.writeFile(
    './test-results.json',
    JSON.stringify(resultsFile, null, 2)
  );

  console.log('📄 Results saved to: test-results.json\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
