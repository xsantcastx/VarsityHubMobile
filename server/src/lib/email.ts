import { debugLog } from './debugLog.js';
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
    emailServicePromise = import('../services/email/service.js').then((mod) => mod.getEmailService());
  }
  return emailServicePromise;
};

// Legacy constants for backward compatibility
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');
const API_BASE_URL = (process.env.API_BASE_URL || 'https://api-production-8ac3.up.railway.app').replace(/\/$/, '');
const CUSTOMER_SERVICE_EMAIL = process.env.CUSTOMER_SERVICE_EMAIL || 'support@varsityhub.app';

// Common template data (social links, privacy policy, etc.) added to all emails
const getCommonTemplateData = () => ({
  logo_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png',
  footer_logo_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png',
  hero_image_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png',
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

// Template IDs for SendGrid dynamic templates
// Only mandatory templates for critical functionality
const TEMPLATE_IDS = {
  // Auth & Security (REQUIRED)
  VERIFICATION: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || '',
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',

  // Team & Organization (REQUIRED)
  TEAM_INVITE: process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID || '',
  ORG_INVITE: process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID || '',

  // Billing (REQUIRED)
  BILLING_NOTICE: process.env.SENDGRID_BILLING_NOTICE_TEMPLATE_ID || '',

  // Approval flows (MANDATORY)
  ABUSE_REPORT: process.env.SENDGRID_ABUSE_REPORT_TEMPLATE_ID || '',
  AD_PENDING_REVIEW: process.env.SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID || '',
  AD_APPROVED: process.env.SENDGRID_AD_APPROVED_TEMPLATE_ID || '',
  AD_REJECTED: process.env.SENDGRID_AD_REJECTED_TEMPLATE_ID || '',
  EVENT_APPROVED: process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID || '',
  EVENT_DENIED: process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID || '',
  LEAGUE_PENDING_APPROVAL: process.env.SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID || '',
  ADMIN_ACTION_CONFIRMATION: process.env.SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID || '',
  ORG_APPROVAL: process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID || '',
  ORG_DENIAL: process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID || '',
  JOIN_REQUEST_APPROVED: process.env.SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID || '',
  JOIN_REQUEST_DENIED: process.env.SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID || '',
};

type TemplateKey = keyof typeof TEMPLATE_IDS;

// Critical for launch — server exits if missing in production
const REQUIRED_TEMPLATE_KEYS: TemplateKey[] = [
  'VERIFICATION',
  'PASSWORD_RESET',
  'TEAM_INVITE',
  'ORG_INVITE',
  'BILLING_NOTICE',
];

// All templates are now mandatory — no recommended list
const RECOMMENDED_TEMPLATE_KEYS: TemplateKey[] = [];

export function isSendGridConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

export function getMissingEmailTemplates(required: TemplateKey[] = REQUIRED_TEMPLATE_KEYS): string[] {
  return required
    .filter((key) => !TEMPLATE_IDS[key])
    .map((key) => key.toLowerCase());
}

export function getMissingRecommendedTemplates(): string[] {
  return RECOMMENDED_TEMPLATE_KEYS
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
    console.error(`[email] ⛔ ${missing.length} critical SendGrid template IDs missing: ${missing.join(', ')}`);
    if (process.env.NODE_ENV === 'production') {
      console.error('[email] FATAL: Critical email templates must be configured in production. Set them in Railway environment variables.');
      process.exit(1);
    }
    console.error('[email] Emails using these templates will silently fail. Set them in Railway environment variables.');
  }

  const missingRecommended = getMissingRecommendedTemplates();
  if (missingRecommended.length) {
    console.warn(`[email] ⚠️  ${missingRecommended.length} recommended SendGrid template IDs missing: ${missingRecommended.join(', ')}`);
  }

  return result;
}

type BasicEmail = { to: string; subject: string; text?: string; html?: string };

const formatLines = (lines: Array<string | undefined | null>) =>
  lines.filter((line) => Boolean(line && String(line).trim().length)).join('\n');

/**
 * Generic email helper — use ONLY for internal/system emails when no template exists.
 * All user-facing and business emails MUST use SendGrid templates via sendTemplateEmail.
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
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(`[email] Email service not configured in production — email to "${to}" (${safeSubject}) silently dropped`);
      console.error(err.message);
      Sentry.captureException(err, { extra: { to, subject: safeSubject } });
      throw err;
    }
    console.error('[email] Email service not configured - logging email', { to, subject: safeSubject });
    console.log(formatLines([`To: ${to}`, `Subject: ${safeSubject}`, safeText]));
    return true; // Return true to not break existing flows in dev
  }

  try {
    // v1.0.2 audit fix: explicitly set replyTo so generic emails route replies to support.
    // From header is managed by the provider via defaultFrom; replyTo override ensures user replies land somewhere real.
    const replyTo = process.env.SUPPORT_REPLY_TO || 'support@varsityhub.app';
    const result = await service.send({
      to,
      subject: safeSubject,
      text: safeText,
      html: safeHtml,
      replyTo,
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
  const adminTo = params.to || process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'emancero@varsityhub.app';
  const subject = `Ad Pending Review — ${params.businessName || 'Unknown Business'}`;

  // Build one-click approve/reject URLs when tokens are provided
  const approveUrl = params.approveToken && params.adId
    ? `${API_BASE_URL}/ads/${params.adId}/approve?token=${params.approveToken}`
    : '';
  const rejectUrl = params.rejectToken && params.adId
    ? `${API_BASE_URL}/ads/${params.adId}/reject?token=${params.rejectToken}`
    : '';

  // Use ad-specific template if available, fall back to league approval template (same layout)
  const templateId = TEMPLATE_IDS.AD_PENDING_REVIEW || TEMPLATE_IDS.LEAGUE_PENDING_APPROVAL;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID or SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    adminTo,
    subject,
    {
      ...getCommonTemplateData(),
      // Ad-specific fields
      business_name: params.businessName || 'N/A',
      contact_name: params.contactName || 'N/A',
      contact_email: params.contactEmail || 'N/A',
      zip_code: params.zipCode || 'N/A',
      banner_url: params.bannerUrl || '',
      ad_id: params.adId || '',
      approve_url: approveUrl,
      reject_url: rejectUrl,
      // Map to league template fields so it renders in either template
      league_name: params.businessName || 'N/A',
      owner_name: params.contactName || 'N/A',
      owner_email: params.contactEmail || 'N/A',
      sport: `Ad • ZIP ${params.zipCode || 'N/A'}`,
      org_type: 'advertisement',
      created_date: new Date().toLocaleDateString(),
    },
    `Ad pending review email sent to ${adminTo}`
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
  const subject = `Content Report Submitted — ${params.reportedContentType.toUpperCase()} [${params.reportedContentId}]`;

  const templateId = TEMPLATE_IDS.ABUSE_REPORT;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_ABUSE_REPORT_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      report_id: params.reportId || 'N/A',
      reporter_name: params.reporterName || 'Unknown',
      reporter_email: params.reporterEmail || 'unknown@email.com',
      reported_type: params.reportedContentType,
      reported_id: params.reportedContentId,
      report_reason: params.reportReason.replace(/_/g, ' '),
      report_details: params.reportDetails || '',
      content_context: JSON.stringify(params.contentContext || {}, null, 2),
      dashboard_url: `${APP_BASE_URL}/admin/reports`,
    },
    `Abuse report notification sent to ${params.to}`
  );
}

export async function sendAdApprovedEmail(params: {
  to: string;
  businessName?: string;
  note?: string;
}): Promise<boolean> {
  const subject = 'Your Ad Has Been Approved — VarsityHub';
  const templateId = TEMPLATE_IDS.AD_APPROVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_AD_APPROVED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
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
  const subject = 'Your Ad Needs Changes — VarsityHub';
  const templateId = TEMPLATE_IDS.AD_REJECTED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_AD_REJECTED_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || 'your business',
      rejection_reason: params.reason || 'Please review our ad guidelines and resubmit.',
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

// sendEventCanceledEmail removed — non-mandatory transactional email

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
export async function sendVerificationEmail(email: string, token: string, userName?: string): Promise<boolean> {
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
  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'member';
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
      acceptLink: params.inviteToken ? `${APP_BASE_URL}/invites?token=${params.inviteToken}` : `${APP_BASE_URL}/invites`,
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
      const err = new Error(`[email] Email service not configured in production — template email dropped: ${logMessage}`);
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
      debugLog(`✅ ${logMessage}`);
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
  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'Member';

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
      acceptLink: params.inviteToken ? `${APP_BASE_URL}/invites?token=${params.inviteToken}` : `${APP_BASE_URL}/invites`,
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
 * Billing notices (trial ending, payment succeeded/failed, subscription canceled/renewed)
 */
export async function sendBillingNoticeEmail(params: {
  to: string;
  user_name?: string;
  type: 'trial_ending' | 'payment_succeeded' | 'payment_failed' | 'subscription_canceled' | 'subscription_renewed';
  planName?: string;
  amount?: string;
  manageLink?: string;
  teamName?: string;
  orgName?: string;
  perks?: string[];
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.BILLING_NOTICE,
    params.to,
    'Billing Update — VarsityHub',
    {
      ...getCommonTemplateData(),
      user_name: params.user_name || '',
      billing_type: params.type,
      plan_name: params.planName || 'VarsityHub Subscription',
      amount: params.amount || '',
      manage_subscription_url: params.manageLink || `${APP_BASE_URL}/settings/manage-subscription`,
      team_name: params.teamName || '',
      org_name: params.orgName || '',
      perks: params.perks || [],
    },
    `Billing notice sent to ${params.to} (type: ${params.type})`
  );
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

/**
 * Notify super admin that a new league was created and needs approval.
 * Uses SendGrid LEAGUE_PENDING_APPROVAL template.
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

  const to =
    (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim() || 'emancero@varsityhub.app';

  const templateId = TEMPLATE_IDS.LEAGUE_PENDING_APPROVAL;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    to,
    `New League Awaiting Approval: ${params.leagueName}`,
    {
      ...getCommonTemplateData(),
      league_name: params.leagueName,
      owner_name: params.ownerName,
      owner_email: params.ownerEmail,
      sport: params.sport || 'Not specified',
      org_type: params.orgType || 'Not specified',
      created_date: new Date().toLocaleDateString(),
      approve_url: approveUrl,
      reject_url: rejectUrl,
      supporting_document_url: params.supportingDocumentUrl || '',
      supporting_document_link: params.supportingDocumentUrl
        ? `<a href="${params.supportingDocumentUrl}">View Supporting Document</a>`
        : '',
    },
    `League approval request sent to ${to}`
  );
}

/**
 * Notify league owner that their league has been approved by super admin.
 * Uses SendGrid ORG_APPROVAL template (league = org).
 */
export async function sendLeagueApprovedEmail(params: {
  to: string;
  ownerName: string;
  leagueName: string;
  note?: string;
}): Promise<boolean> {
  const subject = `Your league "${params.leagueName}" is live!`;
  const templateId = TEMPLATE_IDS.ORG_APPROVAL;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_ORG_APPROVAL_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      org_name: params.leagueName,
      owner_name: params.ownerName,
      admin_note: params.note || '',
      dashboard_url: `${APP_BASE_URL}/team-hub`,
      org_logo_url: '',
    },
    `League approved email sent to ${params.to}`
  );
}

/**
 * Notify league owner that their league was rejected by super admin.
 * Uses SendGrid ORG_DENIAL template (league = org).
 */
export async function sendLeagueRejectedEmail(params: {
  to: string;
  ownerName: string;
  leagueName: string;
  reason?: string;
}): Promise<boolean> {
  const subject = `League "${params.leagueName}" — not approved`;
  const templateId = TEMPLATE_IDS.ORG_DENIAL;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_ORG_DENIAL_TEMPLATE_ID');
    return false;
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      org_name: params.leagueName,
      owner_name: params.ownerName,
      reason: params.reason || '',
      org_logo_url: '',
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
 * Notify super admin of league approval/rejection action (internal confirmation).
 * Uses SendGrid ADMIN_ACTION_CONFIRMATION template.
 */
export async function sendAdminActionConfirmationEmail(params: {
  to: string;
  action: 'league_approved' | 'league_rejected';
  leagueName: string;
  ownerName?: string;
  ownerEmail?: string;
  reason?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.ADMIN_ACTION_CONFIRMATION,
    params.to,
    `League ${params.action === 'league_approved' ? 'Approved' : 'Rejected'}: ${params.leagueName}`,
    {
      ...getCommonTemplateData(),
      action: params.action,
      league_name: params.leagueName,
      owner_name: params.ownerName || 'Unknown',
      owner_email: params.ownerEmail || '',
      reason: params.reason || '',
    },
    `Admin action confirmation sent to ${params.to}`
  );
}

// Non-mandatory email functions removed:
// - sendNewCoachRequestEmail, sendAthleteInvitationEmail
// - sendRoleAssignmentEmail, sendInvitationDeclinedEmail
// - sendTeamRosterUpdateEmail, sendUserConfirmationEmail
