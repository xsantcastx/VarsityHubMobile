import type { FounderMetricsReport } from './founderMetrics.js';
import type { EmailResult } from '../services/email/types.js';
import type { EmailService } from '../services/email/EmailService.js';
import sgMail from '@sendgrid/mail';
import * as Sentry from '@sentry/node';
import escapeHtml from 'escape-html';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;

let emailServicePromise: Promise<EmailService> | null = null;
const getEmailService = async (): Promise<EmailService | null> => {
  if (isTestEnv) return null;
  if (!emailServicePromise) {
    emailServicePromise = import('../services/email/service.js').then(mod => mod.getEmailService());
  }
  return emailServicePromise;
};

// Legacy constants for backward compatibility
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');
const API_BASE_URL = (
  process.env.API_BASE_URL || 'https://api-production-8ac3.up.railway.app'
).replace(/\/$/, '');
const CUSTOMER_SERVICE_EMAIL = process.env.CUSTOMER_SERVICE_EMAIL || 'support@varsityhub.app';

// Common template data (social links, privacy policy, etc.) added to all emails
const getCommonTemplateData = () => ({
  logo_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png',
  footer_logo_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png',
  hero_image_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png',
  privacy_policy_url: 'https://limeprod.com/VarsityHubPrivacy',
  community_guidelines_url: 'https://limeprod.com/VarsityHubPrivacy',
  instagram_url: 'https://www.instagram.com/varsityhubapp/',
  tiktok_url: 'https://www.tiktok.com/@varsityhubapp',
  youtube_url: 'https://www.youtube.com/@varsityhubapp',
  facebook_url: 'https://www.facebook.com/varsityhubapp/',
  x_url: 'https://x.com/varsityhub00',
  website_url: 'https://limeprod.com',
  communityGuidelinesUrl: 'https://limeprod.com/VarsityHubPrivacy',
  privacyPolicyUrl: 'https://limeprod.com/VarsityHubPrivacy',
  customer_service_email: CUSTOMER_SERVICE_EMAIL,
});

// Approved SendGrid template IDs.
// Per product policy, only templates present in the Railway-approved catalog may be used.
const TEMPLATE_IDS = {
  // Auth & Security
  VERIFICATION:
    process.env.SENDGRID_VERIFICATION_TEMPLATE_ID ||
    process.env.SENDGRID_USER_CONFIRMATION_TEMPLATE_ID ||
    '',
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',

  // Team & Organization
  TEAM_INVITE: process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID || '',
  ORG_INVITE: process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID || '',
  JOIN_REQUEST_ADMIN:
    process.env.SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID ||
    process.env.SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID ||
    '',
  JOIN_REQUEST_APPROVED: process.env.SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID || '',
  JOIN_REQUEST_DENIED: process.env.SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID || '',

  // Events
  EVENT_APPROVED: process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID || '',
  EVENT_DENIED: process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID || '',
  EVENT_CANCELED:
    process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID ||
    process.env.SENDGRID_EVENT_CANCELLATION_TEMPLATE_ID ||
    '',

  // Billing
  PAYMENT_FAILED: process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID || '',
  SUBSCRIPTION_EXPIRING: process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID || '',

  // Ads
  AD_PENDING_REVIEW: process.env.SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID || '',
  AD_APPROVED: process.env.SENDGRID_AD_APPROVED_TEMPLATE_ID || '',
  AD_REJECTED: process.env.SENDGRID_AD_REJECTED_TEMPLATE_ID || '',

  // Organization approval/rejection (sent to org owner after admin action)
  ORG_APPROVED: process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID || '',
  ORG_DENIED: process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID || '',

  // Admin confirmation (sent to admin after they approve/reject)
  ADMIN_ACTION_CONFIRMATION: process.env.SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID || '',
};

type TemplateKey = keyof typeof TEMPLATE_IDS;

// Critical for launch — server exits if missing in production
const REQUIRED_TEMPLATE_KEYS: TemplateKey[] = [
  'VERIFICATION',
  'PASSWORD_RESET',
  'TEAM_INVITE',
  'ORG_INVITE',
];

// All templates are now mandatory — no recommended list
const RECOMMENDED_TEMPLATE_KEYS: TemplateKey[] = [];

export function isSendGridConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

export function getMissingEmailTemplates(
  required: TemplateKey[] = REQUIRED_TEMPLATE_KEYS
): string[] {
  return required.filter(key => !TEMPLATE_IDS[key]).map(key => key.toLowerCase());
}

export function getMissingRecommendedTemplates(): string[] {
  return RECOMMENDED_TEMPLATE_KEYS.filter(key => !TEMPLATE_IDS[key]).map(key => key.toLowerCase());
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
    console.error(
      `[email] ⛔ ${missing.length} critical SendGrid template IDs missing: ${missing.join(', ')}`
    );
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[email] FATAL: Critical email templates must be configured in production. Set them in Railway environment variables.'
      );
      process.exit(1);
    }
    console.error(
      '[email] Emails using these templates will silently fail. Set them in Railway environment variables.'
    );
  }

  const missingRecommended = getMissingRecommendedTemplates();
  if (missingRecommended.length) {
    console.warn(
      `[email] ⚠️  ${missingRecommended.length} recommended SendGrid template IDs missing: ${missingRecommended.join(', ')}`
    );
  }

  return result;
}

type BasicEmail = { to: string; subject: string; text?: string; html?: string };

const formatLines = (lines: Array<string | undefined | null>) =>
  lines.filter(line => Boolean(line && String(line).trim().length)).join('\n');

function blockUnapprovedEmail(emailType: string, context?: Record<string, unknown>): false {
  const message = `[email] Blocked unapproved email type: ${emailType}`;
  console.warn(message, context || {});
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(message, {
      level: 'warning',
      extra: context,
    });
  }
  return false;
}

/**
 * Generic email sending is blocked by policy.
 * Only approved SendGrid templates may be sent.
 */
export async function sendEmail({ to, subject, text, html }: BasicEmail): Promise<boolean> {
  return blockUnapprovedEmail('GENERIC_EMAIL', {
    to,
    subject,
    hasText: Boolean(text),
    hasHtml: Boolean(html),
  });
}

// Removed non-mandatory email functions (sendSubscriptionExpiringEmail, sendAccountRecoveryEmail,
// sendAdGoesLiveEmail, sendAdPaymentConfirmedEmail)

export async function sendAdPendingReviewEmail(params: {
  to: string;
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
  zipCode?: string;
  bannerUrl?: string;
  adId?: string;
  approveToken?: string;
  rejectToken?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.AD_PENDING_REVIEW;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID — admin will not receive ad review email');
    return false;
  }

  const approveUrl = params.approveToken
    ? `${API_BASE_URL}/ads/${params.adId}/approve?token=${params.approveToken}`
    : '';
  const rejectUrl = params.rejectToken
    ? `${API_BASE_URL}/ads/${params.adId}/reject?token=${params.rejectToken}`
    : '';

  return sendTemplateEmail(
    templateId,
    params.to,
    `Ad Pending Review: ${params.businessName || 'New Ad'}`,
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || 'Unknown Business',
      contact_name: params.contactName || '',
      contact_email: params.contactEmail || '',
      zip_code: params.zipCode || '',
      ad_id: params.adId || '',
      banner_url: params.bannerUrl || '',
      approve_url: approveUrl,
      reject_url: rejectUrl,
    },
    `Ad pending review email sent to ${params.to} for ad ${params.adId}`
  );
}

export async function sendAbuseReportEmail(params: {
  to: string;
  reporterName?: string;
  reporterEmail?: string;
  reportedContentType: string;
  reportedContentId: string;
  reportReason: string;
  reportDetails?: string;
  contentContext?: Record<string, any>;
  reportId?: string;
}): Promise<boolean> {
  return blockUnapprovedEmail('ABUSE_REPORT', {
    to: params.to,
    reportId: params.reportId,
    reportedContentId: params.reportedContentId,
  });
}

export async function sendAdApprovedEmail(params: {
  to: string;
  businessName?: string;
  note?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.AD_APPROVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_AD_APPROVED_TEMPLATE_ID — advertiser will not receive approval email');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    `Your ad for "${params.businessName || 'your business'}" has been approved`,
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || 'your business',
      admin_note: params.note || '',
      app_url: APP_BASE_URL,
    },
    `Ad approved email sent to ${params.to}`
  );
}

export async function sendAdRejectedEmail(params: {
  to: string;
  businessName?: string;
  reason?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.AD_REJECTED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_AD_REJECTED_TEMPLATE_ID — advertiser will not receive rejection email');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    `Ad update for "${params.businessName || 'your business'}"`,
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || 'your business',
      rejection_reason: params.reason || '',
      support_email: CUSTOMER_SERVICE_EMAIL,
      app_url: APP_BASE_URL,
    },
    `Ad rejected email sent to ${params.to}`
  );
}

// sendDormantUserDigestEmail removed — non-mandatory

export async function sendEventApprovedEmail(params: any): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_APPROVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_APPROVED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
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

export async function sendEventCanceledEmail(params: {
  to: string;
  recipientName?: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  eventId?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_CANCELED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_CANCELED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    `"${params.eventName || 'Event'}" was cancelled`,
    {
      ...getCommonTemplateData(),
      recipient_name: params.recipientName || 'there',
      event_name: params.eventName || 'Event',
      event_date: params.eventDate || '',
      event_time: params.eventTime || '',
      event_location: params.eventLocation || '',
      view_event_url: `${APP_BASE_URL}/event/${params.eventId || ''}`,
    },
    `Event cancelled email sent to ${params.to}`
  );
}

export async function sendEventDeniedEmail(params: any): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_DENIED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_DENIED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
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

// sendEventReminderEmail removed — non-mandatory engagement email

// sendEventSubmissionReceivedEmail removed — non-mandatory receipt email
// sendEventUpdatedEmail removed — non-mandatory transactional email

// Non-mandatory email functions removed:
// - sendReportResolutionEmail
// - sendRosterThresholdAlertEmail
// - sendStaffInvitationConfirmationEmail
// - sendStaffInvitationEmail

/**
 * Send verification email with 6-digit code
 * Uses SendGrid dynamic template
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  userName?: string
): Promise<boolean> {
  const displayName = userName || 'VarsityHub User';
  const subject = `${token} is your VarsityHub verification code`;
  const templateId = TEMPLATE_IDS.VERIFICATION;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_VERIFICATION_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    email,
    subject,
    {
      ...getCommonTemplateData(),
      subject: subject,
      token: token,
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
  const subject = `${code} is your VarsityHub password reset code`;
  const resetUrl = `varsityhubmobile://reset-password?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
  const templateId = TEMPLATE_IDS.PASSWORD_RESET;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_PASSWORD_RESET_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    email,
    subject,
    {
      ...getCommonTemplateData(),
      subject: subject,
      reset_code: code,
      code: code,
      expires_in: '30 minutes',
      reset_url: resetUrl,
      action_url: resetUrl,
    },
    `Password reset email sent to ${email}`
  );
}

// sendPasswordChangedEmail removed — non-mandatory security notification

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
  const prettyRole =
    params.role?.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) || 'member';
  const inviterName = params.inviterName || 'VarsityHub Coach';
  const subject = `You've been invited to join ${params.teamName}`;

  return sendTemplateEmail(
    TEMPLATE_IDS.TEAM_INVITE,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      recipientName: params.recipientName || '',
      teamName: params.teamName,
      organizationName: params.organizationName || '',
      inviterName: inviterName,
      role: prettyRole,
      expiresIn: '7 days',
      acceptLink: params.inviteToken
        ? `${APP_BASE_URL}/invites?token=${params.inviteToken}`
        : `${APP_BASE_URL}/invites`,
      declineLink: `${APP_BASE_URL}/invites`,
      team_hero_url: params.teamHeroUrl || `${APP_BASE_URL}/default-team-hero.jpg`,
      team_logo_url: params.teamLogoUrl || '',
      primary_color: params.primaryColor || '#2563EB',
    },
    `Team invite sent to ${params.to} for ${params.teamName}`
  );
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
    // v1.0.2 audit fix: missing template IDs in production cause approval emails to silently drop.
    // Log at error level so Railway + Sentry surface these loudly.
    const msg = `[email] Template ID not configured for: ${subject}`;
    if (process.env.NODE_ENV === 'production') {
      console.error(msg);
      Sentry.captureMessage(msg, 'error');
    } else {
      console.warn(msg);
      Sentry.captureMessage(msg, 'warning');
    }
    return false;
  }

  const service = await getEmailService();
  if (!service || !service.isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(
        `[email] Email service not configured in production — template email dropped: ${logMessage}`
      );
      console.error(err.message);
      Sentry.captureException(err, { extra: { to, subject, logMessage } });
    } else {
      console.warn('[email] Email service not configured');
    }
    return false;
  }

  try {
    // v1.0.2 audit fix: every template email gets a Reply-To so customer replies
    // don't bounce into the noreply void. Override-able via SUPPORT_REPLY_TO env var.
    const replyTo = process.env.SUPPORT_REPLY_TO || 'support@varsityhub.app';
    const result = await service.send({
      to,
      subject,
      templateId,
      templateData,
      replyTo,
    });

    if (result.success) {
      console.log(`✅ ${logMessage}`);
      return true;
    } else {
      console.error(`❌ Failed: ${logMessage}`, result.error);
      Sentry.captureException(result.error ?? new Error(`Email send failed: ${logMessage}`));
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${logMessage}`, error);
    Sentry.captureException(error);
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
  recipientName?: string;
  role?: string;
  inviterName?: string;
  orgLogoUrl?: string;
  primaryColor?: string;
  inviteToken?: string;
}): Promise<boolean> {
  const prettyRole =
    params.role?.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) || 'Member';

  return sendTemplateEmail(
    TEMPLATE_IDS.ORG_INVITE,
    params.to,
    `You've been invited to join ${params.organizationName}`,
    {
      ...getCommonTemplateData(),
      recipientName: params.recipientName || '',
      organizationName: params.organizationName,
      teamName: '',
      role: prettyRole,
      inviterName: params.inviterName || 'VarsityHub Admin',
      acceptLink: params.inviteToken
        ? `${APP_BASE_URL}/invites?token=${params.inviteToken}`
        : `${APP_BASE_URL}/invites`,
      declineLink: `${APP_BASE_URL}/invites`,
      expiresIn: '7 days',
      org_logo_url: params.orgLogoUrl || '',
      primary_color: params.primaryColor || '#2563EB',
    },
    `Organization invite sent to ${params.to} for ${params.organizationName}`
  );
}

// Non-mandatory email functions removed:
// - sendAbuseReportNotification (duplicate of sendAbuseReportEmail)
// - sendJoinRequestToAdmin, sendJoinRequestApproved, sendJoinRequestDenied (deprecated)
// - sendOrganizationApprovalEmail, sendOrganizationDenialEmail (not used in approval flow)
// - sendContentModerationEmail (non-mandatory moderation email)

/**
 * Billing emails are restricted to approved templates only.
 */
export async function sendBillingNoticeEmail(params: {
  to: string;
  user_name?: string;
  type:
    | 'trial_ending'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'subscription_canceled'
    | 'subscription_renewed';
  planName?: string;
  amount?: string;
  manageLink?: string;
  teamName?: string;
  orgName?: string;
  perks?: string[];
}): Promise<boolean> {
  if (params.type === 'payment_failed') {
    const templateId = TEMPLATE_IDS.PAYMENT_FAILED;
    if (!templateId) {
      console.error('[email] Missing SENDGRID_PAYMENT_FAILED_TEMPLATE_ID');
      return false;
    }

    return sendTemplateEmail(
      templateId,
      params.to,
      'Payment Failed — VarsityHub',
      {
        ...getCommonTemplateData(),
        user_name: params.user_name || '',
        plan_name: params.planName || 'VarsityHub Subscription',
        amount: params.amount || '',
        manage_subscription_url:
          params.manageLink || `${APP_BASE_URL}/settings/manage-subscription`,
        team_name: params.teamName || '',
        org_name: params.orgName || '',
      },
      `Payment failed email sent to ${params.to}`
    );
  }

  if (params.type === 'trial_ending') {
    const templateId = TEMPLATE_IDS.SUBSCRIPTION_EXPIRING;
    if (!templateId) {
      console.error('[email] Missing SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID');
      return false;
    }

    return sendTemplateEmail(
      templateId,
      params.to,
      'Subscription Expiring — VarsityHub',
      {
        ...getCommonTemplateData(),
        user_name: params.user_name || '',
        plan_name: params.planName || 'VarsityHub Subscription',
        manage_subscription_url:
          params.manageLink || `${APP_BASE_URL}/settings/manage-subscription`,
        team_name: params.teamName || '',
        org_name: params.orgName || '',
      },
      `Subscription expiring email sent to ${params.to}`
    );
  }

  return blockUnapprovedEmail('BILLING_NOTICE', {
    to: params.to,
    billingType: params.type,
  });
}

/**
 * Format currency from cents to dollars
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Non-mandatory email functions removed:
// - sendAccountWarningEmail, sendContentRemovedEmail, sendAccountSuspension7DaysEmail,
// - sendAccountSuspension45DaysEmail, sendAccountPermanentBanEmail, sendLoginFromNewDeviceEmail
// - sendEventRsvpConfirmedEmail, sendPaymentFailedEmail
// - sendEndOfDayTransactionReport, sendFounderMetricsEmail

// =====================================================
// League / Coach Approval Emails (SendGrid templates only)
// =====================================================

async function sendJoinRequestAdminTemplate(params: {
  to: string;
  subject: string;
  leagueName: string;
  ownerName: string;
  ownerEmail: string;
  sport?: string;
  orgType?: string;
  approveUrl?: string;
  rejectUrl?: string;
  supportingDocumentUrl?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.JOIN_REQUEST_ADMIN;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID or SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID'
    );
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    params.subject,
    {
      ...getCommonTemplateData(),
      league_name: params.leagueName,
      owner_name: params.ownerName,
      owner_email: params.ownerEmail,
      sport: params.sport || 'Not specified',
      org_type: params.orgType || 'Not specified',
      created_date: new Date().toLocaleDateString(),
      approve_url: params.approveUrl || '',
      reject_url: params.rejectUrl || '',
      supporting_document_url: params.supportingDocumentUrl || '',
      supporting_document_link: params.supportingDocumentUrl
        ? `<a href="${params.supportingDocumentUrl}">View Supporting Document</a>`
        : '',
    },
    `Join request admin email sent to ${params.to}`
  );
}

/**
 * Notify super admin that a new league was created and needs approval.
 * Uses the approved Join Request Admin template.
 */
export async function sendLeagueApprovalRequestEmail(params: {
  leagueId: string;
  leagueName: string;
  ownerName: string;
  ownerEmail: string;
  sport?: string;
  orgType?: string;
  approveToken: string;
  rejectToken: string;
  supportingDocumentUrl?: string;
}): Promise<boolean> {
  const approveUrl = `${API_BASE_URL}/organizations/${params.leagueId}/approve?token=${params.approveToken}`;
  const rejectUrl = `${API_BASE_URL}/organizations/${params.leagueId}/reject?token=${params.rejectToken}`;

  // v1.0.2 audit fix: send to ALL admin emails, not just the first
  const { getAllAdminEmails } = await import('./adminEmails.js');
  const adminEmails = getAllAdminEmails();

  // Send to all admins in parallel
  const results = await Promise.all(
    adminEmails.map(to =>
      sendJoinRequestAdminTemplate({
        to,
        subject: `New League Awaiting Approval: ${params.leagueName}`,
        leagueName: params.leagueName,
        ownerName: params.ownerName,
        ownerEmail: params.ownerEmail,
        sport: params.sport,
        orgType: params.orgType,
        approveUrl,
        rejectUrl,
        supportingDocumentUrl: params.supportingDocumentUrl,
      })
    )
  );
  return results.some(Boolean); // true if at least one email was sent
}

/**
 * Notify a league owner that a coach wants to join their organization.
 * v1.0.2 audit fix: search-mode join requests previously only sent push
 * notifications. This adds email parity with the create-new-org path.
 * Reuses LEAGUE_PENDING_APPROVAL template ("Join request admin" in SendGrid).
 */
export async function sendCoachJoinRequestEmail(params: {
  ownerEmail: string;
  ownerName: string;
  coachName: string;
  coachEmail: string;
  organizationName: string;
  organizationId: string;
}): Promise<boolean> {
  return sendJoinRequestAdminTemplate({
    to: params.ownerEmail,
    subject: `New Coach Request: ${params.coachName} wants to join ${params.organizationName}`,
    leagueName: params.organizationName,
    ownerName: params.ownerName,
    ownerEmail: params.coachEmail,
    sport: 'N/A',
    orgType: 'Coach join request',
  });
}

export async function sendCoachApplicationAdminEmail(params: {
  to: string;
  applicantName: string;
  applicantEmail: string;
}): Promise<boolean> {
  return sendJoinRequestAdminTemplate({
    to: params.to,
    subject: `New coach application: ${params.applicantName}`,
    leagueName: 'VarsityHub Coach Application',
    ownerName: params.applicantName,
    ownerEmail: params.applicantEmail,
    sport: 'N/A',
    orgType: 'Coach application',
  });
}

/**
 * Notify league owner that their league has been approved by super admin.
 */
export async function sendLeagueApprovedEmail(params: {
  to: string;
  ownerName: string;
  leagueName: string;
  note?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.ORG_APPROVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_ORG_APPROVAL_TEMPLATE_ID — org owner will not receive approval email');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    `Your organization "${params.leagueName}" has been approved!`,
    {
      ...getCommonTemplateData(),
      owner_name: params.ownerName || 'League Owner',
      org_name: params.leagueName,
      org_logo_url: '',
      admin_note: params.note || '',
      dashboard_url: `${APP_BASE_URL}/team-hub`,
    },
    `League approved email sent to ${params.to}`
  );
}

/**
 * Notify league owner that their league was rejected by super admin.
 */
export async function sendLeagueRejectedEmail(params: {
  to: string;
  ownerName: string;
  leagueName: string;
  reason?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.ORG_DENIED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_ORG_DENIAL_TEMPLATE_ID — org owner will not receive rejection email');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    `Update on your organization "${params.leagueName}"`,
    {
      ...getCommonTemplateData(),
      owner_name: params.ownerName || 'League Owner',
      org_name: params.leagueName,
      org_logo_url: '',
      reason: params.reason || '',
    },
    `League rejected email sent to ${params.to}`
  );
}

/**
 * Notify coach that they have been approved by the league owner.
 * Uses SendGrid JOIN_REQUEST_APPROVED template.
 */
export async function sendCoachApprovedEmail(params: {
  to: string;
  coachName: string;
  leagueName: string;
  note?: string;
}): Promise<boolean> {
  const subject = `Congratulations on being accepted!`;
  const templateId = TEMPLATE_IDS.JOIN_REQUEST_APPROVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      user_name: params.coachName,
      org_name: params.leagueName,
      admin_name: 'VarsityHub',
      admin_note: params.note || '',
      dashboard_url: `${APP_BASE_URL}/team-hub`,
      org_logo_url: '',
    },
    `Coach approved email sent to ${params.to}`
  );
}

/**
 * Notify coach that they were rejected by the league owner.
 * Uses SendGrid JOIN_REQUEST_DENIED template.
 */
export async function sendCoachRejectedEmail(params: {
  to: string;
  coachName: string;
  leagueName: string;
  reason?: string;
}): Promise<boolean> {
  const subject = `Coach request for ${params.leagueName} — declined`;
  const templateId = TEMPLATE_IDS.JOIN_REQUEST_DENIED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      user_name: params.coachName,
      org_name: params.leagueName,
      reason: params.reason || '',
      org_logo_url: '',
    },
    `Coach rejected email sent to ${params.to}`
  );
}

/**
 * Confirm to admin that their approve/reject action was processed.
 */
export async function sendAdminActionConfirmationEmail(params: {
  to: string;
  action: 'league_approved' | 'league_rejected';
  leagueName: string;
  ownerName?: string;
  ownerEmail?: string;
  reason?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.ADMIN_ACTION_CONFIRMATION;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID — admin will not receive confirmation');
    return false;
  }

  const actionLabel = params.action === 'league_approved' ? 'Approved' : 'Rejected';

  return sendTemplateEmail(
    templateId,
    params.to,
    `Admin Action: ${params.leagueName} — ${actionLabel}`,
    {
      ...getCommonTemplateData(),
      action: actionLabel,
      league_name: params.leagueName,
      owner_name: params.ownerName || '',
      owner_email: params.ownerEmail || '',
      reason: params.reason || '',
    },
    `Admin action confirmation (${params.action}) sent to ${params.to}`
  );
}

// Non-mandatory email functions removed:
// - sendNewCoachRequestEmail, sendAthleteInvitationEmail
// - sendRoleAssignmentEmail, sendInvitationDeclinedEmail
// - sendTeamRosterUpdateEmail, sendUserConfirmationEmail
