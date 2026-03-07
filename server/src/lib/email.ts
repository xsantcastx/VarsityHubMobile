import { debugLog } from './debugLog.js';
import type { FounderMetricsReport } from './founderMetrics.js';
import type { EmailResult } from '../services/email/types.js';
import type { EmailService } from '../services/email/EmailService.js';
import sgMail from '@sendgrid/mail';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;

let emailServicePromise: Promise<EmailService> | null = null;
const getEmailService = async (): Promise<EmailService | null> => {
  if (isTestEnv) return null;
  if (!emailServicePromise) {
    emailServicePromise = import('../services/email/service.js').then((mod) => mod.getEmailService());
  }
  return emailServicePromise;
};

// Legacy constants for backward compatibility
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');
const CUSTOMER_SERVICE_EMAIL = process.env.CUSTOMER_SERVICE_EMAIL || 'support@varsityhub.app';

// Common template data (social links, privacy policy, etc.) added to all emails
const getCommonTemplateData = () => ({
  privacy_policy_url: 'https://limeprod.com/VarsityHubPrivacy',
  community_guidelines_url: 'https://limeprod.com/VarsityHubPrivacy',
  instagram_url: 'https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13',
  tiktok_url: 'https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi',
  youtube_url: 'https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-',
  facebook_url: 'https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr',
  x_url: 'https://x.com/varsityhub00',
  website_url: 'https://limeprod.com',
  customer_service_email: CUSTOMER_SERVICE_EMAIL,
});

// Template IDs for SendGrid dynamic templates
const TEMPLATE_IDS = {
  // Auth & Security
  VERIFICATION: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || '',
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',
  PASSWORD_CHANGED: process.env.SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID || '',
  ACCOUNT_RECOVERY: process.env.SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID || '',
  LOGIN_NEW_DEVICE: process.env.SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID || '',
  
  // Moderation & Trust
  REPORT_RESOLVED: process.env.SENDGRID_REPORT_RESOLVED_TEMPLATE_ID || '',
  REPORT_DISMISSED: process.env.SENDGRID_REPORT_DISMISSED_TEMPLATE_ID || '',
  ACCOUNT_WARNING: process.env.SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID || '',
  CONTENT_REMOVED: process.env.SENDGRID_CONTENT_REMOVED_TEMPLATE_ID || '',
  
  // Suspensions
  ACCOUNT_SUSPENSION_7_DAYS: process.env.SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID || '',
  ACCOUNT_SUSPENSION_45_DAYS: process.env.SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID || '',
  ACCOUNT_PERMANENT_BAN: process.env.SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID || '',
  
  // Events
  EVENT_SUBMISSION_RECEIVED: process.env.SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID || '',
  EVENT_APPROVED: process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID || '',
  EVENT_DENIED: process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID || '',
  EVENT_REMINDER: process.env.SENDGRID_EVENT_REMINDER_TEMPLATE_ID || '',
  EVENT_UPDATED: process.env.SENDGRID_EVENT_UPDATED_TEMPLATE_ID || '',
  EVENT_CANCELED: process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID || '',
  EVENT_RSVP_CONFIRMED: process.env.SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID || '',
  
  // Team & Organization
  TEAM_INVITE: process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID || '',
  ORG_INVITE: process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID || '',
  ATHLETE_INVITATION: process.env.SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID || '',
  ROLE_ASSIGNMENT: process.env.SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID || '',
  ROSTER_THRESHOLD: process.env.SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID || '',
  INVITATION_DECLINED: process.env.SENDGRID_INVITATION_DECLINED_TEMPLATE_ID || '',
  TEAM_ROSTER_UPDATE: process.env.SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID || '',
  STAFF_MEMBER_JOINED: process.env.SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID || '',
  USER_CONFIRMATION: process.env.SENDGRID_USER_CONFIRMATION_TEMPLATE_ID || '',
  
  // Legacy/Deprecated (kept for backward compatibility)
  ABUSE_REPORT: process.env.SENDGRID_ABUSE_REPORT_TEMPLATE_ID || '',
  JOIN_REQUEST_ADMIN: process.env.SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID || '',
  JOIN_REQUEST_APPROVED: process.env.SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID || '',
  JOIN_REQUEST_DENIED: process.env.SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID || '',
  ORG_APPROVAL: process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID || '',
  ORG_DENIAL: process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID || '',
  CONTENT_MODERATION: process.env.SENDGRID_CONTENT_MODERATION_TEMPLATE_ID || '',
  BILLING_NOTICE: process.env.SENDGRID_BILLING_NOTICE_TEMPLATE_ID || '',

  // Billing
  PAYMENT_FAILED: process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID || '',
  SUBSCRIPTION_EXPIRING: process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID || '',

  // Notifications & Engagement
  WELCOME: process.env.SENDGRID_WELCOME_TEMPLATE_ID || '',
  AD_GOES_LIVE: process.env.SENDGRID_AD_GOES_LIVE_TEMPLATE_ID || '',
  AD_RESERVATION: process.env.SENDGRID_AD_RESERVATION_TEMPLATE_ID || '',
  ATHLETE_FOLLOWER: process.env.SENDGRID_ATHLETE_FOLLOWER_TEMPLATE_ID || '',
  DORMANT_USER_DIGEST: process.env.SENDGRID_DORMANT_USER_DIGEST_TEMPLATE_ID || '',
  PAYMENT_REQUIRED: process.env.SENDGRID_PAYMENT_REQUIRED_TEMPLATE_ID || '',
  POST_HIGHLIGHT: process.env.SENDGRID_POST_HIGHLIGHT_TEMPLATE_ID || '',
  PROFILE_COMPLETION_NUDGE: process.env.SENDGRID_PROFILE_COMPLETION_NUDGE_TEMPLATE_ID || '',
  SEASON_WRAP_UP: process.env.SENDGRID_SEASON_WRAP_UP_TEMPLATE_ID || '',
};

type TemplateKey = keyof typeof TEMPLATE_IDS;
const REQUIRED_TEMPLATE_KEYS: TemplateKey[] = [
  'VERIFICATION',
  'PASSWORD_RESET',
  'TEAM_INVITE',
  'ORG_INVITE',
  'JOIN_REQUEST_ADMIN',
  'JOIN_REQUEST_APPROVED',
  'JOIN_REQUEST_DENIED',
];

export function isSendGridConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

export function getMissingEmailTemplates(required: TemplateKey[] = REQUIRED_TEMPLATE_KEYS): string[] {
  return required
    .filter((key) => !TEMPLATE_IDS[key])
    .map((key) => key.toLowerCase());
}

/**
 * Initialize email service (now uses new EmailService)
 */
export async function initEmailService() {
  if (isTestEnv) {
    return { success: false, errors: ['Email service disabled in test environment'] };
  }

  // Initialize SendGrid if API key is available
  if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
  }

  const { initEmailService: initNewEmailService } = await import('../services/email/service.js');
  const result = initNewEmailService();

  // Also check for missing templates (legacy check)
  const missing = getMissingEmailTemplates();
  if (missing.length) {
    console.warn(`[email] SendGrid template IDs missing: ${missing.join(', ')}`);
  }

  return result;
}

type BasicEmail = { to: string; subject: string; text?: string; html?: string };

const formatLines = (lines: Array<string | undefined | null>) =>
  lines.filter((line) => Boolean(line && String(line).trim().length)).join('\n');

/**
 * Generic email helper used by queue fallbacks and non-templated sends.
 * Now uses the new EmailService with retry logic and better error handling.
 */
export async function sendEmail({ to, subject, text, html }: BasicEmail): Promise<boolean> {
  if (!to) {
    console.warn('[email] Missing recipient');
    return false;
  }

  const safeSubject = subject || 'VarsityHub notification';
  const safeText = text ?? '';
  const safeHtml = html ?? text ?? '';

  const service = await getEmailService();
  
  if (!service || !service.isConfigured()) {
    console.warn('[email] Email service not configured - logging email', { to, subject: safeSubject });
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatLines([`To: ${to}`, `Subject: ${safeSubject}`, safeText]));
    }
    return true; // Return true to not break existing flows
  }

  try {
    const result = await service.send({
      to,
      subject: safeSubject,
      text: safeText,
      html: safeHtml,
    });

    if (result.success) {
      debugLog(`[email] Sent generic email to ${to} (${safeSubject})`);
      return true;
    } else {
      console.error('[email] Failed to send generic email:', result.error);
      return false;
    }
  } catch (error: any) {
    console.error('[email] Failed to send generic email:', error);
    return false;
  }
}

export async function sendSubscriptionExpiringEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.SUBSCRIPTION_EXPIRING,
    params.to,
    `Your ${params?.planName || 'subscription'} expires soon`,
    {
      ...getCommonTemplateData(),
      user_name: params.userName || 'VarsityHub user',
      plan_name: params.planName || 'subscription',
      expires_date: params.expiresDate || '',
      days_remaining: params.daysRemaining || 0,
      renewal_price: params.renewalPrice || '',
      renew_link: params.renewLink || `${APP_BASE_URL}/settings/manage-subscription`,
      manage_subscription_link: params.manageSubscriptionLink || `${APP_BASE_URL}/settings/manage-subscription`,
    },
    `Subscription expiring email sent to ${params.to}`
  );
}

export async function sendAccountRecoveryEmail(to: string, userName?: string, recoveryTime?: string, params?: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ACCOUNT_RECOVERY,
    to,
    'Account recovery requested',
    {
      ...getCommonTemplateData(),
      user_name: userName || 'VarsityHub user',
      recovery_type: params?.recoveryType || 'password_reset',
      recovery_time: recoveryTime || new Date().toLocaleString(),
      ip_address: params?.ipAddress || '',
      undo_link: params?.undoLink || '',
      undo_expiry_hours: params?.undoExpiryHours || 24,
      support_url: params?.supportUrl || `mailto:${CUSTOMER_SERVICE_EMAIL}`,
    },
    `Account recovery email sent to ${to}`
  );
}

export async function sendAdGoesLiveEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.AD_GOES_LIVE,
    params?.to,
    'Your ad is live',
    {
      ...getCommonTemplateData(),
      ad_title: params?.adTitle || '',
      business_name: params?.businessName || '',
      target_zip: params?.targetZip || '',
      analytics_dashboard_url: params?.analyticsDashboardUrl || '',
    },
    `Ad goes live email sent to ${params?.to}`
  );
}

export async function sendAdReservationEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.AD_RESERVATION,
    params?.to,
    'We received your ad reservation',
    {
      ...getCommonTemplateData(),
      advertiser_name: params?.advertiserName || '',
      business_name: params?.businessName || '',
      checkout_link: params?.checkoutLink || '',
    },
    `Ad reservation email sent to ${params?.to}`
  );
}

export async function sendAthleteFollowerNotificationEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ATHLETE_FOLLOWER,
    params?.to,
    'New follower alert',
    {
      ...getCommonTemplateData(),
      follower_name: params?.followerName || 'Someone',
      athlete_name: params?.athleteName || 'you',
      follower_profile_url: params?.followerProfileUrl || '',
    },
    `Athlete follower notification sent to ${params?.to}`
  );
}

export async function sendDormantUserDigestEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.DORMANT_USER_DIGEST,
    params?.to,
    'We miss you on VarsityHub',
    {
      ...getCommonTemplateData(),
      user_name: params?.userName || 'there',
      days_absent: params?.daysAbsent || 0,
      open_app_link: params?.openAppLink || APP_BASE_URL,
    },
    `Dormant user digest sent to ${params?.to}`
  );
}

export async function sendEventApprovedEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_APPROVED,
    params.to,
    'Your event was approved',
    {
      ...getCommonTemplateData(),
      coach_name: params.coachName || params.recipientName || 'Coach',
      event_name: params.eventName || params.eventTitle || 'Event',
      event_date: params.eventDate || '',
      event_time: params.eventTime || '',
      event_location: params.eventLocation || '',
      opponent: params.opponent || '',
      organization_name: params.organizationName || 'VarsityHub',
      approval_notes: params.approvalNotes || '',
      view_event_url: params.eventLink || `${APP_BASE_URL}/event-detail?id=${params.eventId || ''}`,
      manage_event_url: params.manageLink || `${APP_BASE_URL}/events`,
    },
    `Event approved email sent to ${params.to}`
  );
}

export async function sendEventCanceledEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_CANCELED,
    params.to,
    'Event canceled',
    {
      ...getCommonTemplateData(),
      recipient_name: params.recipientName || 'Team Member',
      event_name: params.eventName || params.eventTitle || 'Event',
      event_date: params.eventDate || '',
      event_time: params.eventTime || '',
      event_location: params.eventLocation || '',
      canceled_at: params.canceledAt || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      organization_name: params.organizationName || 'VarsityHub',
      cancel_reason: params.cancelReason || '',
      reschedule_info: params.rescheduleInfo || '',
      upcoming_events_link: params.upcomingEventsLink || `${APP_BASE_URL}/events`,
      contact_organizer_link: params.contactOrganizerLink || CUSTOMER_SERVICE_EMAIL,
    },
    `Event canceled email sent to ${params.to}`
  );
}

export async function sendEventDeniedEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_DENIED,
    params.to,
    'Event not approved',
    {
      ...getCommonTemplateData(),
      coach_name: params.coachName || params.recipientName || 'Coach',
      event_name: params.eventName || params.eventTitle || 'Event',
      denial_reason: params.denialReason || params.reason || '',
      submit_new_event_url: params.resubmitLink || `${APP_BASE_URL}/create-fan-event`,
      contact_support_url: params.supportLink || `mailto:${CUSTOMER_SERVICE_EMAIL}`,
      organization_name: params.organizationName || 'VarsityHub',
    },
    `Event denied email sent to ${params.to}`
  );
}

export async function sendEventReminderEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_REMINDER,
    params.to,
    'Event reminder',
    {
      ...getCommonTemplateData(),
      recipient_name: params.recipientName || 'Team Member',
      event_name: params.eventName || params.eventTitle || 'Event',
      event_date: params.eventDate || '',
      event_time: params.eventTime || '',
      event_location: params.eventLocation || '',
      opponent: params.opponent || '',
      organization_name: params.organizationName || 'VarsityHub',
      check_in_url: params.checkInLink || `${APP_BASE_URL}/event-detail?id=${params.eventId || ''}`,
      add_to_calendar_url: params.calendarLink || `${APP_BASE_URL}/event-detail?id=${params.eventId || ''}`,
      get_directions_url: params.directionsLink || `${APP_BASE_URL}/event-detail?id=${params.eventId || ''}`,
      preferences_url: params.preferencesLink || `${APP_BASE_URL}/settings`,
    },
    `Event reminder email sent to ${params.to}`
  );
}

export async function sendEventSubmissionReceivedEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_SUBMISSION_RECEIVED,
    params.to,
    'We received your event submission',
    {
      ...getCommonTemplateData(),
      coach_name: params.coachName || 'Coach',
      event_name: params.eventName || params.eventTitle || 'Event',
      event_date: params.eventDate || '',
      event_time: params.eventTime || '',
      event_location: params.eventLocation || '',
      submission_date: params.submissionDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      organization_name: params.organizationName || 'VarsityHub',
      status_link: params.statusLink || `${APP_BASE_URL}/events/my-events`,
      review_timeline_hours: params.reviewTimelineHours || 24,
    },
    `Event submission received email sent to ${params.to}`
  );
}

export async function sendEventUpdatedEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_UPDATED,
    params.to,
    'Event updated',
    {
      ...getCommonTemplateData(),
      recipient_name: params.recipientName || 'Team Member',
      event_name: params.eventName || params.eventTitle || 'Event',
      event_date: params.eventDate || '',
      updated_at: params.updatedAt || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      change_summary: params.changeSummary || params.changes || 'Event details have been updated',
      organization_name: params.organizationName || 'VarsityHub',
      event_detail_link: params.eventDetailLink || `${APP_BASE_URL}/event-detail?id=${params.eventId || ''}`,
      calendar_link: params.calendarLink || `${APP_BASE_URL}/event-detail?id=${params.eventId || ''}`,
    },
    `Event updated email sent to ${params.to}`
  );
}

export async function sendPaymentRequiredEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.PAYMENT_REQUIRED,
    params?.to,
    'Payment reminder',
    {
      ...getCommonTemplateData(),
      business_name: params?.businessName || '',
      total_cost: params?.totalCost || '',
      checkout_link: params?.checkoutLink || '',
    },
    `Payment required email sent to ${params?.to}`
  );
}

export async function sendPostHighlightEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.POST_HIGHLIGHT,
    params?.to,
    'Your post was highlighted',
    {
      ...getCommonTemplateData(),
      post_title: params?.postTitle || '',
    },
    `Post highlight email sent to ${params?.to}`
  );
}

export async function sendProfileCompletionNudgeEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.PROFILE_COMPLETION_NUDGE,
    params?.to,
    'Complete your profile',
    {
      ...getCommonTemplateData(),
      user_name: params?.userName || 'there',
      profile_edit_url: params?.profileEditUrl || APP_BASE_URL,
    },
    `Profile completion nudge sent to ${params?.to}`
  );
}

export async function sendReportResolutionEmail(params: any): Promise<boolean> {
  const isResolved = params.resolutionStatus === 'resolved';
  const templateId = isResolved ? TEMPLATE_IDS.REPORT_RESOLVED : TEMPLATE_IDS.REPORT_DISMISSED;

  return sendTemplateEmail(
    templateId,
    params.to,
    isResolved ? 'Report resolved' : 'Report dismissed',
    {
      ...getCommonTemplateData(),
      user_name: params.userName || 'User',
      report_id: params.reportId || '',
      report_type: params.reportType || '',
      resolution_status: params.resolutionStatus || 'resolved',
      resolution_reason: params.resolutionReason || '',
      appeal_url: params.appealUrl || `${APP_BASE_URL}/report-appeal?id=${params.reportId || ''}`,
      submit_date: params.submitDate || '',
      resolution_date: params.resolutionDate || new Date().toLocaleDateString(),
      report_detail_link: params.reportDetailLink || `${APP_BASE_URL}/reports/${params.reportId || ''}`,
    },
    `Report ${params.resolutionStatus || 'resolved'} email sent to ${params.to}`
  );
}

export async function sendRosterThresholdAlertEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ROSTER_THRESHOLD,
    params.to,
    'Roster Threshold Alert',
    {
      ...getCommonTemplateData(),
      coach_name: params.coachName || 'Coach',
      team_name: params.teamName || '',
      roster_count: params.rosterCount || 0,
      threshold_cost: params.thresholdCost || 0,
      manage_billing_url: params.manageBillingUrl || `${APP_BASE_URL}/settings/manage-subscription`,
    },
    `Roster threshold alert sent to ${params.to}`
  );
}

export async function sendSeasonWrapUpEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.SEASON_WRAP_UP,
    params?.to,
    'Season wrap-up',
    {
      ...getCommonTemplateData(),
      team_name: params?.teamName || '',
    },
    `Season wrap-up email sent to ${params?.to}`
  );
}

export async function sendStaffInvitationConfirmationEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.STAFF_MEMBER_JOINED,
    params.to,
    'Staff Member Joined',
    {
      ...getCommonTemplateData(),
      coach_name: params.coachName || 'Coach',
      invitee_name: params.inviteeName || '',
      invitee_email: params.inviteeEmail || '',
      team_name: params.teamName || '',
      manage_staff_url: params.manageStaffUrl || `${APP_BASE_URL}/team-hub`,
    },
    `Staff member joined confirmation sent to ${params.to}`
  );
}

export async function sendStaffInvitationEmail(params: any): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.TEAM_INVITE,
    params.to,
    'You have been invited to a team',
    {
      ...getCommonTemplateData(),
      recipient_name: params.inviteeName || '',
      team_name: params.teamName || '',
      org_name: params.organizationName || '',
      role: params.role || 'staff',
      inviter_name: params.inviterName || 'Coach',
      invite_url: params.inviteLink || `${APP_BASE_URL}/invites`,
    },
    `Staff invitation sent to ${params.to}`
  );
}

/**
 * Send verification email with 6-digit code
 * Uses SendGrid dynamic template
 */
export async function sendVerificationEmail(email: string, token: string, userName?: string): Promise<boolean> {
  const displayName = userName || 'VarsityHub User';

  return sendTemplateEmail(
    TEMPLATE_IDS.VERIFICATION,
    email,
    `${token} is your VarsityHub verification code`,
    {
      ...getCommonTemplateData(),
      verification_code: token,
      code: token,
      user_name: displayName,
      display_name: displayName,
      expires_in: '30 minutes',
    },
    `Verification email sent to ${email}`
  );
}

/**
 * Send password reset email with 6-digit code
 * Uses SendGrid dynamic template
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.PASSWORD_RESET,
    email,
    `${code} is your VarsityHub password reset code`,
    {
      ...getCommonTemplateData(),
      reset_code: code,
      code: code,
      expires_in: '30 minutes',
    },
    `Password reset email sent to ${email}`
  );
}

/**
 * Send password changed confirmation email
 * Uses SendGrid dynamic template
 */
export async function sendPasswordChangedEmail(email: string, userName?: string): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.PASSWORD_CHANGED,
    email,
    'Password Changed Successfully',
    {
      ...getCommonTemplateData(),
      user_name: userName || 'VarsityHub user',
      date: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
      email: email,
    },
    `Password changed email sent to ${email}`
  );
}

/**
 * Send team invite with personalized team branding
 * Now uses EmailService with retry logic
 */
export async function sendTeamInviteEmail(params: {
  to: string;
  teamName: string;
  recipientName?: string;
  organizationName?: string | null;
  role?: string;
  inviterName?: string;
  teamHeroUrl?: string;
  teamLogoUrl?: string;
  primaryColor?: string;
  inviteToken?: string;
}): Promise<boolean> {
  if (!TEMPLATE_IDS.TEAM_INVITE) {
    console.warn('[email] SendGrid team invite template not configured');
    return false;
  }

  const service = await getEmailService();
  if (!service || !service.isConfigured()) {
    console.warn('[email] Email service not configured');
    return false;
  }

  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'member';

  try {
    const result = await service.send({
      to: params.to,
      subject: `You've been invited to join ${params.teamName}`,
      templateId: TEMPLATE_IDS.TEAM_INVITE,
      templateData: {
        ...getCommonTemplateData(),
        recipient_name: params.recipientName || '',
        team_name: params.teamName,
        org_name: params.organizationName || '',
        role: prettyRole,
        inviter_name: params.inviterName || 'VarsityHub Coach',
        invite_url: params.inviteToken ? `${APP_BASE_URL}/invites?token=${params.inviteToken}` : `${APP_BASE_URL}/invites`,
        hero_image: params.teamHeroUrl || `${APP_BASE_URL}/default-team-hero.jpg`,
        logo_image: params.teamLogoUrl || `${APP_BASE_URL}/default-team-logo.jpg`,
        primary_color: params.primaryColor || '#2563EB',
      },
    });

    if (result.success) {
      debugLog(`✅ Team invite sent to ${params.to} for ${params.teamName}`);
      return true;
    } else {
      console.error('❌ Failed to send team invite:', result.error);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Failed to send team invite:', error);
    return false;
  }
}

/**
 * Helper function to send template-based emails using EmailService
 */
async function sendTemplateEmail(
  templateId: string,
  to: string,
  subject: string,
  templateData: Record<string, any>,
  logMessage: string
): Promise<boolean> {
  if (!templateId) {
    console.warn(`[email] Template ID not configured for: ${subject}`);
    return false;
  }

  const service = await getEmailService();
  if (!service || !service.isConfigured()) {
    console.warn('[email] Email service not configured');
    return false;
  }

  try {
    const result = await service.send({
      to,
      subject,
      templateId,
      templateData,
    });

    if (result.success) {
      debugLog(`✅ ${logMessage}`);
      return true;
    } else {
      console.error(`❌ Failed: ${logMessage}`, result.error);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${logMessage}`, error);
    return false;
  }
}

/**
 * Send organization invite with personalized org branding
 * Now uses EmailService with retry logic
 */
export async function sendOrganizationInviteEmail(params: {
  to: string;
  organizationName: string;
  role?: string;
  inviterName?: string;
  orgLogoUrl?: string;
  primaryColor?: string;
  inviteToken?: string;
}): Promise<boolean> {
  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'member';

  return sendTemplateEmail(
    TEMPLATE_IDS.ORG_INVITE,
    params.to,
    `You've been invited to join ${params.organizationName}`,
    {
      ...getCommonTemplateData(),
      org_name: params.organizationName,
      role: prettyRole,
      inviter_name: params.inviterName || 'VarsityHub Admin',
      invite_url: params.inviteToken ? `${APP_BASE_URL}/invites?token=${params.inviteToken}` : `${APP_BASE_URL}/invites`,
      logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
      primary_color: params.primaryColor || '#2563EB',
    },
    `Organization invite sent to ${params.to} for ${params.organizationName}`
  );
}

/**
 * Send abuse report notification to customer service
 * Now uses EmailService with retry logic
 */
export async function sendAbuseReportNotification(params: {
  reporterName: string;
  reporterEmail: string;
  subject: string;
  message: string;
  userId?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ABUSE_REPORT,
    CUSTOMER_SERVICE_EMAIL,
    'New Abuse Report',
    {
      ...getCommonTemplateData(),
      reporter_name: params.reporterName,
      reporter_email: params.reporterEmail,
      subject: params.subject,
      message: params.message,
      user_id: params.userId || '',
      submitted_at: new Date().toLocaleString(),
    },
    `Abuse report sent to customer service from ${params.reporterEmail}`
  );
}

/**
 * Send join request notification to organization admin
 * Now uses EmailService with retry logic
 */
export async function sendJoinRequestToAdmin(params: {
  adminEmail: string;
  adminName: string;
  requesterName: string;
  organizationName: string;
  message?: string;
  requestId: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.JOIN_REQUEST_ADMIN,
    params.adminEmail,
    `New join request for ${params.organizationName}`,
    {
      ...getCommonTemplateData(),
      admin_name: params.adminName,
      requester_name: params.requesterName,
      org_name: params.organizationName,
      message: params.message || '',
      approve_url: `${APP_BASE_URL}/organizations/join-requests/${params.requestId}/approve`,
      deny_url: `${APP_BASE_URL}/organizations/join-requests/${params.requestId}/deny`,
      logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
    },
    `Join request notification sent to ${params.adminEmail}`
  );
}

/**
 * Send approval notification to user
 */
export async function sendJoinRequestApproved(params: {
  userEmail: string;
  userName: string;
  organizationName: string;
  adminName: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.JOIN_REQUEST_APPROVED) {
    console.warn('[email] SendGrid join request approved template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.userEmail,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.JOIN_REQUEST_APPROVED,
      dynamicTemplateData: {
        ...getCommonTemplateData(),
        user_name: params.userName,
        org_name: params.organizationName,
        admin_name: params.adminName,
        org_url: `${APP_BASE_URL}/organizations`,
        logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
      },
    });
    debugLog(`✅ Join request approved notification sent to ${params.userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send join request approved notification:', error);
    return false;
  }
}

/**
 * Send denial notification to user
 */
export async function sendJoinRequestDenied(params: {
  userEmail: string;
  userName: string;
  organizationName: string;
  reason?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.JOIN_REQUEST_DENIED) {
    console.warn('[email] SendGrid join request denied template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.userEmail,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.JOIN_REQUEST_DENIED,
      dynamicTemplateData: {
        ...getCommonTemplateData(),
        user_name: params.userName,
        org_name: params.organizationName,
        reason: params.reason || '',
        logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
      },
    });
    debugLog(`✅ Join request denied notification sent to ${params.userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send join request denied notification:', error);
    return false;
  }
}

/**
 * Organization approval email (sent when admin approves join request)
 */
export async function sendOrganizationApprovalEmail(params: {
  to: string;
  organizationName: string;
  dashboardLink?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.ORG_APPROVAL) {
    console.warn('[email] SendGrid org approval template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.ORG_APPROVAL,
      dynamicTemplateData: {
        ...getCommonTemplateData(),
        org_name: params.organizationName,
        dashboard_url: params.dashboardLink || `${APP_BASE_URL}/team-hub`,
        logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
      },
    });
    debugLog(`✅ Organization approval email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send organization approval email:', error);
    return false;
  }
}

/**
 * Organization denial email (sent when admin denies join request)
 */
export async function sendOrganizationDenialEmail(params: {
  to: string;
  organizationName: string;
  reason?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.ORG_DENIAL) {
    console.warn('[email] SendGrid org denial template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.ORG_DENIAL,
      dynamicTemplateData: {
        ...getCommonTemplateData(),
        org_name: params.organizationName,
        reason: params.reason || '',
        logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
      },
    });
    debugLog(`✅ Organization denial email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send organization denial email:', error);
    return false;
  }
}


/**
 * Content moderation outcomes
 */
export async function sendContentModerationEmail(params: {
  to: string;
  action: 'removed' | 'flagged' | 'restored';
  postId?: string;
  reason?: string;
  nextSteps?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.CONTENT_MODERATION) {
    console.warn('[email] SendGrid content moderation template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.CONTENT_MODERATION,
      dynamicTemplateData: {
        ...getCommonTemplateData(),
        action: params.action,
        post_id: params.postId || '',
        reason: params.reason || '',
        next_steps: params.nextSteps || "If you believe this is a mistake, reply to this email and we'll review it.",
      },
    });
    debugLog(`✅ Content moderation email sent to ${params.to} (action: ${params.action})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send content moderation email:', error);
    return false;
  }
}

/**
 * Billing notices (trial ending, payment succeeded/failed, subscription canceled/renewed)
 */
export async function sendBillingNoticeEmail(params: {
  to: string;
  type: 'trial_ending' | 'payment_succeeded' | 'payment_failed' | 'subscription_canceled' | 'subscription_renewed';
  planName?: string;
  amount?: string;
  manageLink?: string;
  teamName?: string;
  orgName?: string;
  perks?: string[];
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.BILLING_NOTICE) {
    console.warn('[email] SendGrid billing notice template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.BILLING_NOTICE,
      dynamicTemplateData: {
        ...getCommonTemplateData(),
        notice_type: params.type,
        plan_name: params.planName || 'VarsityHub Subscription',
        amount: params.amount || '',
        manage_url: params.manageLink || `${APP_BASE_URL}/settings/manage-subscription`,
        team_name: params.teamName || '',
        org_name: params.orgName || '',
        perks: params.perks || [],
      },
    });
    debugLog(`✅ Billing notice sent to ${params.to} (type: ${params.type})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send billing notice:', error);
    return false;
  }
}

/**
 * Format currency from cents to dollars
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Send end-of-day transaction report
 */
// Account Warning Email
export async function sendAccountWarningEmail(params: {
  to: string;
  userName: string;
  warningReason: string;
  offenseCount?: number;
  nextSteps?: string;
  supportUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ACCOUNT_WARNING,
    params.to,
    'Account Warning',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      warning_reason: params.warningReason,
      offense_count: params.offenseCount || 1,
      next_steps: params.nextSteps || 'Please review our community guidelines to avoid further action.',
      support_url: params.supportUrl || `mailto:${CUSTOMER_SERVICE_EMAIL}`,
    },
    `Account warning email sent to ${params.to}`
  );
}

// Content Removed Email
export async function sendContentRemovedEmail(params: {
  to: string;
  userName: string;
  contentType: string;
  contentTitle?: string;
  removalReason: string;
  appealUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.CONTENT_REMOVED,
    params.to,
    'Content Removed',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      content_type: params.contentType,
      content_title: params.contentTitle || '',
      removal_reason: params.removalReason,
      appeal_url: params.appealUrl || `${APP_BASE_URL}/support`,
    },
    `Content removed email sent to ${params.to}`
  );
}

// Account Suspension Email (7 days)
export async function sendAccountSuspension7DaysEmail(params: {
  to: string;
  userName: string;
  suspensionReason: string;
  suspensionEndDate: string;
  appealUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ACCOUNT_SUSPENSION_7_DAYS,
    params.to,
    'Account Suspended',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      suspension_reason: params.suspensionReason,
      suspension_end_date: params.suspensionEndDate,
      appeal_url: params.appealUrl || `${APP_BASE_URL}/support`,
    },
    `Account suspension (7 days) email sent to ${params.to}`
  );
}

// Account Suspension Email (45 days)
export async function sendAccountSuspension45DaysEmail(params: {
  to: string;
  userName: string;
  suspensionReason: string;
  suspensionEndDate: string;
  appealUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ACCOUNT_SUSPENSION_45_DAYS,
    params.to,
    'Account Suspended',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      suspension_reason: params.suspensionReason,
      suspension_end_date: params.suspensionEndDate,
      appeal_url: params.appealUrl || `${APP_BASE_URL}/support`,
    },
    `Account suspension (45 days) email sent to ${params.to}`
  );
}

// Permanent Ban Email
export async function sendAccountPermanentBanEmail(params: {
  to: string;
  userName: string;
  banReason: string;
  appealUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ACCOUNT_PERMANENT_BAN,
    params.to,
    'Account Permanently Banned',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      ban_reason: params.banReason,
      appeal_url: params.appealUrl || `${APP_BASE_URL}/support`,
    },
    `Account permanent ban email sent to ${params.to}`
  );
}

// Login from New Device Email
export async function sendLoginFromNewDeviceEmail(params: {
  to: string;
  userName: string;
  deviceType: string;
  deviceLocation?: string;
  loginTime: string;
  secureAccountUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.LOGIN_NEW_DEVICE,
    params.to,
    'Login from New Device',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      device_type: params.deviceType,
      device_location: params.deviceLocation || 'Unknown location',
      login_time: params.loginTime,
      secure_account_url: params.secureAccountUrl || `${APP_BASE_URL}/settings/reset-password`,
    },
    `Login from new device email sent to ${params.to}`
  );
}

// Event RSVP Confirmed Email
export async function sendEventRsvpConfirmedEmail(params: {
  to: string;
  userName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  eventLocation?: string;
  eventLink?: string;
  calendarLink?: string;
  cancelRsvpLink?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.EVENT_RSVP_CONFIRMED,
    params.to,
    'RSVP Confirmed',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      event_name: params.eventName,
      event_date: params.eventDate,
      event_time: params.eventTime || '',
      event_location: params.eventLocation || '',
      event_detail_link: params.eventLink || `${APP_BASE_URL}/event-detail`,
      calendar_link: params.calendarLink || `${APP_BASE_URL}/event-detail`,
      cancel_rsvp_link: params.cancelRsvpLink || `${APP_BASE_URL}/event-detail`,
    },
    `Event RSVP confirmed email sent to ${params.to}`
  );
}

// Payment Failed Email
export async function sendPaymentFailedEmail(params: {
  to: string;
  userName: string;
  amount: string;
  paymentDate: string;
  retryUrl?: string;
  updatePaymentMethodUrl?: string;
  supportUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.PAYMENT_FAILED,
    params.to,
    'Payment Failed',
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      amount: params.amount,
      payment_date: params.paymentDate,
      retry_url: params.retryUrl || `${APP_BASE_URL}/settings/manage-subscription`,
      update_payment_method_url: params.updatePaymentMethodUrl || `${APP_BASE_URL}/settings/manage-subscription`,
      support_url: params.supportUrl || `mailto:${CUSTOMER_SERVICE_EMAIL}`,
    },
    `Payment failed email sent to ${params.to}`
  );
}

export async function sendEndOfDayTransactionReport(params: {
  to: string;
  report: {
    date: string;
    summary: {
      totalTransactions: number;
      completedTransactions: number;
      totalRevenueCents: number;
      totalFeesCents: number;
      totalDiscountsCents: number;
      netRevenueCents: number;
    };
    breakdownByType: Array<{
      type: string;
      count: number;
      revenueCents: number;
      feesCents: number;
      discountsCents: number;
      netCents: number;
    }>;
    breakdownByStatus: Array<{
      status: string;
      count: number;
    }>;
  };
}): Promise<boolean> {
  const { report } = params;
  const { summary, breakdownByType, breakdownByStatus } = report;

  // Format transaction type for display
  const formatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  // Build HTML report
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 10px; }
    h2 { color: #1F2937; margin-top: 30px; }
    .summary-box { background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    .summary-row:last-child { border-bottom: none; font-weight: bold; font-size: 1.1em; }
    .label { color: #6B7280; }
    .value { font-weight: 600; color: #111827; }
    .value.revenue { color: #059669; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background: #2563EB; color: white; padding: 12px; text-align: left; }
    .table td { padding: 10px; border-bottom: 1px solid #E5E7EB; }
    .table tr:hover { background: #F9FAFB; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 End-of-Day Transaction Report</h1>
    <p><strong>Date:</strong> ${report.date}</p>

    <div class="summary-box">
      <h2>Summary</h2>
      <div class="summary-row">
        <span class="label">Total Transactions:</span>
        <span class="value">${summary.totalTransactions}</span>
      </div>
      <div class="summary-row">
        <span class="label">Completed:</span>
        <span class="value">${summary.completedTransactions}</span>
      </div>
      <div class="summary-row">
        <span class="label">Gross Revenue:</span>
        <span class="value revenue">${formatCurrency(summary.totalRevenueCents)}</span>
      </div>
      <div class="summary-row">
        <span class="label">Stripe Fees:</span>
        <span class="value">${formatCurrency(summary.totalFeesCents)}</span>
      </div>
      <div class="summary-row">
        <span class="label">Discounts:</span>
        <span class="value">${formatCurrency(summary.totalDiscountsCents)}</span>
      </div>
      <div class="summary-row">
        <span class="label">Net Revenue:</span>
        <span class="value revenue">${formatCurrency(summary.netRevenueCents)}</span>
      </div>
    </div>

    ${breakdownByType.length > 0 ? `
    <h2>Breakdown by Transaction Type</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Count</th>
          <th>Revenue</th>
          <th>Fees</th>
          <th>Discounts</th>
          <th>Net</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownByType.map((b) => `
        <tr>
          <td>${formatType(b.type)}</td>
          <td>${b.count}</td>
          <td>${formatCurrency(b.revenueCents)}</td>
          <td>${formatCurrency(b.feesCents)}</td>
          <td>${formatCurrency(b.discountsCents)}</td>
          <td><strong>${formatCurrency(b.netCents)}</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${breakdownByStatus.length > 0 ? `
    <h2>Breakdown by Status</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownByStatus.map((s) => `
        <tr>
          <td>${s.status}</td>
          <td>${s.count}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    <div class="footer">
      <p>This is an automated daily report from VarsityHub.</p>
      <p>Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `;

  // Build plain text version
  const text = `
END-OF-DAY TRANSACTION REPORT
Date: ${report.date}

SUMMARY
Total Transactions: ${summary.totalTransactions}
Completed: ${summary.completedTransactions}
Gross Revenue: ${formatCurrency(summary.totalRevenueCents)}
Stripe Fees: ${formatCurrency(summary.totalFeesCents)}
Discounts: ${formatCurrency(summary.totalDiscountsCents)}
Net Revenue: ${formatCurrency(summary.netRevenueCents)}

${breakdownByType.length > 0 ? `
BREAKDOWN BY TYPE
${breakdownByType.map((b) => `${formatType(b.type)}: ${b.count} transactions, ${formatCurrency(b.revenueCents)} revenue, ${formatCurrency(b.netCents)} net`).join('\n')}
` : ''}

${breakdownByStatus.length > 0 ? `
BREAKDOWN BY STATUS
${breakdownByStatus.map((s) => `${s.status}: ${s.count}`).join('\n')}
` : ''}

Generated at ${new Date().toLocaleString()}
This is an automated daily report from VarsityHub.
  `;

  const subject = `📊 Daily Transaction Report - ${report.date}`;

  try {
    await sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
    debugLog(`✅ End-of-day transaction report sent to ${params.to} for ${report.date}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send end-of-day transaction report:', error);
    return false;
  }
}

export async function sendFounderMetricsEmail(params: {
  to: string;
  report: FounderMetricsReport;
}): Promise<boolean> {
  const { report } = params;
  const { summary, daily, dateRange } = report;

  const formatRow = (rows: Array<{ date: string; count: number }>) =>
    rows.map((row) => `<tr><td>${row.date}</td><td>${row.count}</td></tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; }
    .container { max-width: 720px; margin: 0 auto; padding: 20px; }
    h1 { color: #0F172A; border-bottom: 2px solid #0F172A; padding-bottom: 10px; }
    .summary { background: #F8FAFC; padding: 16px; border-radius: 8px; }
    .summary p { margin: 6px 0; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th { text-align: left; background: #0F172A; color: #fff; padding: 8px; }
    .table td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
    .section { margin-top: 24px; }
    .footer { margin-top: 28px; color: #64748B; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Daily Founder Metrics</h1>
    <p><strong>Range:</strong> ${dateRange.start} to ${dateRange.end}</p>

    <div class="summary">
      <p><strong>Total users:</strong> ${summary.totalUsers}</p>
      <p><strong>Total reports:</strong> ${summary.totalReports}</p>
      <p><strong>Total messages:</strong> ${summary.totalMessages}</p>
      <p><strong>New users today:</strong> ${summary.newUsersToday}</p>
      <p><strong>Reports today:</strong> ${summary.reportsToday}</p>
      <p><strong>Messages today:</strong> ${summary.messagesToday}</p>
      <p><strong>New users (last ${summary.days} days):</strong> ${summary.newUsersLastDays}</p>
      <p><strong>Reports (last ${summary.days} days):</strong> ${summary.reportsLastDays}</p>
      <p><strong>Messages (last ${summary.days} days):</strong> ${summary.messagesLastDays}</p>
    </div>

    <div class="section">
      <h2>Daily New Users</h2>
      <table class="table">
        <thead><tr><th>Date</th><th>Count</th></tr></thead>
        <tbody>${formatRow(daily.users)}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>Daily Reports</h2>
      <table class="table">
        <thead><tr><th>Date</th><th>Count</th></tr></thead>
        <tbody>${formatRow(daily.reports)}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>Daily Messages</h2>
      <table class="table">
        <thead><tr><th>Date</th><th>Count</th></tr></thead>
        <tbody>${formatRow(daily.messages)}</tbody>
      </table>
    </div>

    <div class="footer">
      <p>This is an automated daily report from VarsityHub.</p>
      <p>Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
DAILY FOUNDER METRICS
Range: ${dateRange.start} to ${dateRange.end}

SUMMARY
Total users: ${summary.totalUsers}
Total reports: ${summary.totalReports}
Total messages: ${summary.totalMessages}
New users today: ${summary.newUsersToday}
Reports today: ${summary.reportsToday}
Messages today: ${summary.messagesToday}
New users (last ${summary.days} days): ${summary.newUsersLastDays}
Reports (last ${summary.days} days): ${summary.reportsLastDays}
Messages (last ${summary.days} days): ${summary.messagesLastDays}

DAILY NEW USERS
${daily.users.map((row) => `${row.date}: ${row.count}`).join('\n')}

DAILY REPORTS
${daily.reports.map((row) => `${row.date}: ${row.count}`).join('\n')}

DAILY MESSAGES
${daily.messages.map((row) => `${row.date}: ${row.count}`).join('\n')}

Generated at ${new Date().toLocaleString()}
This is an automated daily report from VarsityHub.
  `;

  const subject = `📈 Daily Founder Metrics - ${dateRange.end}`;

  try {
    await sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
    debugLog(`✅ Founder metrics email sent to ${params.to} (${dateRange.end})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send founder metrics email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(to: string, name?: string): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.WELCOME,
    to,
    'Welcome to VarsityHub!',
    {
      ...getCommonTemplateData(),
      user_name: name || 'there',
    },
    `Welcome email sent to ${to}`
  );
}
