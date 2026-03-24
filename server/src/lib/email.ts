import { debugLog } from './debugLog.js';
import type { FounderMetricsReport } from './founderMetrics.js';
import type { EmailResult } from '../services/email/types.js';
import type { EmailService } from '../services/email/EmailService.js';
import sgMail from '@sendgrid/mail';
import * as Sentry from '@sentry/node';

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
  logo_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png',
  hero_image_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_ai2j8k.png',
  privacy_policy_url: 'https://varsityhub.app/privacy',
  community_guidelines_url: 'https://varsityhub.app/privacy',
  instagram_url: 'https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13',
  tiktok_url: 'https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi',
  youtube_url: 'https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-',
  facebook_url: 'https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr',
  x_url: 'https://x.com/varsityhub00',
  website_url: 'https://varsityhub.app',
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

  // Internal Reports
  DAILY_TRANSACTION_REPORT: process.env.SENDGRID_DAILY_TRANSACTION_REPORT_TEMPLATE_ID || '',
  FOUNDER_METRICS: process.env.SENDGRID_FOUNDER_METRICS_TEMPLATE_ID || '',

  // Notifications & Engagement
  AD_GOES_LIVE: process.env.SENDGRID_AD_GOES_LIVE_TEMPLATE_ID || '',

  // Ad Moderation
  AD_PAYMENT_CONFIRMED: process.env.SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID || '',
  AD_PENDING_REVIEW: process.env.SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID || '',
  AD_APPROVED: process.env.SENDGRID_AD_APPROVED_TEMPLATE_ID || '',
  AD_REJECTED: process.env.SENDGRID_AD_REJECTED_TEMPLATE_ID || '',

  // League / Coach approval flows
  LEAGUE_PENDING_APPROVAL: process.env.SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID || '',
  ADMIN_ACTION_CONFIRMATION: process.env.SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID || '',
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

// Important but have HTML fallbacks — warn but don't block
const RECOMMENDED_TEMPLATE_KEYS: TemplateKey[] = [
  'JOIN_REQUEST_APPROVED',
  'JOIN_REQUEST_DENIED',
  'ORG_APPROVAL',
  'ORG_DENIAL',
  'AD_APPROVED',
  'AD_REJECTED',
  'LEAGUE_PENDING_APPROVAL',
  'PASSWORD_CHANGED',
  'ACCOUNT_RECOVERY',
  'LOGIN_NEW_DEVICE',
  'ACCOUNT_WARNING',
  'CONTENT_REMOVED',
  'ACCOUNT_SUSPENSION_7_DAYS',
  'ACCOUNT_SUSPENSION_45_DAYS',
  'ACCOUNT_PERMANENT_BAN',
  'REPORT_RESOLVED',
  'REPORT_DISMISSED',
  'CONTENT_MODERATION',
  'ABUSE_REPORT',
  'JOIN_REQUEST_ADMIN',
  'STAFF_MEMBER_JOINED',
  'ROSTER_THRESHOLD',
  'EVENT_SUBMISSION_RECEIVED',
  'EVENT_APPROVED',
  'EVENT_DENIED',
  'EVENT_REMINDER',
  'EVENT_UPDATED',
  'EVENT_CANCELED',
  'EVENT_RSVP_CONFIRMED',
  'PAYMENT_FAILED',
  'SUBSCRIPTION_EXPIRING',
  'AD_GOES_LIVE',
  'AD_PAYMENT_CONFIRMED',
  'AD_PENDING_REVIEW',
  'DAILY_TRANSACTION_REPORT',
  'FOUNDER_METRICS',
  'ADMIN_ACTION_CONFIRMATION',
];

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

export async function sendAdPaymentConfirmedEmail(params: {
  to: string;
  businessName?: string;
  zipCode?: string;
  amount?: string;
  hoursLabel?: string;
  totalHoursBooked?: number;
  hoursRemaining?: number;
  dates?: string[];
  adId?: string;
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.AD_PAYMENT_CONFIRMED,
    params.to,
    'Ad Reservation Confirmed — VarsityHub',
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || '',
      zip_code: params.zipCode || '',
      amount: params.amount || '',
      hours_label: params.hoursLabel || '',
      total_hours_booked: params.totalHoursBooked ?? 0,
      hours_remaining: params.hoursRemaining ?? 0,
      dates: params.dates || [],
      dates_count: params.dates?.length || 0,
      ad_id: params.adId || '',
      app_url: APP_BASE_URL,
    },
    `Ad payment confirmed email sent to ${params.to}`
  );
}

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

  const plainBody = [
    `A new ad needs your review on VarsityHub.`,
    ``,
    `Business: ${params.businessName || 'N/A'}`,
    `Contact: ${params.contactName || 'N/A'} (${params.contactEmail || 'N/A'})`,
    `Zip Code: ${params.zipCode || 'N/A'}`,
    `Ad ID: ${params.adId || 'N/A'}`,
    params.bannerUrl ? `Banner: ${params.bannerUrl}` : '',
    ``,
    ...(approveUrl ? [`APPROVE: ${approveUrl}`, ``] : []),
    ...(rejectUrl ? [`REJECT: ${rejectUrl}`, ``] : []),
    `Review this ad in the admin dashboard.`,
  ].filter(Boolean).join('\n');

  // Try ad-specific template first, then fall back to league approval template (same layout)
  const templateId = TEMPLATE_IDS.AD_PENDING_REVIEW || TEMPLATE_IDS.LEAGUE_PENDING_APPROVAL;
  if (templateId) {
    const sent = await sendTemplateEmail(
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
    if (sent) return true;
    console.error('[email] Ad pending review template email failed, falling back to plain text');
  } else {
    console.warn('[email] No review template configured, using plain-text fallback');
  }

  // HTML fallback with styled email (matches league approval email style)
  const dashboardUrl = `${APP_BASE_URL}/admin/ads`;
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#1B3A6B;text-align:center;margin-bottom:20px;">Ad Pending Review</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Business:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.businessName || 'N/A'}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Contact:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.contactName || 'N/A'} (<a href="mailto:${params.contactEmail || ''}">${params.contactEmail || 'N/A'}</a>)</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Zip Code:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.zipCode || 'N/A'}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Ad ID:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.adId || 'N/A'}</td></tr>
  </table>
  ${params.bannerUrl ? `<div style="text-align:center;margin-bottom:20px;"><img src="${params.bannerUrl}" alt="Ad Banner" style="max-width:100%;border-radius:8px;border:1px solid #E5E7EB;" /></div>` : ''}
  <div style="text-align:center;margin-bottom:12px;">
    ${approveUrl ? `<a href="${approveUrl}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px;">Approve Ad</a>` : ''}
    ${rejectUrl ? `<a href="${rejectUrl}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Reject Ad</a>` : ''}
  </div>
  <div style="text-align:center;">
    <a href="${dashboardUrl}" style="display:inline-block;color:#1B3A6B;padding:8px 16px;text-decoration:underline;font-size:13px;">or Review in Dashboard</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  const fallbackSent = await sendEmail({ to: adminTo, subject, text: plainBody, html: htmlBody });
  if (fallbackSent) return true;
  console.error('[email] Ad pending review HTML fallback also failed via EmailService');

  // Last-resort: direct SendGrid API call bypassing the service layer
  if (SENDGRID_API_KEY) {
    try {
      sgMail.setApiKey(SENDGRID_API_KEY);
      await sgMail.send({
        to: adminTo,
        from: EMAIL_FROM,
        subject,
        text: plainBody,
        html: htmlBody,
      });
      console.log(`[email] Ad pending review sent via direct SendGrid to ${adminTo}`);
      return true;
    } catch (directErr: any) {
      console.error('[email] Ad pending review direct SendGrid fallback failed:', directErr?.response?.body?.errors || directErr?.message || directErr);
    }
  } else {
    console.error('[email] SENDGRID_API_KEY not set — cannot send ad pending review email');
  }

  return false;
}

export async function sendAdApprovedEmail(params: {
  to: string;
  businessName?: string;
}): Promise<boolean> {
  const subject = 'Your Ad Has Been Approved — VarsityHub';
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.AD_APPROVED,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || 'your business',
      app_url: APP_BASE_URL,
    },
    `Ad approved email sent to ${params.to}`
  );
  if (sent) return true;

  // HTML fallback when template is not configured
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#16A34A;text-align:center;">Your Ad Has Been Approved!</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Your ad for <strong>${params.businessName || 'your business'}</strong> has been approved on VarsityHub.
  </p>
  <p style="text-align:center;color:#374151;">Open the app to complete payment and go live.</p>
  <div style="text-align:center;margin-top:24px;">
    <a href="${APP_BASE_URL}" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Open VarsityHub</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Your ad for ${params.businessName || 'your business'} has been approved on VarsityHub. Open the app to complete payment.`,
    html: htmlBody,
  });
}

export async function sendAdRejectedEmail(params: {
  to: string;
  businessName?: string;
  reason?: string;
}): Promise<boolean> {
  const subject = 'Your Ad Needs Changes — VarsityHub';
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.AD_REJECTED,
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
  if (sent) return true;

  // HTML fallback when template is not configured
  const reasonText = params.reason ? `<p style="color:#374151;"><strong>Reason:</strong> ${params.reason}</p>` : '';
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#DC2626;text-align:center;">Ad Needs Changes</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Your ad${params.businessName ? ` for <strong>${params.businessName}</strong>` : ''} was not approved.
  </p>
  ${reasonText}
  <p style="text-align:center;color:#374151;">Please review our ad guidelines and resubmit. Contact <a href="mailto:${CUSTOMER_SERVICE_EMAIL}">${CUSTOMER_SERVICE_EMAIL}</a> if you have questions.</p>
  <div style="text-align:center;margin-top:24px;">
    <a href="${APP_BASE_URL}" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Open VarsityHub</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Your ad${params.businessName ? ` for ${params.businessName}` : ''} was not approved. ${params.reason || 'Please review our ad guidelines and resubmit.'}`,
    html: htmlBody,
  });
}

export async function sendAdReservationEmail(_params: any): Promise<boolean> {
  // Not yet implemented — return true so queue workers don't retry
  return true;
}

export async function sendAthleteFollowerNotificationEmail(_params: any): Promise<boolean> {
  // Not yet implemented — return true so queue workers don't retry
  return true;
}

export async function sendDormantUserDigestEmail(_params: any): Promise<boolean> {
  // Not yet implemented — return true so queue workers don't retry
  return true;
}

export async function sendEventApprovedEmail(params: any): Promise<boolean> {
  const sent = await sendTemplateEmail(
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
  if (sent) return true;

  // HTML fallback when template is not configured
  const name = params.recipientName || params.coachName || 'there';
  const eventTitle = params.eventTitle || params.eventName || 'your event';
  const dateTime = [params.eventDate, params.eventTime].filter(Boolean).join(' at ') || '';
  const locationLine = params.eventLocation ? `<p><strong>Location:</strong> ${params.eventLocation}</p>` : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#16a34a;">Event Approved!</h2>
    <p>Hi ${name},</p>
    <p>Your event <strong>"${eventTitle}"</strong> has been approved and is now live on VarsityHub.</p>
    ${dateTime ? `<p><strong>When:</strong> ${dateTime}</p>` : ''}
    ${locationLine}
    <p>Open the VarsityHub app to manage your event.</p>
    <p style="color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} VarsityHub</p>
  </div>`;
  return sendEmail({ to: params.to, subject: 'Your event was approved', html, text: `Your event "${eventTitle}" was approved and is now live.` });
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
  const sent = await sendTemplateEmail(
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
  if (sent) return true;

  // HTML fallback when template is not configured
  const name = params.recipientName || params.coachName || 'there';
  const eventTitle = params.eventTitle || params.eventName || 'your event';
  const reason = params.denialReason || params.reason;
  const reasonBlock = reason ? `<p style="background:#fef2f2;padding:12px;border-radius:8px;"><strong>Reason:</strong> ${reason}</p>` : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#dc2626;">Event Not Approved</h2>
    <p>Hi ${name},</p>
    <p>Your event <strong>"${eventTitle}"</strong> was not approved at this time.</p>
    ${reasonBlock}
    <p>You can submit a new event or contact <a href="mailto:${CUSTOMER_SERVICE_EMAIL}">${CUSTOMER_SERVICE_EMAIL}</a> with questions.</p>
    <p style="color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} VarsityHub</p>
  </div>`;
  return sendEmail({ to: params.to, subject: 'Event not approved', html, text: `Your event "${eventTitle}" was not approved. ${reason || ''}` });
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
  const sent = await sendTemplateEmail(
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
  if (sent) return true;

  // HTML fallback when template is not configured
  const name = params.coachName || 'Coach';
  const eventTitle = params.eventTitle || params.eventName || 'your event';
  const hours = params.reviewTimelineHours || 24;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
    </div>
    <h2 style="color:#1a1a2e;">Event Submitted</h2>
    <p>Hi ${name},</p>
    <p>We've received your event submission for <strong>"${eventTitle}"</strong> and our team will review it within ${hours} hours.</p>
    <p style="background:#fef9c3;padding:12px;border-radius:8px;color:#92400e;font-weight:600;">PENDING REVIEW</p>
    <p>You can check your submission status anytime in the VarsityHub app.</p>
    <p style="color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} VarsityHub</p>
  </div>`;
  return sendEmail({ to: params.to, subject: 'We received your event submission', html, text: `We received your event "${eventTitle}". Review takes up to ${hours} hours.` });
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

export async function sendPaymentRequiredEmail(_params: any): Promise<boolean> {
  // Not yet implemented — return true so queue workers don't retry
  return true;
}

export async function sendPostHighlightEmail(_params: any): Promise<boolean> {
  // Not yet implemented — return true so queue workers don't retry
  return true;
}

export async function sendProfileCompletionNudgeEmail(_params: any): Promise<boolean> {
  console.warn('[email] sendProfileCompletionNudgeEmail: not configured');
  return false;
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

export async function sendSeasonWrapUpEmail(_params: any): Promise<boolean> {
  // Not yet implemented — return true so queue workers don't retry
  return true;
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
  const subject = `${token} is your VarsityHub verification code`;

  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.VERIFICATION,
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
  if (sent) return true;

  // HTML fallback when SendGrid template is not configured or fails
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#1B3A6B;text-align:center;">Email Verification</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Hi ${displayName}, use the code below to verify your email address.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <span style="display:inline-block;background:#F3F4F6;padding:16px 32px;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;color:#1B3A6B;">${token}</span>
  </div>
  <p style="text-align:center;color:#6B7280;font-size:14px;">This code expires in 30 minutes.</p>
  <p style="text-align:center;color:#6B7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
  <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;">
    <a href="${getCommonTemplateData().instagram_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">Instagram</a>
    <a href="${getCommonTemplateData().tiktok_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">TikTok</a>
    <a href="${getCommonTemplateData().youtube_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">YouTube</a>
    <a href="${getCommonTemplateData().facebook_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">Facebook</a>
    <a href="${getCommonTemplateData().x_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">X</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:16px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: email,
    subject,
    text: `Your VarsityHub verification code is: ${token}. This code expires in 30 minutes.`,
    html: htmlBody,
  });
}

/**
 * Send password reset email with 6-digit code
 * Uses SendGrid dynamic template
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  const subject = `${code} is your VarsityHub password reset code`;
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.PASSWORD_RESET,
    email,
    subject,
    {
      ...getCommonTemplateData(),
      subject: subject,
      reset_code: code,
      code: code,
      expires_in: '30 minutes',
    },
    `Password reset email sent to ${email}`
  );
  if (sent) return true;

  // HTML fallback when SendGrid template is not configured or fails
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#1B3A6B;text-align:center;">Password Reset</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Use the code below to reset your password.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <span style="display:inline-block;background:#F3F4F6;padding:16px 32px;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;color:#1B3A6B;">${code}</span>
  </div>
  <p style="text-align:center;color:#6B7280;font-size:14px;">This code expires in 30 minutes.</p>
  <p style="text-align:center;color:#6B7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: email,
    subject,
    text: `Your VarsityHub password reset code is: ${code}. This code expires in 30 minutes.`,
    html: htmlBody,
  });
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
  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'member';
  const inviterName = params.inviterName || 'VarsityHub Coach';
  const subject = `You've been invited to join ${params.teamName}`;

  return sendTemplateEmail(
    TEMPLATE_IDS.TEAM_INVITE,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      recipient_name: params.recipientName || '',
      team_name: params.teamName,
      org_name: params.organizationName || '',
      role: prettyRole,
      inviter_name: inviterName,
      invite_url: params.inviteToken ? `${APP_BASE_URL}/invites?token=${params.inviteToken}` : `${APP_BASE_URL}/invites`,
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
    const msg = `[email] Template ID not configured for: ${subject}`;
    console.warn(msg);
    Sentry.captureMessage(msg, 'warning');
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
      org_logo_url: params.orgLogoUrl || '',
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
  const sent = await sendTemplateEmail(
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
      org_logo_url: params.orgLogoUrl || '',
    },
    `Join request notification sent to ${params.adminEmail}`
  );
  if (sent) return true;

  // HTML fallback when template is not configured
  const subject = `New join request for ${params.organizationName}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#1a1a2e;">New Join Request</h2>
    <p>Hi ${params.adminName},</p>
    <p><strong>${params.requesterName}</strong> has requested to join <strong>${params.organizationName}</strong>.</p>
    ${params.message ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px;"><em>"${params.message}"</em></p>` : ''}
    <p>Open the VarsityHub app to review this request.</p>
    <p style="color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} VarsityHub</p>
  </div>`;
  return sendEmail({ to: params.adminEmail, subject, html, text: `${params.requesterName} wants to join ${params.organizationName}. Open VarsityHub to review.` });
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
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.JOIN_REQUEST_APPROVED,
    params.userEmail,
    `Your request to join ${params.organizationName} was approved`,
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      org_name: params.organizationName,
      admin_name: params.adminName,
      dashboard_url: `${APP_BASE_URL}/organizations`,
      org_logo_url: params.orgLogoUrl || '',
    },
    `Join request approved notification sent to ${params.userEmail}`
  );
  if (sent) return true;

  // HTML fallback when template is not configured
  const subject = `Your request to join ${params.organizationName} was approved`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#16a34a;">Request Approved!</h2>
    <p>Hi ${params.userName},</p>
    <p>Your request to join <strong>${params.organizationName}</strong> has been approved by ${params.adminName}.</p>
    <p>Open the VarsityHub app to get started with your team.</p>
    <p style="color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} VarsityHub</p>
  </div>`;
  return sendEmail({ to: params.userEmail, subject, html, text: `Your request to join ${params.organizationName} was approved. Open VarsityHub to get started.` });
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
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.JOIN_REQUEST_DENIED,
    params.userEmail,
    `Your request to join ${params.organizationName} was not approved`,
    {
      ...getCommonTemplateData(),
      user_name: params.userName,
      org_name: params.organizationName,
      reason: params.reason || '',
      org_logo_url: params.orgLogoUrl || '',
    },
    `Join request denied notification sent to ${params.userEmail}`
  );
  if (sent) return true;

  // HTML fallback when template is not configured
  const subject = `Your request to join ${params.organizationName} was not approved`;
  const reasonText = params.reason ? `<p style="background:#fef2f2;padding:12px;border-radius:8px;"><strong>Reason:</strong> ${params.reason}</p>` : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#dc2626;">Request Not Approved</h2>
    <p>Hi ${params.userName},</p>
    <p>Your request to join <strong>${params.organizationName}</strong> was not approved at this time.</p>
    ${reasonText}
    <p>If you have questions, contact <a href="mailto:${CUSTOMER_SERVICE_EMAIL}">${CUSTOMER_SERVICE_EMAIL}</a>.</p>
    <p style="color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} VarsityHub</p>
  </div>`;
  return sendEmail({ to: params.userEmail, subject, html, text: `Your request to join ${params.organizationName} was not approved. ${params.reason || ''}` });
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
  return sendTemplateEmail(
    TEMPLATE_IDS.ORG_APPROVAL,
    params.to,
    `Your organization ${params.organizationName} has been approved`,
    {
      ...getCommonTemplateData(),
      org_name: params.organizationName,
      dashboard_url: params.dashboardLink || `${APP_BASE_URL}/team-hub`,
      org_logo_url: params.orgLogoUrl || '',
    },
    `Organization approval email sent to ${params.to}`
  );
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
  return sendTemplateEmail(
    TEMPLATE_IDS.ORG_DENIAL,
    params.to,
    `Your organization ${params.organizationName} was not approved`,
    {
      ...getCommonTemplateData(),
      org_name: params.organizationName,
      reason: params.reason || '',
      org_logo_url: params.orgLogoUrl || '',
    },
    `Organization denial email sent to ${params.to}`
  );
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
  return sendTemplateEmail(
    TEMPLATE_IDS.CONTENT_MODERATION,
    params.to,
    `Content ${params.action} — VarsityHub`,
    {
      ...getCommonTemplateData(),
      action: params.action,
      post_id: params.postId || '',
      reason: params.reason || '',
      next_steps: params.nextSteps || "If you believe this is a mistake, reply to this email and we'll review it.",
    },
    `Content moderation email sent to ${params.to} (action: ${params.action})`
  );
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
  return sendTemplateEmail(
    TEMPLATE_IDS.BILLING_NOTICE,
    params.to,
    'Billing Update — VarsityHub',
    {
      ...getCommonTemplateData(),
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

  const formatType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  return sendTemplateEmail(
    TEMPLATE_IDS.DAILY_TRANSACTION_REPORT,
    params.to,
    `📊 Daily Transaction Report - ${report.date}`,
    {
      ...getCommonTemplateData(),
      report_date: report.date,
      total_transactions: summary.totalTransactions,
      completed_transactions: summary.completedTransactions,
      gross_revenue: formatCurrency(summary.totalRevenueCents),
      stripe_fees: formatCurrency(summary.totalFeesCents),
      discounts: formatCurrency(summary.totalDiscountsCents),
      net_revenue: formatCurrency(summary.netRevenueCents),
      has_type_breakdown: breakdownByType.length > 0,
      breakdown_by_type: breakdownByType.map((b) => ({
        type: formatType(b.type),
        count: b.count,
        revenue: formatCurrency(b.revenueCents),
        fees: formatCurrency(b.feesCents),
        discounts: formatCurrency(b.discountsCents),
        net: formatCurrency(b.netCents),
      })),
      has_status_breakdown: breakdownByStatus.length > 0,
      breakdown_by_status: breakdownByStatus.map((s) => ({
        status: s.status,
        count: s.count,
      })),
      generated_at: new Date().toLocaleString(),
    },
    `End-of-day transaction report sent to ${params.to} for ${report.date}`
  );
}

export async function sendFounderMetricsEmail(params: {
  to: string;
  report: FounderMetricsReport;
}): Promise<boolean> {
  const { report } = params;
  const { summary, daily, dateRange } = report;

  return sendTemplateEmail(
    TEMPLATE_IDS.FOUNDER_METRICS,
    params.to,
    `📈 Daily Founder Metrics - ${dateRange.end}`,
    {
      ...getCommonTemplateData(),
      date_range_start: dateRange.start,
      date_range_end: dateRange.end,
      total_users: summary.totalUsers,
      total_reports: summary.totalReports,
      total_messages: summary.totalMessages,
      new_users_today: summary.newUsersToday,
      reports_today: summary.reportsToday,
      messages_today: summary.messagesToday,
      lookback_days: summary.days,
      new_users_last_days: summary.newUsersLastDays,
      reports_last_days: summary.reportsLastDays,
      messages_last_days: summary.messagesLastDays,
      daily_users: daily.users,
      daily_reports: daily.reports,
      daily_messages: daily.messages,
      generated_at: new Date().toLocaleString(),
    },
    `Founder metrics email sent to ${params.to} (${dateRange.end})`
  );
}

export async function sendWelcomeEmail(_to: string, _name?: string): Promise<boolean> {
  console.warn('[email] sendWelcomeEmail: not configured');
  return false;
}

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

  // Try SendGrid template first; fall back to plain-text so admin always gets notified
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.LEAGUE_PENDING_APPROVAL,
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

  // HTML fallback — critical that admin always receives a styled email
  if (!sent) {
    const plainBody = [
      `A new league needs your approval on VarsityHub.`,
      ``,
      `League: ${params.leagueName}`,
      `Owner: ${params.ownerName} (${params.ownerEmail})`,
      `Type: ${params.orgType || 'Not specified'}`,
      `Sport: ${params.sport || 'Not specified'}`,
      `Submitted: ${new Date().toLocaleDateString()}`,
      ...(params.supportingDocumentUrl ? [``, `Supporting Document: ${params.supportingDocumentUrl}`] : []),
      ``,
      `APPROVE: ${approveUrl}`,
      ``,
      `REJECT: ${rejectUrl}`,
    ].join('\n');

    const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#1B3A6B;text-align:center;margin-bottom:20px;">New League Awaiting Approval</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">League Name:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.leagueName}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Owner:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.ownerName} (<a href="mailto:${params.ownerEmail}">${params.ownerEmail}</a>)</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Sport:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.sport || 'Not specified'}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Type:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.orgType || 'Not specified'}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Created:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${new Date().toLocaleDateString()}</td></tr>
  </table>
  ${params.supportingDocumentUrl ? `<div style="text-align:center;margin-bottom:20px;"><a href="${params.supportingDocumentUrl}" style="color:#1B3A6B;font-weight:600;">View Supporting Document</a></div>` : ''}
  <div style="text-align:center;margin-bottom:12px;">
    <a href="${approveUrl}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px;">Approve League</a>
    <a href="${rejectUrl}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Reject League</a>
  </div>
  <p style="text-align:center;color:#6B7280;font-size:12px;margin-top:16px;">These links expire in 7 days. No login required.</p>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

    return sendEmail({
      to,
      subject: `New League Awaiting Approval: ${params.leagueName}`,
      text: plainBody,
      html: htmlBody,
    });
  }
  return sent;
}

/**
 * Notify league owner that their league has been approved by super admin.
 * Uses SendGrid ORG_APPROVAL template (league = org).
 */
export async function sendLeagueApprovedEmail(params: {
  to: string;
  ownerName: string;
  leagueName: string;
}): Promise<boolean> {
  const subject = `Your league "${params.leagueName}" is live!`;
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.ORG_APPROVAL,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      org_name: params.leagueName,
      owner_name: params.ownerName,
      dashboard_url: `${APP_BASE_URL}/team-hub`,
      org_logo_url: '',
    },
    `League approved email sent to ${params.to}`
  );
  if (sent) return true;

  // HTML fallback when template is not configured
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#16A34A;text-align:center;">Your League Is Live!</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Hi ${params.ownerName}, your league <strong>${params.leagueName}</strong> has been approved on VarsityHub!
  </p>
  <p style="text-align:center;color:#374151;">Open the app to set up your teams and start managing your league.</p>
  <div style="text-align:center;margin-top:24px;">
    <a href="${APP_BASE_URL}" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Open VarsityHub</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Hi ${params.ownerName}, your league ${params.leagueName} has been approved on VarsityHub! Open the app to get started.`,
    html: htmlBody,
  });
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
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.ORG_DENIAL,
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
  if (sent) return true;

  // HTML fallback when template is not configured
  const reasonText = params.reason ? `<p style="color:#374151;"><strong>Reason:</strong> ${params.reason}</p>` : '';
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#DC2626;text-align:center;">League Not Approved</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Hi ${params.ownerName}, your league <strong>${params.leagueName}</strong> was not approved on VarsityHub.
  </p>
  ${reasonText}
  <p style="text-align:center;color:#374151;">If you believe this was a mistake, contact <a href="mailto:${CUSTOMER_SERVICE_EMAIL}">${CUSTOMER_SERVICE_EMAIL}</a>.</p>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Hi ${params.ownerName}, your league ${params.leagueName} was not approved on VarsityHub. ${params.reason || ''}`,
    html: htmlBody,
  });
}

/**
 * Notify coach that they have been approved by the league owner.
 * Uses SendGrid JOIN_REQUEST_APPROVED template.
 */
export async function sendCoachApprovedEmail(params: {
  to: string;
  coachName: string;
  leagueName: string;
}): Promise<boolean> {
  const subject = `You're approved — welcome to ${params.leagueName}!`;
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.JOIN_REQUEST_APPROVED,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      user_name: params.coachName,
      org_name: params.leagueName,
      admin_name: 'League Owner',
      dashboard_url: `${APP_BASE_URL}/team-hub`,
      org_logo_url: '',
    },
    `Coach approved email sent to ${params.to}`
  );
  if (sent) return true;

  // HTML fallback when template is not configured (matches ad approval email format)
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#16A34A;text-align:center;">You're Approved!</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Hi ${params.coachName}, your coach application to <strong>${params.leagueName}</strong> has been approved on VarsityHub!
  </p>
  <p style="text-align:center;color:#374151;">Open the app to start managing your team.</p>
  <div style="text-align:center;margin-top:24px;">
    <a href="${APP_BASE_URL}" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Open VarsityHub</a>
  </div>
  <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;">
    <a href="${getCommonTemplateData().instagram_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">Instagram</a>
    <a href="${getCommonTemplateData().tiktok_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">TikTok</a>
    <a href="${getCommonTemplateData().youtube_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">YouTube</a>
    <a href="${getCommonTemplateData().facebook_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">Facebook</a>
    <a href="${getCommonTemplateData().x_url}" style="margin:0 8px;color:#1a1a2e;text-decoration:none;font-size:13px;font-weight:600;">X</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:16px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Hi ${params.coachName}, your coach application to ${params.leagueName} has been approved on VarsityHub! Open the app to get started.`,
    html: htmlBody,
  });
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
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.JOIN_REQUEST_DENIED,
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
  if (sent) return true;

  // HTML fallback when template is not configured
  const reasonText = params.reason ? `<p style="text-align:center;color:#6B7280;font-size:14px;">Reason: ${params.reason}</p>` : '';
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#DC2626;text-align:center;">Coach Request Declined</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Hi ${params.coachName}, your request to join <strong>${params.leagueName}</strong> was not approved.
  </p>
  ${reasonText}
  <p style="text-align:center;color:#374151;">You can still use VarsityHub as a fan. If you have questions, please contact support.</p>
  <div style="text-align:center;margin-top:24px;">
    <a href="mailto:${CUSTOMER_SERVICE_EMAIL}" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Contact Support</a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Hi ${params.coachName}, your request to join ${params.leagueName} was not approved.${params.reason ? ` Reason: ${params.reason}` : ''} You can still use VarsityHub as a fan.`,
    html: htmlBody,
  });
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

/**
 * Notify league owner that a new coach wants to join.
 * Uses SendGrid JOIN_REQUEST_ADMIN template.
 */
export async function sendNewCoachRequestEmail(params: {
  to: string;
  ownerName: string;
  coachName: string;
  coachEmail: string;
  leagueName: string;
  requestId?: string;
  organizationId?: string;
}): Promise<boolean> {
  const approveUrl = params.requestId
    ? `${APP_BASE_URL}/organizations/join-requests/${params.requestId}/approve`
    : `${APP_BASE_URL}/organizations`;
  const denyUrl = params.requestId
    ? `${APP_BASE_URL}/organizations/join-requests/${params.requestId}/deny`
    : `${APP_BASE_URL}/organizations`;

  const subject = `New coach request for ${params.leagueName}: ${params.coachName}`;
  const sent = await sendTemplateEmail(
    TEMPLATE_IDS.JOIN_REQUEST_ADMIN,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      admin_name: params.ownerName,
      requester_name: params.coachName,
      org_name: params.leagueName,
      message: params.coachEmail,
      request_id: params.requestId || '',
      approve_url: approveUrl,
      deny_url: denyUrl,
      org_logo_url: '',
    },
    `New coach request sent to ${params.to}`
  );
  if (sent) return true;

  // HTML fallback with Approve/Deny buttons (matches ad pending review email format)
  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${getCommonTemplateData().logo_url}" alt="VarsityHub" style="height:48px;" />
  </div>
  <h2 style="color:#1B3A6B;text-align:center;margin-bottom:20px;">New Coach Request</h2>
  <p style="text-align:center;color:#374151;font-size:16px;">
    Hi ${params.ownerName}, a coach wants to join your league.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Coach:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.coachName}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">Email:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;"><a href="mailto:${params.coachEmail}">${params.coachEmail}</a></td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;border-bottom:1px solid #E5E7EB;">League:</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${params.leagueName}</td></tr>
  </table>
  <div style="text-align:center;margin-bottom:12px;">
    <a href="${approveUrl}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px;">Approve Coach</a>
    <a href="${denyUrl}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Deny Coach</a>
  </div>
  <p style="text-align:center;color:#6B7280;font-size:12px;margin-top:16px;">You can also manage requests in the VarsityHub app under Approvals.</p>
  <p style="text-align:center;color:#9CA3AF;font-size:13px;margin-top:24px;">&copy; ${new Date().getFullYear()} Lime Productions. All rights reserved.</p>
</div>`;

  return sendEmail({
    to: params.to,
    subject,
    text: `Hi ${params.ownerName}, ${params.coachName} (${params.coachEmail}) wants to join ${params.leagueName}. Approve: ${approveUrl} | Deny: ${denyUrl}`,
    html: htmlBody,
  });
}
