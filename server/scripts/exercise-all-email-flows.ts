/**
 * Calls every send*Email function with realistic params + a unique recipient
 * alias so the user can filter by subject in their inbox. Reports a per-sender
 * pass/fail matrix.
 *
 * Run via:
 *   RAILWAY_TOKEN=... railway run --service api -- \
 *     npx tsx server/scripts/exercise-all-email-flows.ts varsityhub00@gmail.com
 *
 * Each call goes through the REAL EmailService → SendGridProvider, so:
 *   - missing template IDs trigger the local-fallback path (86ac2788) or
 *     return false with a captured error
 *   - SendGrid 4xx responses come back as `success: false` with errorCode
 *   - any thrown error is caught and reported per-sender
 *
 * Output is a JSON-friendly table the operator can scan. No email is sent
 * with a real-user-blocking shape (e.g., no test passwords are honored on
 * the user side; tokens are obvious gibberish) — these are pure
 * deliverability checks, not flow-completion checks.
 */

import 'dotenv/config';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendOrganizationInviteEmail,
  sendBillingNoticeEmail,
  sendCoachJoinRequestEmail,
  sendCoachApplicationAdminEmail,
  sendLeagueApprovalRequestEmail,
  sendLeagueApprovedEmail,
  sendLeagueRejectedEmail,
  sendCoachApprovedEmail,
  sendCoachRejectedEmail,
  sendAdminActionConfirmationEmail,
  sendAdPendingReviewEmail,
  sendAdApprovedEmail,
  sendAdRejectedEmail,
  sendAdTakenDownPendingReviewEmail,
  sendEventApprovedEmail,
  sendEventDeniedEmail,
  sendEventCanceledEmail,
  sendParentalConsentRequestEmail,
  sendAbuseReportEmail,
} from '../src/lib/email.js';

const baseEmail = process.argv[2];
if (!baseEmail || !baseEmail.includes('@')) {
  console.error('usage: tsx exercise-all-email-flows.ts <recipient@example.com>');
  process.exit(2);
}
const [local, domain] = baseEmail.split('@');
const aliasFor = (name: string) => `${local}+${name}@${domain}`;

type Result = { name: string; ok: boolean; ms: number; error?: string };

async function run(name: string, fn: () => Promise<boolean>): Promise<Result> {
  const t = Date.now();
  try {
    const ok = await fn();
    return { name, ok: !!ok, ms: Date.now() - t };
  } catch (err: any) {
    return { name, ok: false, ms: Date.now() - t, error: err?.message || String(err) };
  }
}

async function main() {
  console.log(`\n[email-exercise] base recipient: ${baseEmail}`);
  console.log(`[email-exercise] each sender uses alias varsityhub00+<name>@gmail.com\n`);

  const cases: Array<{ name: string; fn: () => Promise<boolean> }> = [
    {
      name: 'verification',
      fn: () => sendVerificationEmail(aliasFor('verification'), '123456', 'Test User'),
    },
    {
      name: 'password_reset',
      fn: () => sendPasswordResetEmail(aliasFor('password_reset'), '654321'),
    },
    {
      name: 'team_invite',
      fn: () =>
        sendTeamInviteEmail({
          to: aliasFor('team_invite'),
          teamName: 'Westhill Cougars',
          recipientName: 'Coach Test',
          organizationName: 'Westhill Athletics',
          role: 'assistant_coach',
          inviterName: 'Coach Carter',
          inviteToken: 'team_invite_test_abc123',
        }),
    },
    {
      name: 'org_invite',
      fn: () =>
        sendOrganizationInviteEmail({
          to: aliasFor('org_invite'),
          recipientName: 'Coach Test',
          organizationName: 'Westhill Athletics',
          role: 'manager',
          inviterName: 'Coach Carter',
          inviteToken: 'org_invite_test_abc123',
        }),
    },
    {
      name: 'billing_payment_failed',
      fn: () =>
        sendBillingNoticeEmail({
          to: aliasFor('billing_payment_failed'),
          type: 'payment_failed',
          user_name: 'Test User',
          planName: 'Veteran',
          amount: '$0.99',
        }),
    },
    {
      name: 'billing_trial_ending',
      fn: () =>
        sendBillingNoticeEmail({
          to: aliasFor('billing_trial_ending'),
          type: 'trial_ending',
          user_name: 'Test User',
          planName: 'Legend',
          daysRemaining: 7,
        }),
    },
    {
      name: 'coach_join_request',
      fn: () =>
        sendCoachJoinRequestEmail({
          ownerEmail: aliasFor('coach_join_request'),
          ownerName: 'League Owner',
          coachName: 'Aspiring Coach',
          coachEmail: 'aspiring@example.com',
          organizationName: 'Westhill Athletics',
          organizationId: 'org_test_123',
          requestId: 'req_test_123',
          coachNotes: 'Test note',
        }),
    },
    {
      name: 'coach_application_admin',
      fn: () =>
        sendCoachApplicationAdminEmail({
          to: aliasFor('coach_application_admin'),
          applicantName: 'Aspiring Coach',
          applicantEmail: 'aspiring@example.com',
          applicantUserId: 'u_test_coach',
          organizationName: 'Westhill Athletics',
          coachNotes: 'Test note',
        }),
    },
    {
      name: 'league_approval_request',
      fn: () =>
        sendLeagueApprovalRequestEmail({
          leagueId: 'org_test_league_123',
          leagueName: 'Test League',
          ownerName: 'League Owner',
          ownerEmail: aliasFor('league_approval_request'),
          sport: 'Basketball',
          orgType: 'league',
          approveToken: 'tok_approve_test',
          rejectToken: 'tok_reject_test',
        }),
    },
    {
      name: 'league_approved',
      fn: () =>
        sendLeagueApprovedEmail({
          to: aliasFor('league_approved'),
          ownerName: 'League Owner',
          leagueName: 'Test League',
          note: 'Welcome.',
        }),
    },
    {
      name: 'league_rejected',
      fn: () =>
        sendLeagueRejectedEmail({
          to: aliasFor('league_rejected'),
          ownerName: 'League Owner',
          leagueName: 'Test League',
          reason: 'Insufficient documentation',
        }),
    },
    {
      name: 'coach_approved',
      fn: () =>
        sendCoachApprovedEmail({
          to: aliasFor('coach_approved'),
          coachName: 'Coach Test',
          leagueName: 'Westhill Athletics',
          note: 'Welcome aboard.',
        }),
    },
    {
      name: 'coach_rejected',
      fn: () =>
        sendCoachRejectedEmail({
          to: aliasFor('coach_rejected'),
          coachName: 'Coach Test',
          leagueName: 'Westhill Athletics',
          reason: 'Background check pending',
        }),
    },
    {
      name: 'admin_action_confirmation',
      fn: () =>
        sendAdminActionConfirmationEmail({
          to: aliasFor('admin_action_confirmation'),
          action: 'league_approved',
          leagueName: 'Test League',
          ownerName: 'League Owner',
          ownerEmail: 'owner@example.com',
        }),
    },
    {
      name: 'ad_pending_review',
      fn: () =>
        sendAdPendingReviewEmail({
          to: aliasFor('ad_pending_review'),
          businessName: 'Acme Athletic Wear',
          contactName: 'Jane Acme',
          contactEmail: 'jane@acme.example',
          zipCode: '06902',
          bannerUrl: 'https://cdn.example.com/banner.jpg',
          adId: 'ad_test_123',
          approveToken: 'tok_approve_test',
          rejectToken: 'tok_reject_test',
        }),
    },
    {
      name: 'ad_approved',
      fn: () =>
        sendAdApprovedEmail({
          to: aliasFor('ad_approved'),
          businessName: 'Acme Athletic Wear',
          note: 'Live in 1 hour.',
        }),
    },
    {
      name: 'ad_rejected',
      fn: () =>
        sendAdRejectedEmail({
          to: aliasFor('ad_rejected'),
          businessName: 'Acme Athletic Wear',
          reason: 'Banner exceeds 5MB.',
        }),
    },
    {
      name: 'ad_taken_down_pending_review',
      fn: () =>
        sendAdTakenDownPendingReviewEmail({
          to: aliasFor('ad_taken_down_pending_review'),
          businessName: 'Acme Athletic Wear',
          reason: 'Multiple user reports — under review.',
        }),
    },
    {
      name: 'event_approved',
      fn: () =>
        sendEventApprovedEmail({
          to: aliasFor('event_approved'),
          recipientName: 'Coach Test',
          eventTitle: 'Spring Game',
          eventDate: 'Saturday, March 15, 2026',
          eventTime: '2:00 PM',
          eventLocation: 'Westhill HS',
          eventId: 'evt_test_123',
        }),
    },
    {
      name: 'event_denied',
      fn: () =>
        sendEventDeniedEmail({
          to: aliasFor('event_denied'),
          coachName: 'Coach Test',
          eventName: 'Spring Game',
          eventDate: 'Saturday, March 15, 2026',
          denialReason: 'Insufficient venue details',
          organizationName: 'Westhill Athletics',
        }),
    },
    {
      name: 'event_canceled',
      fn: () =>
        sendEventCanceledEmail({
          to: aliasFor('event_canceled'),
          recipientName: 'Coach Test',
          eventName: 'Spring Game',
          eventDate: 'Saturday, March 15, 2026',
          eventTime: '2:00 PM',
          eventLocation: 'Westhill HS',
          eventId: 'evt_test_123',
          cancelReason: 'Field unplayable',
          organizationName: 'Westhill Athletics',
        }),
    },
    {
      name: 'parental_consent_request',
      fn: () =>
        sendParentalConsentRequestEmail({
          to: aliasFor('parental_consent_request'),
          minorDisplayName: 'Jordan Test',
          minorEmail: 'jordan@example.com',
          consentToken: 'consent_token_test_abc123',
          expiresInDays: 7,
        }),
    },
    {
      name: 'abuse_report',
      fn: () =>
        sendAbuseReportEmail({
          to: aliasFor('abuse_report'),
          subject: '[deliverability test] sample abuse report',
          message: 'This is a test invocation of sendAbuseReportEmail to confirm delivery.',
        } as any),
    },
  ];

  const results: Result[] = [];
  for (const { name, fn } of cases) {
    process.stdout.write(`  [${name}] ... `);
    const r = await run(name, fn);
    results.push(r);
    process.stdout.write(`${r.ok ? '✓' : '✗'}  ${r.ms}ms${r.error ? `  err=${r.error}` : ''}\n`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n=== summary ===`);
  console.log(`passed: ${passed}/${results.length}`);
  if (failed > 0) {
    console.log(`failed:`);
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ✗ ${r.name}${r.error ? `: ${r.error}` : ''}`);
    }
  }
  console.log(`\nCheck inbox at ${baseEmail} — filter by subject containing the alias name.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[email-exercise] fatal:', err);
  process.exit(2);
});
