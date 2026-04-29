/**
 * Preview every transactional email by sending one of each to a single inbox.
 *
 * Usage (from server/):
 *   railway run npx tsx scripts/preview-all-emails.ts
 *
 * Or with explicit recipient override:
 *   PREVIEW_TO=alice@example.com railway run npx tsx scripts/preview-all-emails.ts
 *
 * Defaults:
 *   PREVIEW_TO = emancero@varsityhub.app
 *
 * Why this exists: gives marketing/leadership a one-shot preview of every
 * SendGrid template firing in real production, with realistic-but-distinct
 * sample data so each email tells its own story.
 *
 * Safety: every call hardcodes the recipient explicitly (no DB lookups), so
 * the script cannot accidentally fan out to real users.
 */

import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountModerationEmail,
  sendTeamInviteEmail,
  sendOrganizationInviteEmail,
  sendCoachJoinRequestEmail,
  sendCoachApplicationAdminEmail,
  sendEventApprovedEmail,
  sendEventCanceledEmail,
  sendEventDeniedEmail,
  sendEventPendingReviewEmail,
  sendEventRsvpConfirmedEmail,
  sendEventSubmissionReceivedEmail,
  sendEventUpdatedEmail,
  sendBillingNoticeEmail,
  sendAdPendingReviewEmail,
  sendAdApprovedEmail,
  sendAdRejectedEmail,
  sendAdPaymentConfirmedEmail,
  sendAdTakenDownPendingReviewEmail,
  sendLeagueApprovedEmail,
  sendLeagueRejectedEmail,
  sendCoachApprovedEmail,
  sendCoachRejectedEmail,
  sendAdminActionConfirmationEmail,
  sendContentRemovedEmail,
  sendReportStatusEmail,
  sendParentalConsentRequestEmail,
  sendInvitationDeclinedEmail,
  sendStaffMemberJoinedEmail,
} from '../src/lib/email.js';

const TO = process.env.PREVIEW_TO || 'emancero@varsityhub.app';

type Step = { name: string; run: () => Promise<unknown> };

const steps: Step[] = [
  // ─── Auth / Security ────────────────────────────────────────────────
  {
    name: 'VERIFICATION',
    run: () => sendVerificationEmail(TO, '482913', 'Maya Chen'),
  },
  {
    name: 'PASSWORD_RESET',
    run: () => sendPasswordResetEmail(TO, '601274'),
  },
  {
    name: 'PASSWORD_CHANGED',
    run: () => sendPasswordChangedEmail(TO, 'Tyler Brooks'),
  },

  // ─── Account Moderation ─────────────────────────────────────────────
  {
    name: 'ACCOUNT_WARNING',
    run: () =>
      sendAccountModerationEmail({
        to: TO,
        action: 'warning',
        reason: 'Sharing photos that included other coaches without their consent.',
        userName: 'Devin Park',
      }),
  },
  {
    name: 'ACCOUNT_SUSPENSION_7_DAYS',
    run: () =>
      sendAccountModerationEmail({
        to: TO,
        action: 'suspension_7d',
        reason: 'Repeated reports of off-topic comments in the team feed.',
        userName: 'Riley Kim',
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
  },
  {
    name: 'ACCOUNT_SUSPENSION_45_DAYS',
    run: () =>
      sendAccountModerationEmail({
        to: TO,
        action: 'suspension_45d',
        reason: 'Multiple confirmed harassment reports against opposing fans.',
        userName: 'Logan Reyes',
        endsAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      }),
  },
  {
    name: 'ACCOUNT_PERMANENT_BAN',
    run: () =>
      sendAccountModerationEmail({
        to: TO,
        action: 'permanent_ban',
        reason: 'Account used to impersonate a coach and post fake game updates.',
        userName: 'Jordan Lopez',
      }),
  },
  {
    name: 'ACCOUNT_RECOVERY',
    run: () =>
      sendAccountModerationEmail({
        to: TO,
        action: 'recovery',
        userName: 'Casey Morgan',
      }),
  },

  // ─── Team / Organization Invites ────────────────────────────────────
  {
    name: 'TEAM_INVITE',
    run: () =>
      sendTeamInviteEmail({
        to: TO,
        teamName: 'Riverside Eagles Varsity Basketball',
        recipientName: 'Marcus Hill',
        inviterName: 'Coach Sam Diaz',
        role: 'player',
        inviteToken: 'inv_team_marketing_preview_001',
      }),
  },
  {
    name: 'ORG_INVITE',
    run: () =>
      sendOrganizationInviteEmail({
        to: TO,
        organizationName: 'Pinecrest Academy Athletics',
        role: 'manager',
        inviterName: 'Director Lee Anderson',
        inviteToken: 'org_inv_marketing_preview_001',
      }),
  },
  {
    name: 'COACH_JOIN_REQUEST_OWNER',
    run: () =>
      sendCoachJoinRequestEmail({
        ownerEmail: TO,
        ownerName: 'Director Lee Anderson',
        coachName: 'Diego Nakamura',
        coachEmail: 'diego.nakamura@example.com',
        organizationName: 'Bayview Lacrosse Club',
        organizationId: 'org_marketing_preview_001',
        requestId: 'req_marketing_preview_001',
        approveUrl: 'https://api-production-8ac3.up.railway.app/preview/approve?token=demo',
        rejectUrl: 'https://api-production-8ac3.up.railway.app/preview/reject?token=demo',
        coachNotes:
          'I coached varsity for 8 seasons at Stamford Prep and want to bring my U16 team into the Bayview league this fall.',
      }),
  },
  {
    name: 'COACH_APPLICATION_ADMIN',
    run: () =>
      sendCoachApplicationAdminEmail({
        to: TO,
        applicantName: 'Tyler Brooks',
        applicantEmail: 'tyler.brooks@example.com',
        applicantUserId: 'user_marketing_preview_002',
        organizationName: 'Lakeview Lions',
        approveUrl: 'https://api-production-8ac3.up.railway.app/preview/approve?token=demo',
        rejectUrl: 'https://api-production-8ac3.up.railway.app/preview/reject?token=demo',
        coachNotes: 'Former D2 assistant. Background check uploaded.',
      }),
  },

  // ─── Events ─────────────────────────────────────────────────────────
  {
    name: 'EVENT_APPROVED',
    run: () =>
      sendEventApprovedEmail({
        to: TO,
        coachName: 'Mariah Park',
        eventName: 'Team BBQ — Saturday Sundown',
        eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
        eventTime: '5:00 PM',
        eventLocation: 'Riverside Park Pavilion, 220 Main St',
        organizationName: 'Riverside Eagles',
        opponent: 'TBD',
        approvalNotes: 'Approved — looks like a great team-building event!',
      }),
  },
  {
    name: 'EVENT_DENIED',
    run: () =>
      sendEventDeniedEmail({
        to: TO,
        coachName: 'Mariah Park',
        eventName: 'Spring Break Tournament',
        eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
        organizationName: 'Riverside Eagles',
        denialReason:
          'Conflicts with the Section 4A regional schedule already on the calendar.',
      }),
  },
  {
    name: 'EVENT_CANCELED',
    run: () =>
      sendEventCanceledEmail({
        to: TO,
        recipientName: 'Marcus Hill',
        eventName: 'Eagles vs Lakeside Lions — Home Game',
        eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
        eventTime: '7:00 PM',
        eventLocation: 'Riverside High School Gym',
        organizationName: 'Riverside Eagles',
        cancelReason: 'Field conditions unsafe after overnight storm. Make-up date TBD.',
        rescheduleInfo: 'A make-up date will be announced within 48 hours.',
      }),
  },
  {
    name: 'EVENT_PENDING_REVIEW',
    run: () =>
      sendEventPendingReviewEmail({
        to: TO,
        reviewerName: 'Coach Sam Diaz',
        requesterName: 'Mariah Park',
        requesterEmail: 'mariah.park@example.com',
        eventTitle: 'Pre-game Tailgate at Riverside',
        eventType: 'Social',
        teamName: 'Riverside Eagles',
        reviewId: 'evt_marketing_preview_001',
        reviewKind: 'event',
        coachNotes: 'Thought it would be a great way to bring families together before the rivalry game.',
      }),
  },
  {
    name: 'EVENT_RSVP_CONFIRMED',
    run: () =>
      sendEventRsvpConfirmedEmail({
        to: TO,
        attendeeName: 'Marcus Hill',
        eventTitle: 'Section Championship — Eagles vs Lakeside',
        eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        eventLocation: 'Lakeside High School Gymnasium, 412 Oak Ave',
      }),
  },
  {
    name: 'EVENT_SUBMISSION_RECEIVED (pending)',
    run: () =>
      sendEventSubmissionReceivedEmail({
        to: TO,
        submitterName: 'Mariah Park',
        eventTitle: 'Pre-game Tailgate at Riverside',
        needsApproval: true,
      }),
  },
  {
    name: 'EVENT_SUBMISSION_RECEIVED (live)',
    run: () =>
      sendEventSubmissionReceivedEmail({
        to: TO,
        submitterName: 'Coach Sam Diaz',
        eventTitle: 'Eagles vs Northbrook Hawks',
        needsApproval: false,
      }),
  },
  {
    name: 'EVENT_UPDATED',
    run: () =>
      sendEventUpdatedEmail({
        to: TO,
        attendeeName: 'Marcus Hill',
        eventTitle: 'Eagles vs Northbrook Hawks',
        changes: ['Game time moved 1 hour later (was 6 PM, now 7 PM)', 'Venue moved to away gym'],
        newDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        newLocation: 'Northbrook Hawks Field House, 88 Hillcrest Drive',
      }),
  },

  // ─── Billing ────────────────────────────────────────────────────────
  {
    name: 'PAYMENT_FAILED',
    run: () =>
      sendBillingNoticeEmail({
        to: TO,
        type: 'payment_failed',
        user_name: 'Coach Sam Diaz',
        planName: 'Veteran',
        amount: '$0.99',
        paymentMethodLast4: '4242',
        failedDate: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        retryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        manageLink: 'https://api-production-8ac3.up.railway.app/preview/manage-subscription',
      }),
  },
  {
    name: 'SUBSCRIPTION_EXPIRING (trial_ending)',
    run: () =>
      sendBillingNoticeEmail({
        to: TO,
        type: 'trial_ending',
        user_name: 'Coach Sam Diaz',
        planName: 'Legend',
        amount: '$19.99/year',
        daysRemaining: 6,
        expiresDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        manageLink: 'https://api-production-8ac3.up.railway.app/preview/manage-subscription',
      }),
  },

  // ─── Ads ────────────────────────────────────────────────────────────
  {
    name: 'AD_PENDING_REVIEW',
    run: () =>
      sendAdPendingReviewEmail({
        to: TO,
        businessName: "Acme Pizza & Wings",
        contactName: 'Renee Castillo',
        adId: 'ad_marketing_preview_001',
      }),
  },
  {
    name: 'AD_APPROVED',
    run: () =>
      sendAdApprovedEmail({
        to: TO,
        businessName: 'Acme Pizza & Wings',
        note: 'Your ad goes live tomorrow morning. Welcome to the Riverside community!',
      }),
  },
  {
    name: 'AD_REJECTED',
    run: () =>
      sendAdRejectedEmail({
        to: TO,
        businessName: "Backyard BBQ Co.",
        reason: 'Creative includes alcohol imagery that conflicts with our youth-sports community guidelines.',
      }),
  },
  {
    name: 'AD_PAYMENT_CONFIRMED',
    run: () =>
      sendAdPaymentConfirmedEmail({
        to: TO,
        businessName: 'Acme Pizza & Wings',
        zipCode: '06902',
        amount: '$49.00',
        hoursLabel: '7 days × 24 hours',
        totalHoursBooked: 168,
        hoursRemaining: 168,
        dates: [
          new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US'),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US'),
        ],
        adId: 'ad_marketing_preview_001',
      }),
  },
  {
    name: 'AD_TAKEN_DOWN_PENDING_REVIEW',
    run: () =>
      sendAdTakenDownPendingReviewEmail({
        to: TO,
        businessName: 'Lakeview Fitness Studio',
        reason: 'Creative requires additional moderation review after a community report. Most ads return to live status within 24 hours.',
      }),
  },

  // ─── Org Approval / Admin Action ────────────────────────────────────
  {
    name: 'ORG_APPROVED',
    run: () =>
      sendLeagueApprovedEmail({
        to: TO,
        ownerName: 'Director Lee Anderson',
        leagueName: 'Pinecrest Academy Athletics',
        note: 'Welcome to VarsityHub! Your league dashboard is now active.',
      }),
  },
  {
    name: 'ORG_DENIED',
    run: () =>
      sendLeagueRejectedEmail({
        to: TO,
        ownerName: 'Director Pat Hayes',
        leagueName: 'Pinewood Soccer Club',
        reason: 'Supporting documents could not be verified. Please re-upload your incorporation paperwork and resubmit.',
      }),
  },
  {
    name: 'COACH_APPROVED',
    run: () =>
      sendCoachApprovedEmail({
        to: TO,
        coachName: 'Coach Ramirez',
        leagueName: 'Pinecrest Academy Athletics',
        note: 'Welcome to the Pinecrest coaching staff!',
      }),
  },
  {
    name: 'COACH_REJECTED',
    run: () =>
      sendCoachRejectedEmail({
        to: TO,
        coachName: 'Coach Miller',
        leagueName: 'Pinecrest Academy Athletics',
        reason:
          'Background check is incomplete — please upload your most recent state clearance and reapply in 30 days.',
      }),
  },
  {
    name: 'ADMIN_ACTION_CONFIRMATION',
    run: () =>
      sendAdminActionConfirmationEmail({
        to: TO,
        action: 'league_approved',
        leagueName: 'Pinecrest Academy Athletics',
        ownerName: 'Director Lee Anderson',
        ownerEmail: 'lee.anderson@example.com',
        reason: 'Documents verified, league cleared for activation.',
      }),
  },

  // ─── Content Moderation ─────────────────────────────────────────────
  {
    name: 'CONTENT_REMOVED',
    run: () =>
      sendContentRemovedEmail({
        to: TO,
        authorName: 'Devin Park',
        contentType: 'post',
        reason: 'Post contained a photo of a minor without parental consent.',
      }),
  },
  {
    name: 'REPORT_DISMISSED',
    run: () =>
      sendReportStatusEmail({
        to: TO,
        reporterName: 'Coach Sam Diaz',
        status: 'dismissed',
        resolutionNote: 'After review, the comment was within community guidelines.',
      }),
  },
  {
    name: 'REPORT_RESOLVED',
    run: () =>
      sendReportStatusEmail({
        to: TO,
        reporterName: 'Coach Sam Diaz',
        status: 'resolved',
        resolutionNote: 'The post has been removed and the user has received a warning.',
      }),
  },

  // ─── Parental Consent ───────────────────────────────────────────────
  {
    name: 'PARENTAL_CONSENT_REQUEST',
    run: () =>
      sendParentalConsentRequestEmail({
        to: TO,
        minorDisplayName: 'Ava Johnson',
        minorEmail: 'ava.johnson@example.com',
        consentToken: 'preview-consent-token-marketing-001',
        expiresInDays: 10,
      }),
  },

  // ─── Roster Lifecycle ───────────────────────────────────────────────
  {
    name: 'INVITATION_DECLINED (team)',
    run: () =>
      sendInvitationDeclinedEmail({
        to: TO,
        inviterName: 'Coach Sam Diaz',
        decliner: 'Marcus Hill',
        scope: 'team',
        scopeName: 'Riverside Eagles Varsity Basketball',
      }),
  },
  {
    name: 'INVITATION_DECLINED (org)',
    run: () =>
      sendInvitationDeclinedEmail({
        to: TO,
        inviterName: 'Director Lee Anderson',
        decliner: 'Coach Maya Chen',
        scope: 'organization',
        scopeName: 'Pinecrest Academy Athletics',
      }),
  },
  {
    name: 'STAFF_MEMBER_JOINED (team)',
    run: () =>
      sendStaffMemberJoinedEmail({
        to: TO,
        ownerName: 'Coach Sam Diaz',
        newMember: 'Coach Maya Chen',
        newMemberRole: 'assistant_coach',
        scope: 'team',
        scopeName: 'Riverside Eagles Varsity Basketball',
      }),
  },
  {
    name: 'STAFF_MEMBER_JOINED (org)',
    run: () =>
      sendStaffMemberJoinedEmail({
        to: TO,
        ownerName: 'Director Lee Anderson',
        newMember: 'Coach Tyler Brooks',
        newMemberRole: 'manager',
        scope: 'organization',
        scopeName: 'Pinecrest Academy Athletics',
      }),
  },
];

async function main() {
  console.log(`\n📧 Sending ${steps.length} preview emails to ${TO}\n`);

  const results: Array<{ name: string; ok: boolean; error?: string }> = [];

  for (const step of steps) {
    process.stdout.write(`  → ${step.name.padEnd(40, '.')} `);
    try {
      const r = await step.run();
      const ok = r === true || (typeof r === 'object' && r !== null);
      results.push({ name: step.name, ok });
      console.log(ok ? '✅' : '❌ returned falsy');
    } catch (err: any) {
      results.push({ name: step.name, ok: false, error: err?.message || String(err) });
      console.log(`❌ ${err?.message || err}`);
    }
    // Small pacing so SendGrid doesn't see a 35-rps burst
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log('\n──────────────────────────────────────────');
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`✅ ${ok} sent / ❌ ${failed.length} failed`);
  if (failed.length > 0) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(`  ${f.name}: ${f.error || 'returned falsy'}`));
  }
  console.log(`\nCheck inbox: ${TO}\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[preview-all-emails] fatal:', err);
  process.exit(1);
});
