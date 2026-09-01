/**
 * Sends ONE of every requested transactional email to a single recipient with
 * coherent fictional sample data — intended for marketing screenshots / video.
 *
 * Every email is sent DIRECTLY through EmailService using the EXACT variable
 * names the hosted SendGrid templates expect (pulled live from the SendGrid
 * API). This bypasses the app's send*Email helpers, several of which pass
 * variable names that have drifted from the hosted templates and render blank.
 *
 * Run via (real SendGrid key + all template IDs only resolve in prod env):
 *   railway run --service api -- \
 *     npx tsx server/scripts/send-marketing-sample-emails.ts emilmancero@gmail.com
 */

import 'dotenv/config';
import { getEmailService } from '../src/services/email/service.js';
import { sendAdTakenDownPendingReviewEmail } from '../src/lib/email.js';

const to = process.argv[2] || 'emilmancero@gmail.com';
if (!to.includes('@')) {
  console.error('usage: tsx send-marketing-sample-emails.ts <recipient@example.com>');
  process.exit(2);
}

const APP = 'https://varsityhub.app';
const SUPPORT = 'support@varsityhub.app';
const LOGO =
  'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png';

// Shared footer / branding / link vars referenced across templates. Provided in
// both snake_case and camelCase so whichever a given template uses resolves.
const common = {
  logo_url: LOGO,
  footer_logo_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png',
  hero_image_url: LOGO,
  privacy_policy_url: `${APP}/privacy-policy`,
  community_guidelines_url: `${APP}/terms`,
  privacyPolicyUrl: `${APP}/privacy-policy`,
  communityGuidelinesUrl: `${APP}/terms`,
  instagram_url: 'https://www.instagram.com/varsityhubapp/',
  tiktok_url: 'https://www.tiktok.com/@varsityhubapp',
  youtube_url: 'https://www.youtube.com/@varsityhubapp',
  facebook_url: 'https://www.facebook.com/varsityhubapp/',
  x_url: 'https://x.com/varsityhub00',
  website_url: APP,
  support_url: `${APP}/support`,
  supportUrl: `${APP}/support`,
  support_email: SUPPORT,
  supportEmail: SUPPORT,
  customer_service_email: SUPPORT,
  appeal_url: `${APP}/support`,
  appealUrl: `${APP}/support`,
};

type Case = { name: string; env: string; subject: string; data: Record<string, any> };

const cases: Case[] = [
  // ---- Auth & Security ----
  {
    name: 'email_verification',
    env: 'SENDGRID_VERIFICATION_TEMPLATE_ID',
    subject: '482915 is your VarsityHub verification code',
    data: { token: '482915', verification_code: '482915', user_name: 'Jordan Rivera', expires_in: '30 minutes' },
  },
  {
    name: 'password_reset',
    env: 'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
    subject: '719204 is your VarsityHub password reset code',
    data: { code: '719204', expiresIn: '30 minutes', name: 'Jordan Rivera', resetLink: `${APP}/reset-password`, mobileResetLink: `${APP}/reset-password` },
  },
  {
    name: 'password_changed',
    env: 'SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID',
    subject: 'Your VarsityHub password was changed',
    data: { date: 'June 16, 2026 at 3:08 PM EDT', email: to, name: 'Jordan Rivera' },
  },

  // ---- Team & Organization ----
  {
    name: 'team_invite',
    env: 'SENDGRID_TEAM_INVITE_TEMPLATE_ID',
    subject: "You've been invited to join Lincoln Lions",
    data: { athleteName: 'Jordan Rivera', coachName: 'Coach Marcus Bell', teamName: 'Lincoln Lions', acceptLink: `${APP}/join/team/sample`, declineLink: `${APP}/join/team/sample` },
  },
  {
    name: 'org_invite',
    env: 'SENDGRID_ORG_INVITE_TEMPLATE_ID',
    subject: "You've been invited to join Lincoln Athletics",
    data: { recipientName: 'Jordan Rivera', inviterName: 'Coach Marcus Bell', organizationName: 'Lincoln Athletics', teamName: 'Lincoln Athletics', role: 'Manager', expiresIn: '7 days', acceptLink: `${APP}/join/org/sample` },
  },
  {
    name: 'join_request_received',
    env: 'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID',
    subject: 'New Coach Request: Taylor Morgan wants to join Lincoln Athletics',
    data: { requester_name: 'Taylor Morgan', org_name: 'Lincoln Athletics', admin_name: 'Coach Marcus Bell', approve_url: `${APP}/approve`, deny_url: `${APP}/deny`, coach_notes: 'I coached JV basketball for 4 seasons and would love to help out.', org_logo_url: '', supporting_document_url: '' },
  },
  {
    name: 'join_request_approved',
    env: 'SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID',
    subject: 'Congratulations on being accepted!',
    data: { user_name: 'Taylor Morgan', org_name: 'Lincoln Athletics', admin_name: 'Coach Marcus Bell', admin_note: 'Welcome to the staff — excited to have you!', dashboard_url: `${APP}/organization?tab=teams`, org_logo_url: '' },
  },
  {
    name: 'join_request_denied',
    env: 'SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID',
    subject: 'Coach request for Lincoln Athletics — declined',
    data: { user_name: 'Taylor Morgan', org_name: 'Lincoln Athletics', reason: 'We have filled our coaching staff for this season. Please reapply in the spring.', app_url: APP, org_logo_url: '' },
  },

  // ---- Events ----
  {
    name: 'event_approved',
    env: 'SENDGRID_EVENT_APPROVED_TEMPLATE_ID',
    subject: 'Your event was approved',
    data: { coachName: 'Coach Marcus Bell', eventName: 'Lincoln Lions vs. Ridgeview Hawks', eventDate: 'Saturday, September 12, 2026', eventTime: '7:00 PM', eventLocation: 'Lincoln High School — Main Gym', opponent: 'Ridgeview Hawks', organizationName: 'Lincoln Athletics', approvalNotes: 'Approved — have a great game!', eventLink: `${APP}/events/evt_sample_123`, manageLink: `${APP}/organization?tab=teams` },
  },
  {
    name: 'event_denied',
    env: 'SENDGRID_EVENT_DENIED_TEMPLATE_ID',
    subject: 'Event not approved',
    data: { coachName: 'Coach Marcus Bell', eventName: 'Lincoln Lions Scrimmage', eventDate: 'Saturday, September 12, 2026', denialReason: 'The venue you selected is already booked for that time slot.', organizationName: 'Lincoln Athletics', resubmitLink: `${APP}/create-fan-event`, supportLink: `mailto:${SUPPORT}` },
  },
  {
    name: 'event_canceled',
    env: 'SENDGRID_EVENT_CANCELED_TEMPLATE_ID',
    subject: '"Lincoln Lions vs. Ridgeview Hawks" was cancelled',
    data: { recipientName: 'Jordan Rivera', eventName: 'Lincoln Lions vs. Ridgeview Hawks', eventDate: 'Saturday, September 12, 2026', eventTime: '7:00 PM', eventLocation: 'Lincoln High School — Main Gym', cancelReason: 'Severe weather warning issued for the area.', canceledAt: 'June 16, 2026', organizationName: 'Lincoln Athletics', rescheduleInfo: 'We are working to reschedule for the following weekend. Watch for updates.', upcomingEventsLink: `${APP}/events`, contactOrganizerLink: `mailto:${SUPPORT}` },
  },
  {
    name: 'event_reminder',
    env: 'SENDGRID_EVENT_REMINDER_TEMPLATE_ID',
    subject: 'Reminder: Lincoln Lions vs. Ridgeview Hawks is tomorrow',
    data: { recipientName: 'Jordan Rivera', eventName: 'Lincoln Lions vs. Ridgeview Hawks', eventDate: 'Saturday, September 12, 2026', eventTime: '7:00 PM', eventLocation: 'Lincoln High School — Main Gym', opponent: 'Ridgeview Hawks', organizationName: 'Lincoln Athletics', calendarLink: `${APP}/events/evt_sample_123/calendar`, checkInLink: `${APP}/events/evt_sample_123/check-in`, directionsLink: 'https://maps.google.com/?q=Lincoln+High+School', preferencesLink: `${APP}/settings/notifications` },
  },
  {
    name: 'rsvp_confirmed',
    env: 'SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID',
    subject: "You're going to Lincoln Lions vs. Ridgeview Hawks",
    data: { attendee_name: 'Jordan Rivera', event_title: 'Lincoln Lions vs. Ridgeview Hawks', event_location: 'Lincoln High School — Main Gym', event_date: 'Saturday, September 12, 2026 · 7:00 PM' },
  },
  {
    name: 'event_submission_received',
    env: 'SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID',
    subject: 'We received your event submission: Lincoln Lions Alumni Game',
    data: { submitter_name: 'Jordan Rivera', event_title: 'Lincoln Lions Alumni Game', needs_approval: true },
  },
  {
    name: 'event_updated',
    env: 'SENDGRID_EVENT_UPDATED_TEMPLATE_ID',
    subject: 'Update for Lincoln Lions vs. Ridgeview Hawks',
    data: { attendee_name: 'Jordan Rivera', event_title: 'Lincoln Lions vs. Ridgeview Hawks', changes: ['Start time moved to 7:30 PM', 'Location changed to the Auxiliary Gym'], new_location: 'Lincoln High School — Auxiliary Gym', new_date: 'Saturday, September 12, 2026 · 7:30 PM' },
  },
  {
    name: 'event_pending_review',
    env: 'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID',
    subject: 'New event awaiting approval: Lincoln Lions Alumni Game',
    data: { requester_name: 'Jordan Rivera', org_name: 'Lincoln Lions', admin_name: 'Coach Marcus Bell', approve_url: `${APP}/events/rev_sample_123/approve`, deny_url: `${APP}/events/rev_sample_123/reject`, coach_notes: 'Alumni exhibition game — proceeds go to the booster club.', org_logo_url: '', supporting_document_url: '' },
  },

  // ---- Roster / Membership ----
  {
    name: 'athlete_invitation',
    env: 'SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID',
    subject: "You've been added to the Lincoln Lions roster",
    data: { athleteName: 'Jordan Rivera', coachName: 'Coach Marcus Bell', teamName: 'Lincoln Lions', acceptLink: `${APP}/join/team/sample`, declineLink: `${APP}/join/team/sample` },
  },
  {
    name: 'staff_member_joined',
    env: 'SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID',
    subject: 'Taylor Morgan joined Lincoln Lions as Assistant Coach',
    data: { new_member_name: 'Taylor Morgan', new_member_role: 'Assistant Coach', owner_name: 'Coach Marcus Bell', scope: 'team', scope_name: 'Lincoln Lions' },
  },
  {
    name: 'team_roster_update',
    env: 'SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID',
    subject: 'Roster updated for Lincoln Lions',
    data: { coachName: 'Coach Marcus Bell', teamName: 'Lincoln Lions', updateType: 'Player added', updatedByName: 'Taylor Morgan', updateDate: 'September 5, 2026', changesSummary: 'Jordan Rivera (#23, Guard) was added to the active roster.', currentRosterCount: 18, viewRosterUrl: `${APP}/teams/sample/roster` },
  },
  {
    name: 'invitation_declined',
    env: 'SENDGRID_INVITATION_DECLINED_TEMPLATE_ID',
    subject: 'Taylor Morgan declined your team invite',
    data: { senderName: 'Coach Marcus Bell', declinedByName: 'Taylor Morgan', declinedDate: 'September 5, 2026', teamName: 'Lincoln Lions', role: 'Assistant Coach', reasonProvided: 'Already committed to another program this season.', resendInvitationUrl: `${APP}/teams/sample/invite`, viewTeamUrl: `${APP}/teams/sample` },
  },
  {
    name: 'role_assignment',
    env: 'SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID',
    subject: "You're now an Assistant Coach for Lincoln Lions",
    data: { assignedBy: 'Coach Marcus Bell', assignedDate: 'September 5, 2026', newRole: 'Assistant Coach', roleName: 'Assistant Coach', organizationName: 'Lincoln Athletics', teamName: 'Lincoln Lions', dashboardLink: `${APP}/organization?tab=teams` },
  },
  {
    name: 'roster_threshold_alert',
    env: 'SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID',
    subject: 'Lincoln Lions is nearing its roster limit',
    data: { coachName: 'Coach Marcus Bell', teamName: 'Lincoln Lions', currentRosterCount: 48, maxRosterCount: 50, upgradeLink: `${APP}/settings/manage-subscription` },
  },

  // ---- Organization Approval ----
  {
    name: 'org_approved',
    env: 'SENDGRID_ORG_APPROVAL_TEMPLATE_ID',
    subject: 'Your organization "Lincoln Athletics" has been approved!',
    data: { owner_name: 'Coach Marcus Bell', org_name: 'Lincoln Athletics', admin_note: 'Your organization is verified and ready to go.', dashboard_url: `${APP}/organization?tab=teams`, org_logo_url: '' },
  },
  {
    name: 'org_denied',
    env: 'SENDGRID_ORG_DENIAL_TEMPLATE_ID',
    subject: 'Update on your organization "Lincoln Athletics"',
    data: { owner_name: 'Coach Marcus Bell', org_name: 'Lincoln Athletics', reason: 'We could not verify your affiliation. Please resubmit with supporting documents.', org_logo_url: '' },
  },

  // ---- Ads ----
  {
    name: 'ad_pending_review',
    env: 'SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID',
    subject: 'Ad Pending Review: Hometown Sports Grill',
    data: { business_name: 'Hometown Sports Grill', contact_name: 'Dana Brooks', contact_email: 'dana@hometownsportsgrill.example', zip_code: '53703', banner_url: LOGO, ad_id: 'ad_sample_123', approve_url: `${APP}/ads/ad_sample_123/approve`, reject_url: `${APP}/ads/ad_sample_123/reject` },
  },
  {
    name: 'ad_approved',
    env: 'SENDGRID_AD_APPROVED_TEMPLATE_ID',
    subject: 'Your ad for "Hometown Sports Grill" has been approved',
    data: { business_name: 'Hometown Sports Grill', admin_note: 'Your ad goes live within the hour.', app_url: APP },
  },
  {
    name: 'ad_rejected',
    env: 'SENDGRID_AD_REJECTED_TEMPLATE_ID',
    subject: 'Ad update for "Hometown Sports Grill"',
    data: { business_name: 'Hometown Sports Grill', rejection_reason: 'The banner image is below our minimum resolution. Please upload a higher-quality version.', app_url: APP, support_email: SUPPORT },
  },
  {
    name: 'ad_payment_confirmed',
    env: 'SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID',
    subject: 'Ad Reservation Confirmed — VarsityHub',
    data: { business_name: 'Hometown Sports Grill', zip_code: '53703', amount: '$120.00', total_hours_booked: 24, hours_remaining: 24, dates: ['September 12, 2026', 'September 13, 2026'], dates_count: 2, ad_id: 'ad_sample_123', app_url: APP },
  },

  // ---- Billing ----
  {
    name: 'payment_failed',
    env: 'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID',
    subject: 'Payment Failed — VarsityHub',
    data: { userName: 'Jordan Rivera', planName: 'Veteran', failedAmount: '$0.99', failedDate: 'June 16, 2026', retryDate: 'June 19, 2026', paymentMethodLast4: '4242', updatePaymentLink: `${APP}/settings/manage-subscription`, contactSupportLink: `mailto:${SUPPORT}` },
  },
  {
    name: 'subscription_expiring',
    env: 'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID',
    subject: 'Subscription Expiring — VarsityHub',
    data: { userName: 'Jordan Rivera', planName: 'Legend', daysRemaining: 7, expiresDate: 'June 23, 2026', renewalDate: 'June 23, 2026', renewalPrice: '$19.99/yr', manageSubscriptionLink: `${APP}/settings/manage-subscription`, renewLink: `${APP}/settings/manage-subscription`, features_losing: ['Unlimited teams', 'Unlimited authorized users', 'Priority support'] },
  },

  // ---- Moderation ----
  {
    name: 'account_warning',
    env: 'SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID',
    subject: 'A moderator issued a warning on your VarsityHub account',
    data: { userName: 'Jordan Rivera', warningReason: 'A post you shared was flagged for unsportsmanlike language.', violationType: 'Community Guidelines — Conduct', warningDate: 'June 16, 2026', reportType: 'Post report', reportId: 'RPT-10241' },
  },
  {
    name: 'account_suspension_7d',
    env: 'SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID',
    subject: 'Your VarsityHub account is suspended for 7 days',
    data: { user_name: 'Jordan Rivera', suspension_reason: 'Repeated violations of our community guidelines.', suspension_duration: '7 days', suspension_days: '7', suspension_date: 'June 16, 2026', reinstatement_date: 'June 23, 2026', violation_type: 'Community Guidelines — Harassment', report_id: 'RPT-10242' },
  },
  {
    name: 'account_suspension_45d',
    env: 'SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID',
    subject: 'Your VarsityHub account is suspended for 45 days',
    data: { user_name: 'Jordan Rivera', suspension_reason: 'Severe or repeated violations of our community guidelines.', suspension_duration: '45 days', suspension_days: '45', suspension_date: 'June 16, 2026', reinstatement_date: 'July 31, 2026', violation_type: 'Community Guidelines — Repeated Harassment', report_id: 'RPT-10243' },
  },
  {
    name: 'account_permanent_ban',
    env: 'SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID',
    subject: 'Your VarsityHub account has been permanently banned',
    data: { user_name: 'Jordan Rivera', ban_reason: 'Conduct that puts the safety of our community at risk.', violation_type: 'Community Guidelines — Safety', ban_date: 'June 16, 2026', report_id: 'RPT-10244' },
  },
  {
    name: 'account_recovery',
    env: 'SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID',
    subject: 'Your VarsityHub account has been restored',
    data: { USERNAME: 'Jordan Rivera', ACCOUNT_EMAIL: to, RECOVERY_DATE: 'June 16, 2026' },
  },
  {
    name: 'content_removed',
    env: 'SENDGRID_CONTENT_REMOVED_TEMPLATE_ID',
    subject: 'Your post was removed by a moderator',
    data: { userName: 'Jordan Rivera', contentType: 'post', removalReason: 'This post violated our community guidelines on respectful conduct.', removalDate: 'June 16, 2026', reportType: 'Post report', reportId: 'RPT-10245' },
  },
  {
    name: 'report_resolved',
    env: 'SENDGRID_REPORT_RESOLVED_TEMPLATE_ID',
    subject: 'Update on your report — action taken',
    data: { userName: 'Jordan Rivera', reportType: 'Harassment', reportId: 'RPT-10246', reportDate: 'June 14, 2026', resolutionDate: 'June 16, 2026', resolutionReason: 'We removed the reported content and warned the author.' },
  },
  {
    name: 'report_dismissed',
    env: 'SENDGRID_REPORT_DISMISSED_TEMPLATE_ID',
    subject: 'Update on your report — no action taken',
    data: { userName: 'Jordan Rivera', reportType: 'Spam', reportId: 'RPT-10247', reportDate: 'June 14, 2026', submitDate: 'June 14, 2026', resolutionDate: 'June 16, 2026', dismissalReason: 'We reviewed the content and found it did not violate our guidelines.', resolutionReason: 'No violation found.' },
  },
];

type Result = { name: string; ok: boolean; ms: number; error?: string };

async function sendOne(c: Case): Promise<Result> {
  const t = Date.now();
  try {
    const templateId = (process.env[c.env] || '').trim();
    if (!templateId) throw new Error(`missing env ${c.env}`);
    const svc = getEmailService();
    const result = await svc.send({
      to,
      subject: c.subject,
      templateId,
      templateData: { ...common, subject: c.subject, ...c.data },
      replyTo: process.env.SUPPORT_REPLY_TO || SUPPORT,
    } as any);
    if (!result.success) throw new Error(result.error || result.errorCode || 'send failed');
    return { name: c.name, ok: true, ms: Date.now() - t };
  } catch (err: any) {
    return { name: c.name, ok: false, ms: Date.now() - t, error: err?.message || String(err) };
  }
}

async function main() {
  console.log(`\n[marketing-emails] recipient: ${to}\n`);
  const results: Result[] = [];

  for (const c of cases) {
    process.stdout.write(`  [${c.name}] ... `);
    const r = await sendOne(c);
    results.push(r);
    process.stdout.write(`${r.ok ? '✓' : '✗'}  ${r.ms}ms${r.error ? `  err=${r.error}` : ''}\n`);
  }

  // Ad taken-down has no hosted SendGrid template; its helper renders a fully
  // populated local HTML fallback, so send that one through the helper.
  {
    process.stdout.write(`  [ad_taken_down] ... `);
    const t = Date.now();
    let ok = false;
    let error: string | undefined;
    try {
      ok = await sendAdTakenDownPendingReviewEmail({
        to,
        businessName: 'Hometown Sports Grill',
        reason: 'We received multiple reports about this ad and are re-reviewing it.',
      });
    } catch (err: any) {
      error = err?.message || String(err);
    }
    results.push({ name: 'ad_taken_down', ok, ms: Date.now() - t, error });
    process.stdout.write(`${ok ? '✓' : '✗'}  ${Date.now() - t}ms${error ? `  err=${error}` : ''}\n`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n=== summary ===`);
  console.log(`total:  ${results.length}`);
  console.log(`passed: ${passed}`);
  if (failed > 0) {
    console.log(`failed:`);
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ✗ ${r.name}${r.error ? `: ${r.error}` : ''}`);
    }
  }
  console.log(`\nAll sent to ${to}. Check the inbox.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[marketing-emails] fatal:', err);
  process.exit(2);
});
