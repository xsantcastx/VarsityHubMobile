import type { FounderMetricsReport } from './founderMetrics.js';
import type { EmailResult } from '../services/email/types.js';
import type { EmailService } from '../services/email/EmailService.js';
import sgMail from '@sendgrid/mail';
import escapeHtml from 'escape-html';
import { signReviewToken } from './reviewTokens.js';
import { prisma } from './prisma.js';
import { redactEmail, sanitizeEmailLogMessage, sanitizeEmailSubject } from './emailRedaction.js';
import { isValidSendGridApiKey } from './sendgridConfig.js';
import { captureException, captureMessage } from './sentry.js';

/**
 * Resolve the EMAIL_AUDIT `audit_privacy` metadata for a recipient email.
 *
 * Returns `{ audit_privacy: 'minor' }` when we can positively confirm the
 * recipient is a minor (13-17) based on a stored DOB. Returns `undefined` in
 * every other case — adult user, unregistered email, missing DOB, or DB
 * lookup failure.
 *
 * Design note: this departs from `isMinor`'s fail-closed semantics. For
 * authorization we want unknown-age users treated as minors (conservative).
 * For logging, fail-closed would over-redact the bulk of adult users whose
 * DOB lookup ever hiccups, which cripples ops. So we redact ONLY on positive
 * minor confirmation. High-risk flows where the recipient is guaranteed a
 * minor (e.g. parental consent) hard-code the flag instead of calling this.
 */
/** @internal exported only for unit testing */
export async function resolveMinorAuditMetadata(
  email: string | undefined | null
): Promise<Record<string, string> | undefined> {
  if (!email) return undefined;
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } } as any,
      select: { date_of_birth: true, preferences: true } as any,
    });
    if (!user) return undefined;
    const u = user as any;
    if (!u.date_of_birth) return undefined;
    const { isMinor } = await import('./userAge.js');
    const minor = isMinor({
      date_of_birth: u.date_of_birth,
      preferences: u.preferences,
    });
    return minor ? { audit_privacy: 'minor' } : undefined;
  } catch {
    // Fail-open for logs: a DB blip should not block the email send. The
    // resulting log line will show the unredacted address, which is not ideal
    // but no worse than pre-redaction behavior.
    return undefined;
  }
}

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1';
const wantsTestEmailProvider = String(process.env.EMAIL_PROVIDER || '')
  .trim()
  .toLowerCase() === 'test';

let emailServicePromise: Promise<EmailService> | null = null;
const getEmailService = async (): Promise<EmailService | null> => {
  if (isTestEnv && !wantsTestEmailProvider) return null;
  if (!emailServicePromise) {
    emailServicePromise = import('../services/email/service.js').then(mod => mod.getEmailService());
  }
  return emailServicePromise;
};

// Legacy constants for backward compatibility
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const CANONICAL_API_FALLBACK = 'https://varsityhub.app';
// Consent URLs need a real Express handler; the vanity domain may not proxy
// /consent/:token. Pin to the raw API origin so parental-consent emails keep
// working even when API_BASE_URL is missing or set to a broken host.
const CANONICAL_CONSENT_API_FALLBACK = 'https://api-production-8ac3.up.railway.app';
const CANONICAL_APP_FALLBACK = 'https://varsityhub.app';
const BROKEN_API_HOSTS = new Set(['api.varsityhub.app']);
const BROKEN_APP_HOSTS = new Set(['api.varsityhub.app']);

type EmailBaseUrlResolutionReason = 'configured' | 'missing' | 'invalid_url' | 'blocked_host';

interface EmailBaseUrlResolution {
  value: string;
  rawValue: string;
  usedFallback: boolean;
  reason: EmailBaseUrlResolutionReason;
}

function resolveEmailBaseUrlWithDiagnostics(
  rawValue: string | undefined,
  fallback: string,
  blockedHosts: Set<string>
): EmailBaseUrlResolution {
  const fallbackValue = fallback.replace(/\/$/, '');
  const candidate = String(rawValue || '').trim();
  if (!candidate) {
    return {
      value: fallbackValue,
      rawValue: candidate,
      usedFallback: true,
      reason: 'missing',
    };
  }
  try {
    const parsed = new URL(candidate);
    if (blockedHosts.has(parsed.hostname)) {
      return {
        value: fallbackValue,
        rawValue: candidate,
        usedFallback: true,
        reason: 'blocked_host',
      };
    }
    return {
      value: parsed.toString().replace(/\/$/, ''),
      rawValue: candidate,
      usedFallback: false,
      reason: 'configured',
    };
  } catch {
    return {
      value: fallbackValue,
      rawValue: candidate,
      usedFallback: true,
      reason: 'invalid_url',
    };
  }
}

const API_BASE_URL_RESOLUTION = resolveEmailBaseUrlWithDiagnostics(
  process.env.API_BASE_URL,
  CANONICAL_API_FALLBACK,
  BROKEN_API_HOSTS
);
const APP_BASE_URL_RESOLUTION = resolveEmailBaseUrlWithDiagnostics(
  process.env.APP_BASE_URL,
  CANONICAL_APP_FALLBACK,
  BROKEN_APP_HOSTS
);
const API_BASE_URL = API_BASE_URL_RESOLUTION.value;
const APP_BASE_URL = APP_BASE_URL_RESOLUTION.value;
const CONSENT_API_BASE_URL = resolveEmailBaseUrlWithDiagnostics(
  process.env.API_BASE_URL,
  CANONICAL_CONSENT_API_FALLBACK,
  BROKEN_API_HOSTS
).value;
const CUSTOMER_SERVICE_EMAIL = process.env.CUSTOMER_SERVICE_EMAIL || 'support@varsityhub.app';
const PRIVACY_POLICY_URL = `${APP_BASE_URL}/privacy-policy`;
const TERMS_URL = `${APP_BASE_URL}/terms`;
const SUPPORT_URL = `${APP_BASE_URL}/support`;
const REVIEW_LINK_TTL = '7d';

// Common template data (social links, privacy policy, etc.) added to all emails
const getCommonTemplateData = () => ({
  logo_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png',
  footer_logo_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png',
  hero_image_url:
    'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png',
  privacy_policy_url: PRIVACY_POLICY_URL,
  community_guidelines_url: TERMS_URL,
  instagram_url: 'https://www.instagram.com/varsityhubapp/',
  tiktok_url: 'https://www.tiktok.com/@varsityhubapp',
  youtube_url: 'https://www.youtube.com/@varsityhubapp',
  facebook_url: 'https://www.facebook.com/varsityhubapp/',
  x_url: 'https://x.com/varsityhub00',
  website_url: APP_BASE_URL,
  communityGuidelinesUrl: TERMS_URL,
  privacyPolicyUrl: PRIVACY_POLICY_URL,
  support_url: SUPPORT_URL,
  supportUrl: SUPPORT_URL,
  customer_service_email: CUSTOMER_SERVICE_EMAIL,
});

// v1.0.3: trim every env read so paste errors in Railway (leading/trailing
// whitespace, stray newlines) don't get sent to SendGrid as-is — which
// silently fails with "template_id must be a valid GUID". The startup
// validator in index.ts surfaces the dirty values; this helper is the
// belt-and-suspenders at the consumption point.
const tmpl = (key: string, fallbackKey?: string): string => {
  const primary = (process.env[key] || '').trim();
  if (primary) return primary;
  if (fallbackKey) return (process.env[fallbackKey] || '').trim();
  return '';
};

// Approved SendGrid template IDs.
// Per product policy, only templates present in the Railway-approved catalog may be used.
const TEMPLATE_IDS = {
  // Auth & Security
  VERIFICATION: tmpl('SENDGRID_VERIFICATION_TEMPLATE_ID', 'SENDGRID_USER_CONFIRMATION_TEMPLATE_ID'),
  PASSWORD_RESET: tmpl('SENDGRID_PASSWORD_RESET_TEMPLATE_ID'),
  PASSWORD_CHANGED: tmpl('SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID'),

  // Moderation (sent to user when admin takes action against their account)
  ACCOUNT_WARNING: tmpl('SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID'),
  ACCOUNT_SUSPENSION_7_DAYS: tmpl('SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID'),
  ACCOUNT_SUSPENSION_45_DAYS: tmpl('SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID'),
  ACCOUNT_PERMANENT_BAN: tmpl('SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID'),
  ACCOUNT_RECOVERY: tmpl('SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID'),

  // Team & Organization
  TEAM_INVITE: tmpl('SENDGRID_TEAM_INVITE_TEMPLATE_ID'),
  ORG_INVITE: tmpl('SENDGRID_ORG_INVITE_TEMPLATE_ID'),
  JOIN_REQUEST_ADMIN: tmpl(
    'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID',
    'SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID'
  ),
  JOIN_REQUEST_APPROVED: tmpl('SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID'),
  JOIN_REQUEST_DENIED: tmpl('SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID'),

  // Events
  EVENT_APPROVED: tmpl('SENDGRID_EVENT_APPROVED_TEMPLATE_ID'),
  EVENT_DENIED: tmpl('SENDGRID_EVENT_DENIED_TEMPLATE_ID'),
  EVENT_CANCELED: tmpl(
    'SENDGRID_EVENT_CANCELED_TEMPLATE_ID',
    'SENDGRID_EVENT_CANCELLATION_TEMPLATE_ID'
  ),

  // Billing
  PAYMENT_FAILED: tmpl('SENDGRID_PAYMENT_FAILED_TEMPLATE_ID'),
  SUBSCRIPTION_EXPIRING: tmpl('SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID'),

  // Ads
  AD_PENDING_REVIEW: tmpl('SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID'),
  AD_APPROVED: tmpl('SENDGRID_AD_APPROVED_TEMPLATE_ID'),
  AD_REJECTED: tmpl('SENDGRID_AD_REJECTED_TEMPLATE_ID'),
  // Restored after 87aeafa0 removed it as part of "email cleanup". PDF Note 8
  // explicitly requires receipts for ad payments. Env var name kept identical
  // to the pre-removal value so the existing SendGrid template (if still
  // present) works without re-creation.
  AD_PAYMENT_CONFIRMED: tmpl('SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID'),
  // Accept the no-suffix env name as a fallback so a Railway typo
  // (SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW vs the canonical _TEMPLATE_ID)
  // doesn't silently send the local HTML fallback.
  AD_TAKEN_DOWN_PENDING_REVIEW: tmpl(
    'SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW_TEMPLATE_ID',
    'SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW'
  ),

  // Organization approval/rejection (sent to org owner after admin action)
  ORG_APPROVED: tmpl('SENDGRID_ORG_APPROVAL_TEMPLATE_ID'),
  ORG_DENIED: tmpl('SENDGRID_ORG_DENIAL_TEMPLATE_ID'),

  // Admin confirmation (sent to admin after they approve/reject)
  ADMIN_ACTION_CONFIRMATION: tmpl('SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID'),

  // Parental consent for 13-17 users (sent to parent_email on complete-onboarding)
  // Accept the no-suffix env name as a fallback so a Railway typo doesn't
  // force the local HTML fallback path.
  PARENTAL_CONSENT_REQUEST: tmpl(
    'SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID',
    'SENDGRID_PARENTAL_CONSENT_REQUEST'
  ),

  // Roster / membership lifecycle notifications
  ATHLETE_INVITATION: tmpl('SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID'),
  STAFF_MEMBER_JOINED: tmpl('SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID'),
  TEAM_ROSTER_UPDATE: tmpl('SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID'),
  INVITATION_DECLINED: tmpl('SENDGRID_INVITATION_DECLINED_TEMPLATE_ID'),
  ROLE_ASSIGNMENT: tmpl('SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID'),
  ROSTER_THRESHOLD: tmpl('SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID'),

  // Event lifecycle (RSVPs, reminders, submissions, updates)
  EVENT_REMINDER: tmpl('SENDGRID_EVENT_REMINDER_TEMPLATE_ID'),
  EVENT_RSVP_CONFIRMED: tmpl('SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID'),
  EVENT_SUBMISSION_RECEIVED: tmpl('SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID'),
  EVENT_UPDATED: tmpl('SENDGRID_EVENT_UPDATED_TEMPLATE_ID'),

  // Moderation / content takedown (sent to user when their content is moderated)
  CONTENT_REMOVED: tmpl('SENDGRID_CONTENT_REMOVED_TEMPLATE_ID'),
  REPORT_DISMISSED: tmpl('SENDGRID_REPORT_DISMISSED_TEMPLATE_ID'),
  REPORT_RESOLVED: tmpl('SENDGRID_REPORT_RESOLVED_TEMPLATE_ID'),

  // Dedicated templates for split flows (replaces shared JOIN_REQUEST_ADMIN
  // template for two of the four flows that previously reused it). Both accept
  // the no-suffix env name as a fallback for Railway typos.
  COACH_JOIN_REQUEST_OWNER: tmpl(
    'SENDGRID_COACH_JOIN_REQUEST_OWNER_TEMPLATE_ID',
    'SENDGRID_COACH_JOIN_REQUEST_OWNER'
  ),
  EVENT_PENDING_REVIEW_DEDICATED: tmpl(
    'SENDGRID_EVENT_PENDING_REVIEW_TEMPLATE_ID',
    'SENDGRID_EVENT_PENDING_REVIEW'
  ),
};

type TemplateKey = keyof typeof TEMPLATE_IDS;
const SENDGRID_TEMPLATE_ID_COMPACT_REGEX = /^d-[a-f0-9]{32}$/i;
const SENDGRID_TEMPLATE_ID_HYPHENATED_REGEX =
  /^d-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Critical for launch — server exits if missing in production.
// These keys back every transactional template currently exercised by production flows.
export const REQUIRED_TEMPLATE_KEYS: TemplateKey[] = [
  'VERIFICATION',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'TEAM_INVITE',
  'ORG_INVITE',
  'JOIN_REQUEST_ADMIN',
  'JOIN_REQUEST_APPROVED',
  'JOIN_REQUEST_DENIED',
  'EVENT_APPROVED',
  'EVENT_DENIED',
  'EVENT_CANCELED',
  'PAYMENT_FAILED',
  'AD_PENDING_REVIEW',
  'AD_APPROVED',
  'AD_REJECTED',
  'AD_PAYMENT_CONFIRMED',
  'ORG_APPROVED',
  'ORG_DENIED',
  'ADMIN_ACTION_CONFIRMATION',
  'ACCOUNT_WARNING',
  'ACCOUNT_SUSPENSION_7_DAYS',
  'ACCOUNT_SUSPENSION_45_DAYS',
  'ACCOUNT_PERMANENT_BAN',
  'ACCOUNT_RECOVERY',
  'STAFF_MEMBER_JOINED',
  'INVITATION_DECLINED',
  'EVENT_RSVP_CONFIRMED',
  'EVENT_SUBMISSION_RECEIVED',
  'EVENT_UPDATED',
  'CONTENT_REMOVED',
  'REPORT_DISMISSED',
  'REPORT_RESOLVED',
];

// Non-launch-blocking templates still warn when missing, but do not prevent
// the server from booting. Parental consent is operationally important, but a
// missing SendGrid template ID should not take down the whole API.
export const RECOMMENDED_TEMPLATE_KEYS: TemplateKey[] = [
  'PARENTAL_CONSENT_REQUEST',
  'SUBSCRIPTION_EXPIRING',
];

export function isSendGridConfigured(): boolean {
  return isValidSendGridApiKey(SENDGRID_API_KEY);
}

export function getMissingEmailTemplates(
  required: TemplateKey[] = REQUIRED_TEMPLATE_KEYS
): string[] {
  return required
    .filter(key => !isValidSendGridTemplateId(TEMPLATE_IDS[key]))
    .map(key => key.toLowerCase());
}

export function getMissingRecommendedTemplates(): string[] {
  return RECOMMENDED_TEMPLATE_KEYS.filter(key => !isValidSendGridTemplateId(TEMPLATE_IDS[key])).map(
    key => key.toLowerCase()
  );
}

export function isValidSendGridTemplateId(templateId: string | undefined | null): boolean {
  if (typeof templateId !== 'string') return false;
  const trimmed = templateId.trim();
  return (
    SENDGRID_TEMPLATE_ID_COMPACT_REGEX.test(trimmed) ||
    SENDGRID_TEMPLATE_ID_HYPHENATED_REGEX.test(trimmed)
  );
}

export function getEmailBaseUrlDiagnostics() {
  return {
    api: {
      envKey: 'API_BASE_URL',
      rawValue: API_BASE_URL_RESOLUTION.rawValue,
      resolvedValue: API_BASE_URL_RESOLUTION.value,
      fallbackValue: CANONICAL_API_FALLBACK,
      usedFallback: API_BASE_URL_RESOLUTION.usedFallback,
      reason: API_BASE_URL_RESOLUTION.reason,
    },
    app: {
      envKey: 'APP_BASE_URL',
      rawValue: APP_BASE_URL_RESOLUTION.rawValue,
      resolvedValue: APP_BASE_URL_RESOLUTION.value,
      fallbackValue: CANONICAL_APP_FALLBACK,
      usedFallback: APP_BASE_URL_RESOLUTION.usedFallback,
      reason: APP_BASE_URL_RESOLUTION.reason,
    },
  };
}

function buildWebScreenUrl(
  pathname: string,
  params: Record<string, string | null | undefined> = {}
): string {
  const normalizedPath = pathname.replace(/^\/+/, '');
  // Email review + app-handoff routes are served by the API service.
  // Using APP_BASE_URL here breaks moderation emails whenever APP_BASE_URL
  // points at the marketing/app site instead of the Express server.
  const url = new URL(`${API_BASE_URL}/${normalizedPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function buildInviteLandingUrl(kind: 'team' | 'org', inviteId?: string): string {
  const safeInviteId = typeof inviteId === 'string' ? inviteId.trim() : '';
  return safeInviteId
    ? `${APP_BASE_URL}/join/${kind}/${encodeURIComponent(safeInviteId)}`
    : `${APP_BASE_URL}/join/${kind}`;
}

function buildEventDetailUrl(eventId?: string, fallbackUrl?: string): string {
  const safeEventId = typeof eventId === 'string' ? eventId.trim() : '';
  if (safeEventId) return `${APP_BASE_URL}/events/${encodeURIComponent(safeEventId)}`;
  return fallbackUrl || buildWebScreenUrl('/event-detail');
}

// Canonical billing-portal URL. Matches the form the mobile deep-link parser
// recognizes (see utils/deepLinks.ts ROUTE_MAP['settings/manage-subscription']).
function buildManageSubscriptionUrl(): string {
  return `${APP_BASE_URL}/settings/manage-subscription`;
}

function deriveSupportingDocumentPreviewUrl(supportingDocumentUrl?: string | null): string | null {
  const candidate = String(supportingDocumentUrl || '').trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    const pathname = parsed.pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(pathname)) {
      return parsed.toString();
    }
    if (pathname.includes('/image/upload/')) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Initialize email service (now uses new EmailService)
 */
export async function initEmailService() {
  if (isTestEnv && !wantsTestEmailProvider) {
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
  if (missing.length && !isPlaywrightE2E) {
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
  if (missingRecommended.length && !isPlaywrightE2E) {
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
    captureMessage(message, 'warning', {
      context: 'email_unapproved_type_blocked',
      provider: 'sendgrid',
      extra: sanitizeEmailExtras(context),
    });
  }
  return false;
}

function sanitizeEmailExtras<T extends Record<string, unknown> | undefined>(context: T): T {
  if (!context) return context;
  const sanitized = { ...context } as Record<string, unknown>;
  if (typeof sanitized.to === 'string') sanitized.to = redactEmail(sanitized.to);
  if (typeof sanitized.subject === 'string')
    sanitized.subject = sanitizeEmailSubject(sanitized.subject);
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') sanitized[key] = sanitizeEmailLogMessage(value);
  }
  return sanitized as T;
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
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.AD_PENDING_REVIEW;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID — admin will not receive ad review email'
    );
    return false;
  }

  const approveUrl = params.adId ? buildAdReviewUrl({ adId: params.adId, action: 'approve' }) : '';
  const rejectUrl = params.adId ? buildAdReviewUrl({ adId: params.adId, action: 'reject' }) : '';

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
  const reportId = String(params.reportId || params.reportedContentId || '').trim();
  if (!reportId) {
    console.error('[email] Missing abuse report ID — admin review email not sent');
    return false;
  }

  const safeReporterName = escapeHtml(params.reporterName || 'Unknown reporter');
  const safeReporterEmail = escapeHtml(params.reporterEmail || 'unknown@email.com');
  const safeContentType = escapeHtml(params.reportedContentType || 'content');
  const safeContentId = escapeHtml(params.reportedContentId || 'unknown');
  const safeReason = escapeHtml(params.reportReason || 'No reason provided');
  const safeDetails = escapeHtml(params.reportDetails || 'No additional details provided.');
  const safeContext = escapeHtml(
    params.contentContext ? JSON.stringify(params.contentContext, null, 2) : 'No context provided.'
  );
  const resolveUrl = buildAbuseReportReviewUrl({ reportId, action: 'resolve' });
  const dismissUrl = buildAbuseReportReviewUrl({ reportId, action: 'dismiss' });
  const dashboardUrl = buildWebScreenUrl('/admin-reports', { report_id: reportId });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abuse Report Submitted</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F9FAFB;color:#111827;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:24px;">
<h2 style="margin:0 0 12px;color:#1B3A6B;">New abuse report requires review</h2>
<p style="margin:0 0 16px;color:#374151;line-height:1.5;">A new ${safeContentType} report was submitted. Use one of the signed actions below or open the admin dashboard for a full review.</p>
<div style="margin:0 0 20px;padding:16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
<p style="margin:0 0 8px;"><strong>Report ID:</strong> ${escapeHtml(reportId)}</p>
<p style="margin:0 0 8px;"><strong>Reporter:</strong> ${safeReporterName} (${safeReporterEmail})</p>
<p style="margin:0 0 8px;"><strong>Target:</strong> ${safeContentType} (${safeContentId})</p>
<p style="margin:0 0 8px;"><strong>Reason:</strong> ${safeReason}</p>
<p style="margin:0 0 8px;"><strong>Details:</strong><br>${safeDetails.replace(/\n/g, '<br>')}</p>
<p style="margin:0;"><strong>Context:</strong><br><pre style="white-space:pre-wrap;word-break:break-word;background:#111827;color:#F9FAFB;padding:12px;border-radius:10px;font-size:12px;overflow:auto;">${safeContext}</pre></p>
</div>
<p style="margin:0 0 16px;">
<a href="${escapeHtml(resolveUrl)}" style="display:inline-block;background:#16A34A;color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;margin-right:12px;">Resolve Report</a>
<a href="${escapeHtml(dismissUrl)}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">Dismiss Report</a>
</p>
<p style="margin:0;color:#4B5563;line-height:1.5;">Need more context first? <a href="${escapeHtml(dashboardUrl)}" style="color:#1B3A6B;">Open this report in the admin dashboard</a>.</p>
</div>
</body></html>`;

  const text = [
    'New abuse report requires review.',
    `Report ID: ${reportId}`,
    `Reporter: ${params.reporterName || 'Unknown reporter'} (${params.reporterEmail || 'unknown@email.com'})`,
    `Target: ${params.reportedContentType || 'content'} (${params.reportedContentId || 'unknown'})`,
    `Reason: ${params.reportReason || 'No reason provided'}`,
    `Details: ${params.reportDetails || 'No additional details provided.'}`,
    `Context: ${params.contentContext ? JSON.stringify(params.contentContext, null, 2) : 'No context provided.'}`,
    `Resolve: ${resolveUrl}`,
    `Dismiss: ${dismissUrl}`,
    `Dashboard: ${dashboardUrl}`,
  ].join('\n');

  return sendHtmlFallbackEmail({
    to: params.to,
    subject: `Abuse Report: ${params.reportedContentType} requires review`,
    html,
    text,
    logMessage: `Abuse report review email sent to ${params.to} for report ${reportId}`,
    fallbackKey: 'abuse_report_review',
    metadata: reportId ? { report_id: reportId } : undefined,
  });
}

export async function sendAdApprovedEmail(params: {
  to: string;
  businessName?: string;
  note?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.AD_APPROVED;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_AD_APPROVED_TEMPLATE_ID — advertiser will not receive approval email'
    );
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
    console.error(
      '[email] Missing SENDGRID_AD_REJECTED_TEMPLATE_ID — advertiser will not receive rejection email'
    );
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

/**
 * Restored from 87aeafa0 (email cleanup commit). PDF Note 8 explicitly
 * requires payment receipts for ad bookings. Signature kept identical to
 * the pre-removal version so the existing SendGrid template (matching the
 * SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID env var) works as-is.
 */
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
  const templateId = TEMPLATE_IDS.AD_PAYMENT_CONFIRMED;
  if (!templateId) {
    console.warn(
      '[email] Missing SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID — advertiser will not receive payment receipt'
    );
    return false;
  }
  return sendTemplateEmail(
    templateId,
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

export async function sendAdTakenDownPendingReviewEmail(params: {
  to: string;
  businessName?: string;
  reason?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.AD_TAKEN_DOWN_PENDING_REVIEW;
  const subject = `Ad update for "${params.businessName || 'your business'}"`;
  if (!templateId) {
    console.warn(
      '[email] Missing SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW_TEMPLATE_ID — using local takedown email fallback'
    );
    const fallback = buildAdTakedownFallbackEmail({
      subject,
      businessName: params.businessName,
      reason: params.reason,
    });
    return sendHtmlFallbackEmail({
      to: params.to,
      subject,
      html: fallback.html,
      text: fallback.text,
      logMessage: `Ad takedown pending-review email sent to ${params.to}`,
      fallbackKey: 'ad_takedown_pending_review',
    });
  }

  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      business_name: params.businessName || 'your business',
      review_reason: params.reason || '',
      support_email: CUSTOMER_SERVICE_EMAIL,
      app_url: APP_BASE_URL,
    },
    `Ad takedown pending-review email sent to ${params.to}`
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
      // Template renders {{opponent}} unconditionally in the event-details
      // table (event-approved.html:84). Empty string leaves a blank cell;
      // 'TBD' communicates the absence properly.
      opponent: params.opponent || 'TBD',
      organization_name: params.organizationName || 'VarsityHub',
      approval_notes: params.approvalNotes || '',
      view_event_url: buildEventDetailUrl(params.eventId, params.eventLink),
      manage_event_url: params.manageLink || buildWebScreenUrl('/organization?tab=teams'),
    },
    `Event approved email sent to ${params.to}`,
    { metadata: await resolveMinorAuditMetadata(params.to) }
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
  // Added so the template's cancel_reason / canceled_at / organization_name /
  // reschedule_info / upcoming_events_link / contact_organizer_link variables
  // resolve to something — previously they rendered as blank sections in the
  // delivered email. All optional with sensible fallbacks so existing callers
  // continue to work.
  cancelReason?: string;
  canceledAt?: string;
  organizationName?: string;
  rescheduleInfo?: string;
  upcomingEventsLink?: string;
  contactOrganizerLink?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_CANCELED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_CANCELED_TEMPLATE_ID');
    return false;
  }

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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
      view_event_url: buildEventDetailUrl(params.eventId),
      // Template-required fields — fallbacks so the rendered email never has
      // an empty section where these would otherwise interpolate.
      cancel_reason: params.cancelReason || 'No reason provided',
      canceled_at: params.canceledAt || fmtDate(new Date()),
      organization_name: params.organizationName || 'VarsityHub',
      reschedule_info:
        params.rescheduleInfo ||
        'No rescheduled date has been announced yet. Watch your notifications for updates.',
      upcoming_events_link: params.upcomingEventsLink || buildWebScreenUrl('/(tabs)/events'),
      contact_organizer_link: params.contactOrganizerLink || `mailto:${CUSTOMER_SERVICE_EMAIL}`,
    },
    `Event cancelled email sent to ${params.to}`,
    { metadata: await resolveMinorAuditMetadata(params.to) }
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
      // Template uses {{event_date}} unconditionally in both the main
      // sentence and the event-details block. Without it the date renders
      // blank and the rejection email looks half-finished.
      event_date: params.eventDate || params.event_date || 'date not provided',
      denial_reason: params.denialReason || params.reason || '',
      submit_new_event_url: params.resubmitLink || buildWebScreenUrl('/create-fan-event'),
      contact_support_url: params.supportLink || `mailto:${CUSTOMER_SERVICE_EMAIL}`,
      organization_name: params.organizationName || 'VarsityHub',
    },
    `Event denied email sent to ${params.to}`,
    { metadata: await resolveMinorAuditMetadata(params.to) }
  );
}

// sendEventReminderEmail removed — non-mandatory engagement email

// sendEventSubmissionReceivedEmail and sendEventUpdatedEmail are live again.
// Keep the signatures stable; both back current production routes.

// Non-mandatory email functions removed:
// - sendReportResolutionEmail
// - sendRosterThresholdAlertEmail
// - sendStaffInvitationConfirmationEmail
// - sendStaffInvitationEmail

/**
 * Send verification email with 6-digit code
 * Uses SendGrid dynamic template
 */
/**
 * Send the parental consent request email to the minor's parent.
 * The `consentToken` is the RAW token — hashed form is already stored on the
 * user row. The URL format matches the existing email-link moderation pattern
 * (token in query string, server-rendered confirmation page on click).
 */
export async function sendParentalConsentRequestEmail(params: {
  to: string;
  minorDisplayName?: string;
  minorEmail?: string;
  consentToken: string;
  expiresInDays?: number;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.PARENTAL_CONSENT_REQUEST;
  // Parent lands on GET /consent/:token which renders an HTML form with both
  // Approve and Deny buttons. Both URLs point at the same landing page; the
  // older /auth/parental-consent/:token format is not wired up and would 404.
  const consentUrl = `${CONSENT_API_BASE_URL}/consent/${encodeURIComponent(params.consentToken)}`;
  const approveUrl = consentUrl;
  const denyUrl = consentUrl;
  const subject = `Approve ${params.minorDisplayName || 'your child'}'s VarsityHub account`;
  const expiresInDays = params.expiresInDays ?? 14;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID — using local parental consent email fallback'
    );
    const fallback = buildParentalConsentFallbackEmail({
      subject,
      minorDisplayName: params.minorDisplayName,
      minorEmail: params.minorEmail,
      approveUrl,
      denyUrl,
      expiresInDays,
    });
    return sendHtmlFallbackEmail({
      to: params.to,
      subject,
      html: fallback.html,
      text: fallback.text,
      logMessage: `Parental consent request sent to ${params.to}`,
      fallbackKey: 'parental_consent_request',
      metadata: { audit_privacy: 'minor' },
    });
  }
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      minor_display_name: params.minorDisplayName || 'your child',
      minor_email: params.minorEmail || '',
      approve_url: approveUrl,
      deny_url: denyUrl,
      expires_in_days: expiresInDays,
    },
    `Parental consent request sent to ${params.to}`,
    {
      metadata: { audit_privacy: 'minor' },
    }
  );
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  userName?: string
): Promise<boolean> {
  const displayName = userName || 'VarsityHub User';
  const subject = `${token} is your VarsityHub verification code`;
  const verificationUrl = buildWebScreenUrl('/verify', { token, email });
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
      verification_link: verificationUrl,
      action_url: verificationUrl,
      verification_code: token,
      code: token,
      user_name: displayName,
      display_name: displayName,
      expires_in: '30 minutes',
    },
    `Verification email sent to ${email}`,
    { metadata: await resolveMinorAuditMetadata(email) }
  );
}

/**
 * Send password reset email with 6-digit code
 * Uses SendGrid dynamic template
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  const subject = `${code} is your VarsityHub password reset code`;
  const resetUrl = buildWebScreenUrl('/reset-password', { code, email });
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
    `Password reset email sent to ${email}`,
    { metadata: await resolveMinorAuditMetadata(email) }
  );
}

/**
 * Notify a user that their password was changed (post-change confirmation).
 * Fires after both /password/reset and /password/change so the account owner
 * has out-of-band confirmation; useful for account-takeover detection.
 */
export async function sendPasswordChangedEmail(email: string, userName?: string): Promise<boolean> {
  const displayName = userName || 'VarsityHub User';
  const subject = 'Your VarsityHub password was changed';
  const templateId = TEMPLATE_IDS.PASSWORD_CHANGED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID');
    return false;
  }
  return sendTemplateEmail(
    templateId,
    email,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      user_name: displayName,
      display_name: displayName,
      changed_at: new Date().toISOString(),
    },
    `Password changed email sent to ${email}`,
    { metadata: await resolveMinorAuditMetadata(email) }
  );
}

/**
 * Notify a user about a moderation action taken against their account.
 * Single dispatcher for warning, suspension (7 or 45 days), permanent ban,
 * and recovery (unban) — keeps the call sites in admin.ts and moderation.ts
 * one-line.
 */
export async function sendAccountModerationEmail(params: {
  to: string;
  action: 'warning' | 'suspension_7d' | 'suspension_45d' | 'permanent_ban' | 'recovery';
  reason?: string;
  userName?: string;
  endsAt?: Date | null;
}): Promise<boolean> {
  const displayName = params.userName || 'VarsityHub User';
  const reason = params.reason || '';
  const subjectByAction: Record<typeof params.action, string> = {
    warning: 'A moderator issued a warning on your VarsityHub account',
    suspension_7d: 'Your VarsityHub account is suspended for 7 days',
    suspension_45d: 'Your VarsityHub account is suspended for 45 days',
    permanent_ban: 'Your VarsityHub account has been permanently banned',
    recovery: 'Your VarsityHub account has been restored',
  };
  const templateByAction: Record<typeof params.action, string> = {
    warning: TEMPLATE_IDS.ACCOUNT_WARNING,
    suspension_7d: TEMPLATE_IDS.ACCOUNT_SUSPENSION_7_DAYS,
    suspension_45d: TEMPLATE_IDS.ACCOUNT_SUSPENSION_45_DAYS,
    permanent_ban: TEMPLATE_IDS.ACCOUNT_PERMANENT_BAN,
    recovery: TEMPLATE_IDS.ACCOUNT_RECOVERY,
  };
  const templateId = templateByAction[params.action];
  if (!templateId) {
    console.error(`[email] Missing template for moderation action: ${params.action}`);
    return false;
  }
  return sendTemplateEmail(
    templateId,
    params.to,
    subjectByAction[params.action],
    {
      ...getCommonTemplateData(),
      subject: subjectByAction[params.action],
      user_name: displayName,
      display_name: displayName,
      reason,
      ends_at: params.endsAt ? params.endsAt.toISOString() : null,
      support_email: CUSTOMER_SERVICE_EMAIL,
    },
    `Moderation email (${params.action}) sent to ${params.to}`,
    { metadata: await resolveMinorAuditMetadata(params.to) }
  );
}

/**
 * Notify the inviter when their team or org invite is declined.
 */
export async function sendInvitationDeclinedEmail(params: {
  to: string;
  inviterName?: string;
  decliner: string;
  scope: 'team' | 'organization';
  scopeName: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.INVITATION_DECLINED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_INVITATION_DECLINED_TEMPLATE_ID');
    return false;
  }
  const subject = `${params.decliner} declined your ${params.scope} invite`;
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      inviter_name: params.inviterName || 'Coach',
      decliner_name: params.decliner,
      scope: params.scope,
      scope_name: params.scopeName,
    },
    `Invitation declined email sent to ${params.to}`
  );
}

/**
 * Notify a team or org owner that a new staff member accepted their invite.
 */
export async function sendStaffMemberJoinedEmail(params: {
  to: string;
  ownerName?: string;
  newMember: string;
  newMemberRole: string;
  scope: 'team' | 'organization';
  scopeName: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.STAFF_MEMBER_JOINED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID');
    return false;
  }
  const subject = `${params.newMember} joined ${params.scopeName} as ${params.newMemberRole}`;
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      owner_name: params.ownerName || 'Coach',
      new_member_name: params.newMember,
      new_member_role: params.newMemberRole,
      scope: params.scope,
      scope_name: params.scopeName,
    },
    `Staff joined email sent to ${params.to}`
  );
}

/**
 * RSVP confirmation receipt sent to the attendee.
 */
export async function sendEventRsvpConfirmedEmail(params: {
  to: string;
  attendeeName?: string;
  eventTitle: string;
  eventDate: Date;
  eventLocation?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_RSVP_CONFIRMED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID');
    return false;
  }
  const subject = `You're going to ${params.eventTitle}`;
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      attendee_name: params.attendeeName || 'You',
      event_title: params.eventTitle,
      event_date: params.eventDate.toISOString(),
      event_location: params.eventLocation || '',
    },
    `RSVP confirmed email sent to ${params.to}`
  );
}

/**
 * Receipt to the fan/coach who submitted an event for review.
 */
export async function sendEventSubmissionReceivedEmail(params: {
  to: string;
  submitterName?: string;
  eventTitle: string;
  needsApproval: boolean;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_SUBMISSION_RECEIVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID');
    return false;
  }
  const subject = params.needsApproval
    ? `We received your event submission: ${params.eventTitle}`
    : `Your event is live: ${params.eventTitle}`;
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      submitter_name: params.submitterName || 'You',
      event_title: params.eventTitle,
      needs_approval: params.needsApproval,
    },
    `Event submission email sent to ${params.to}`
  );
}

/**
 * Notify attendees when a material event field changes (date, location).
 */
export async function sendEventUpdatedEmail(params: {
  to: string;
  attendeeName?: string;
  eventTitle: string;
  changes: string[];
  newDate?: Date | null;
  newLocation?: string | null;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.EVENT_UPDATED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_EVENT_UPDATED_TEMPLATE_ID');
    return false;
  }
  const subject = `Update for ${params.eventTitle}`;
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      attendee_name: params.attendeeName || 'You',
      event_title: params.eventTitle,
      changes: params.changes,
      new_date: params.newDate ? params.newDate.toISOString() : null,
      new_location: params.newLocation || null,
    },
    `Event updated email sent to ${params.to}`
  );
}

/**
 * Notify the author when their content (post/comment/story) is removed by a moderator.
 */
export async function sendContentRemovedEmail(params: {
  to: string;
  authorName?: string;
  contentType: 'post' | 'comment' | 'story';
  reason?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.CONTENT_REMOVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_CONTENT_REMOVED_TEMPLATE_ID');
    return false;
  }
  const subject = `Your ${params.contentType} was removed by a moderator`;
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      author_name: params.authorName || 'You',
      content_type: params.contentType,
      reason: params.reason || 'Violation of community guidelines',
      support_email: CUSTOMER_SERVICE_EMAIL,
    },
    `Content removed email (${params.contentType}) sent to ${params.to}`,
    { metadata: await resolveMinorAuditMetadata(params.to) }
  );
}

/**
 * Notify a reporter when their abuse report is dismissed or resolved.
 * Combined dispatcher because the only difference is the template + subject.
 */
export async function sendReportStatusEmail(params: {
  to: string;
  reporterName?: string;
  status: 'dismissed' | 'resolved';
  resolutionNote?: string;
}): Promise<boolean> {
  const templateId =
    params.status === 'resolved' ? TEMPLATE_IDS.REPORT_RESOLVED : TEMPLATE_IDS.REPORT_DISMISSED;
  if (!templateId) {
    console.error(`[email] Missing SENDGRID_REPORT_${params.status.toUpperCase()}_TEMPLATE_ID`);
    return false;
  }
  const subject =
    params.status === 'resolved'
      ? 'Update on your report — action taken'
      : 'Update on your report — no action taken';
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      reporter_name: params.reporterName || 'You',
      status: params.status,
      resolution_note: params.resolutionNote || '',
    },
    `Report ${params.status} email sent to ${params.to}`
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
  const prettyRole =
    params.role?.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) || 'member';
  const inviterName = params.inviterName || 'VarsityHub Coach';
  const subject = `You've been invited to join ${params.teamName}`;
  const inviteUrl = buildInviteLandingUrl('team', params.inviteToken);

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
      acceptLink: inviteUrl,
      declineLink: inviteUrl,
      accept_link: inviteUrl,
      decline_link: inviteUrl,
      invite_url: inviteUrl,
      team_hero_url: params.teamHeroUrl || `${APP_BASE_URL}/default-team-hero.jpg`,
      team_logo_url: params.teamLogoUrl || '',
      primary_color: params.primaryColor || '#2563EB',
    },
    `Team invite sent to ${params.to} for ${params.teamName}`,
    { metadata: await resolveMinorAuditMetadata(params.to) }
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
  logMessage: string,
  options?: {
    metadata?: Record<string, string>;
  }
): Promise<boolean> {
  if (!templateId) {
    // v1.0.2 audit fix: missing template IDs in production cause approval emails to silently drop.
    // Log at error level so Railway + Sentry surface these loudly.
    const msg = `[email] Template ID not configured for: ${sanitizeEmailSubject(subject)}`;
    if (process.env.NODE_ENV === 'production') {
      console.error(msg);
      captureMessage(msg, 'error', { context: 'sendgrid_template_missing', provider: 'sendgrid' });
    } else {
      console.warn(msg);
      captureMessage(msg, 'warning', {
        context: 'sendgrid_template_missing',
        provider: 'sendgrid',
      });
    }
    return false;
  }

  if (!isValidSendGridTemplateId(templateId)) {
    const msg = `[email] Invalid SendGrid template ID configured for: ${sanitizeEmailSubject(subject)}`;
    console.error(msg);
    captureMessage(msg, 'error', {
      context: 'sendgrid_template_invalid',
      provider: 'sendgrid',
      extra: sanitizeEmailExtras({ templateId, to, subject, logMessage }),
    });
    return false;
  }

  const service = await getEmailService();
  if (!service || !service.isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(
        `[email] Email service not configured in production — template email dropped: ${sanitizeEmailLogMessage(logMessage)}`
      );
      console.error(err.message);
      captureException(err, {
        context: 'sendgrid_service_unconfigured',
        provider: 'sendgrid',
        extra: sanitizeEmailExtras({ to, subject, logMessage }),
      });
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
      metadata: options?.metadata,
    });

    if (result.success) {
      console.log(`✅ ${sanitizeEmailLogMessage(logMessage)}`);
      return true;
    } else {
      console.error(
        `❌ Failed: ${sanitizeEmailLogMessage(logMessage)}`,
        sanitizeEmailLogMessage(result.error)
      );
      captureException(
        result.error ?? new Error(`Email send failed: ${sanitizeEmailLogMessage(logMessage)}`),
        {
          context: 'sendgrid_send_failed',
          provider: 'sendgrid',
          extra: sanitizeEmailExtras({ to, subject, logMessage, templateId }),
        }
      );
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${sanitizeEmailLogMessage(logMessage)}`, error);
    captureException(error, {
      context: 'sendgrid_send_threw',
      provider: 'sendgrid',
      extra: sanitizeEmailExtras({ to, subject, logMessage, templateId }),
    });
    return false;
  }
}

async function sendHtmlFallbackEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  logMessage: string;
  fallbackKey: string;
  metadata?: Record<string, string>;
}): Promise<boolean> {
  const service = await getEmailService();
  if (!service || !service.isConfigured()) {
    const err = new Error(
      `[email] Email service not configured — fallback email dropped: ${sanitizeEmailLogMessage(params.logMessage)}`
    );
    console.error(err.message);
    captureException(err, {
      context: 'sendgrid_fallback_service_unconfigured',
      provider: 'sendgrid',
      extra: sanitizeEmailExtras({
        to: params.to,
        subject: params.subject,
        fallbackKey: params.fallbackKey,
      }),
    });
    return false;
  }

  captureMessage(
    `[email] Hosted SendGrid template missing; using local HTML fallback (${params.fallbackKey})`,
    'warning',
    {
      context: 'sendgrid_local_fallback_used',
      provider: 'sendgrid',
      extra: sanitizeEmailExtras({
        to: params.to,
        subject: params.subject,
        fallbackKey: params.fallbackKey,
      }),
    }
  );

  try {
    const replyTo = process.env.SUPPORT_REPLY_TO || 'support@varsityhub.app';
    const result = await service.send({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo,
      metadata: params.metadata,
    });

    if (result.success) {
      console.log(`✅ ${sanitizeEmailLogMessage(params.logMessage)} (local fallback)`);
      return true;
    }

    console.error(
      `❌ Failed: ${sanitizeEmailLogMessage(params.logMessage)} (local fallback)`,
      sanitizeEmailLogMessage(result.error)
    );
    captureException(
      result.error ??
        new Error(`Email fallback send failed: ${sanitizeEmailLogMessage(params.logMessage)}`),
      {
        context: 'sendgrid_fallback_send_failed',
        provider: 'sendgrid',
        extra: sanitizeEmailExtras({
          to: params.to,
          subject: params.subject,
          fallbackKey: params.fallbackKey,
        }),
      }
    );
    return false;
  } catch (error: any) {
    console.error(
      `❌ Failed: ${sanitizeEmailLogMessage(params.logMessage)} (local fallback)`,
      error
    );
    captureException(error, {
      context: 'sendgrid_fallback_send_threw',
      provider: 'sendgrid',
      extra: sanitizeEmailExtras({
        to: params.to,
        subject: params.subject,
        fallbackKey: params.fallbackKey,
      }),
    });
    return false;
  }
}

function buildParentalConsentFallbackEmail(params: {
  subject: string;
  minorDisplayName?: string;
  minorEmail?: string;
  approveUrl: string;
  denyUrl: string;
  expiresInDays: number;
}): { html: string; text: string } {
  const minorName = escapeHtml(params.minorDisplayName || 'your child');
  const minorEmail = escapeHtml(params.minorEmail || '');
  const approveUrl = escapeHtml(params.approveUrl);
  const denyUrl = escapeHtml(params.denyUrl);
  const supportEmail = escapeHtml(CUSTOMER_SERVICE_EMAIL);
  const expiresInDays = String(params.expiresInDays);
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;">
    <p style="margin:0 0 10px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1B3A6B;font-weight:700;">Parental consent required</p>
    <h1 style="margin:0 0 16px;font-size:28px;line-height:1.3;">Approve ${minorName}'s VarsityHub account</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#475569;">
      A child or teen in your household signed up for VarsityHub. Because they are under 18, a parent or guardian must review and approve the account before it can be activated.
    </p>
    <div style="margin:0 0 20px;padding:18px;border:1px solid #bae6fd;border-radius:14px;background:#f0f9ff;">
      <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:#0ea5e9;font-weight:700;">Account details</p>
      <p style="margin:0 0 6px;font-size:14px;"><strong>Name:</strong> ${minorName}</p>
      ${minorEmail ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Email:</strong> ${minorEmail}</p>` : ''}
      <p style="margin:0;font-size:14px;"><strong>Expires in:</strong> ${expiresInDays} days</p>
    </div>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155;">
      By approving this request, you confirm that you are a parent or guardian of the minor listed above and consent to their VarsityHub account being activated.
    </p>
    <p style="margin:0 0 16px;text-align:center;">
      <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;">Approve account</a>
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${denyUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;">Deny request</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
      Questions? Contact <a href="mailto:${supportEmail}" style="color:#1B3A6B;text-decoration:none;">${supportEmail}</a>.
    </p>
  </div>
</body>
</html>`;
  const text = [
    `Approve ${params.minorDisplayName || 'your child'}'s VarsityHub account`,
    '',
    'A child or teen in your household signed up for VarsityHub and requires parent or guardian approval before their account can be activated.',
    `Name: ${params.minorDisplayName || 'your child'}`,
    params.minorEmail ? `Email: ${params.minorEmail}` : undefined,
    `Expires in: ${expiresInDays} days`,
    '',
    `Approve: ${params.approveUrl}`,
    `Deny: ${params.denyUrl}`,
    '',
    `Questions? Contact ${CUSTOMER_SERVICE_EMAIL}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { html, text };
}

function buildAdTakedownFallbackEmail(params: {
  subject: string;
  businessName?: string;
  reason?: string;
}): { html: string; text: string } {
  const businessName = escapeHtml(params.businessName || 'your business');
  const reason = escapeHtml(
    params.reason || 'Your ad was temporarily taken down for moderation review.'
  );
  const supportEmail = escapeHtml(CUSTOMER_SERVICE_EMAIL);
  const appUrl = escapeHtml(APP_BASE_URL);
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;">
    <p style="margin:0 0 10px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#b45309;font-weight:700;">Ad under review</p>
    <h1 style="margin:0 0 16px;font-size:28px;line-height:1.3;">Your ad for ${businessName} was temporarily taken down</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#475569;">
      We removed your ad from rotation while it goes through an additional moderation review. This does not necessarily mean the ad was permanently rejected.
    </p>
    <div style="margin:0 0 20px;padding:18px;border:1px solid #fde68a;border-radius:14px;background:#fffbeb;">
      <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:#b45309;font-weight:700;">Review reason</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;">${reason}</p>
    </div>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155;">
      Open the VarsityHub app to review your campaign. If the moderation team needs changes, you will receive a follow-up update.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${appUrl}" style="display:inline-block;background:#1B3A6B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;">Open VarsityHub</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
      Questions? Contact <a href="mailto:${supportEmail}" style="color:#1B3A6B;text-decoration:none;">${supportEmail}</a>.
    </p>
  </div>
</body>
</html>`;
  const text = [
    `Your ad for ${params.businessName || 'your business'} was temporarily taken down`,
    '',
    'We removed your ad from rotation while it goes through additional moderation review.',
    `Reason: ${params.reason || 'Your ad was temporarily taken down for moderation review.'}`,
    '',
    `Open VarsityHub: ${APP_BASE_URL}`,
    `Questions? Contact ${CUSTOMER_SERVICE_EMAIL}`,
  ].join('\n');
  return { html, text };
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
  const inviteUrl = buildInviteLandingUrl('org', params.inviteToken);

  return sendTemplateEmail(
    TEMPLATE_IDS.ORG_INVITE,
    params.to,
    `You've been invited to join ${params.organizationName}`,
    {
      ...getCommonTemplateData(),
      recipientName: params.recipientName || '',
      organizationName: params.organizationName,
      // The org-invitation template still renders {{teamName}} as the
      // primary subject line ("Join {{teamName}} Coaching Staff") — likely
      // because it was forked from the team-invite template. Until the
      // SendGrid-hosted template gets a clean organizationName migration,
      // mirror the org name into teamName so the email reads correctly.
      teamName: params.organizationName,
      role: prettyRole,
      inviterName: params.inviterName || 'VarsityHub Admin',
      acceptLink: inviteUrl,
      declineLink: inviteUrl,
      accept_link: inviteUrl,
      decline_link: inviteUrl,
      invite_url: inviteUrl,
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
 *
 * The SendGrid templates `payment-failed.html` and `subscription-expiring.html`
 * use camelCase variable names (`userName`, `planName`, `failedAmount`,
 * `daysRemaining`, `renewalDate`, etc.) — NOT the snake_case keys that the
 * rest of this module uses. Prior to this fix the server only sent snake_case
 * keys, so payment-failed and trial-ending emails rendered with every
 * critical field blank: no user name, no amount, no retry date, no features-
 * losing list. Users could receive "Your payment failed" emails with zero
 * actionable information.
 *
 * Fix: send BOTH naming conventions so the template renders correctly no
 * matter which naming scheme any given template revision uses, and fall back
 * to sane defaults for fields the caller can't compute (retryDate, contact
 * link, etc.). Callers with richer context (Stripe invoice objects) can now
 * supply the precise values.
 */
export async function sendBillingNoticeEmail(params: {
  to: string;
  user_name?: string;
  // Only `payment_failed` has a live production trigger today.
  // `trial_ending` remains available for manual probes / future reactivation,
  // but it is not startup-critical because the scheduler was intentionally removed.
  // The broader union remains for backward compatibility with stale callers;
  // unsupported variants are blocked below and should be removed at call sites.
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
  // New optional fields matching what the SendGrid templates actually
  // reference. Callers with Stripe invoice/subscription context should
  // supply these; callers without them get reasonable defaults.
  failedDate?: string;
  retryDate?: string;
  paymentMethodLast4?: string;
  daysRemaining?: number;
  expiresDate?: string;
  renewalDate?: string;
  renewalPrice?: string;
  featuresLosing?: string[];
}): Promise<boolean> {
  if (params.type === 'payment_failed') {
    const templateId = TEMPLATE_IDS.PAYMENT_FAILED;
    if (!templateId) {
      console.error('[email] Missing SENDGRID_PAYMENT_FAILED_TEMPLATE_ID');
      return false;
    }

    // Reasonable defaults — Stripe's smart retry typically retries failed
    // invoices within 3-4 days. Use today for failedDate and today+3 for
    // retryDate when the caller doesn't supply exact values from the invoice.
    const today = new Date();
    const threeDaysOut = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const manageSubscriptionLink = params.manageLink || buildManageSubscriptionUrl();

    return sendTemplateEmail(
      templateId,
      params.to,
      'Payment Failed — VarsityHub',
      {
        ...getCommonTemplateData(),
        // Canonical keys the template uses (camelCase)
        userName: params.user_name || '',
        planName: params.planName || 'VarsityHub Subscription',
        failedAmount: params.amount || '',
        failedDate: params.failedDate || fmt(today),
        retryDate: params.retryDate || fmt(threeDaysOut),
        // Template renders "Card ending in {{paymentMethodLast4}}"
        // unconditionally (payment-failed.html:76). '****' renders as
        // a placeholder that doesn't look broken when the caller didn't
        // resolve the actual last-4 from the Stripe invoice.
        paymentMethodLast4: params.paymentMethodLast4 || '****',
        updatePaymentLink: manageSubscriptionLink,
        contactSupportLink: `mailto:${CUSTOMER_SERVICE_EMAIL}`,
        // Compatibility keys for template revisions that render extra detail
        // lines (for example, refund explanations on failed ad reservations).
        perks: params.perks || [],
        message_lines: params.perks || [],
        additional_context: (params.perks || []).join('\n'),
        // Legacy snake_case keys preserved for template-version compatibility
        user_name: params.user_name || '',
        plan_name: params.planName || 'VarsityHub Subscription',
        amount: params.amount || '',
        manage_subscription_url: manageSubscriptionLink,
        manage_url: manageSubscriptionLink,
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

    const manageSubscriptionLink = params.manageLink || buildManageSubscriptionUrl();

    // Compute a date fallback from daysRemaining when the caller didn't
    // resolve the exact subscription period_end. Templates use these
    // unconditionally in the subject line and details table; empty
    // strings render obviously-broken text like "Your subscription
    // renews on " in the inbox preview.
    const fmtDate = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const fallbackExpires = fmtDate(
      new Date(Date.now() + (params.daysRemaining ?? 0) * 24 * 60 * 60 * 1000)
    );

    return sendTemplateEmail(
      templateId,
      params.to,
      'Subscription Expiring — VarsityHub',
      {
        ...getCommonTemplateData(),
        // Canonical keys the template uses (camelCase)
        userName: params.user_name || '',
        planName: params.planName || 'VarsityHub Subscription',
        daysRemaining: params.daysRemaining ?? 0,
        expiresDate: params.expiresDate || fallbackExpires,
        renewalDate: params.renewalDate || fallbackExpires,
        renewalPrice: params.renewalPrice || 'your current subscription price',
        manageSubscriptionLink,
        renewLink: manageSubscriptionLink,
        // Template uses {{#each features_losing}} — must be an array, even
        // empty, or the section silently collapses.
        features_losing: params.featuresLosing || params.perks || [],
        perks: params.perks || [],
        // Legacy snake_case keys preserved for template-version compatibility
        user_name: params.user_name || '',
        plan_name: params.planName || 'VarsityHub Subscription',
        manage_subscription_url: manageSubscriptionLink,
        manage_url: manageSubscriptionLink,
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
  /** Name shown in the "Coach" row of the email (the person being reviewed). */
  requesterName: string;
  requesterUsername?: string;
  /** Contact email of the requester — shown or linked in the request details. */
  requesterEmail: string;
  /** Only platform-admin review flows should expose the requester's email. */
  includeRequesterEmail?: boolean;
  /** Name used to greet the admin reviewing the request. */
  adminName?: string;
  sport?: string;
  orgType?: string;
  approveUrl?: string;
  rejectUrl?: string;
  supportingDocumentUrl?: string;
  coachNotes?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.JOIN_REQUEST_ADMIN;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID or SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID'
    );
    return false;
  }

  const requesterEmail = params.includeRequesterEmail ? params.requesterEmail : '';

  // The SendGrid join-request-admin template renders `{{requester_name}}`,
  // `{{org_name}}`, `{{admin_name}}`, `{{deny_url}}`, `{{coach_notes}}`,
  // `{{org_logo_url}}`. Previously the helper sent `league_name`/`owner_name`/
  // `reject_url`, none of which the template references — so the "Coach:" and
  // "League:" rows rendered blank and the Deny button had no href. Send both
  // canonical (template-matching) and legacy keys.
  return sendTemplateEmail(
    templateId,
    params.to,
    params.subject,
    {
      ...getCommonTemplateData(),
      // Canonical keys that match join-request-admin.html
      requester_name: params.requesterName,
      requester_username: params.requesterUsername || '',
      org_name: params.leagueName,
      admin_name: params.adminName || 'Admin',
      approve_url: params.approveUrl || '',
      deny_url: params.rejectUrl || '',
      coach_notes: params.coachNotes || '',
      org_logo_url:
        params.orgLogoUrl || deriveSupportingDocumentPreviewUrl(params.supportingDocumentUrl) || '',
      // Legacy keys (preserved for backward compatibility with any other
      // template revisions that may reference them)
      league_name: params.leagueName,
      owner_name: params.requesterName,
      owner_email: requesterEmail,
      requester_email: requesterEmail,
      sport: params.sport || 'Not specified',
      org_type: params.orgType || 'Not specified',
      created_date: new Date().toLocaleDateString(),
      reject_url: params.rejectUrl || '',
      supporting_document_url: params.supportingDocumentUrl || '',
      supporting_document_link: params.supportingDocumentUrl
        ? `<a href="${params.supportingDocumentUrl}">View Supporting Document</a>`
        : '',
    },
    `Join request admin email sent to ${params.to}`
  );
}

export function buildAdReviewUrl(params: {
  adId: string;
  action?: 'approve' | 'reject';
  token?: string;
}): string {
  const action = params.action === 'reject' ? 'reject' : 'approve';
  const token =
    params.token ||
    signReviewToken(
      {
        adId: params.adId,
        action: action === 'reject' ? 'reject_ad' : 'approve_ad',
      },
      REVIEW_LINK_TTL
    );
  return buildWebScreenUrl(`/ads/${encodeURIComponent(params.adId)}/${action}`, { token });
}

export function buildEventReviewUrl(params: {
  reviewId: string;
  reviewKind?: 'event' | 'game';
  action?: 'approve' | 'reject';
  token?: string;
}): string {
  const reviewKind = params.reviewKind || 'event';
  const action = params.action === 'reject' ? 'reject' : 'approve';
  const token =
    params.token ||
    signReviewToken(
      {
        reviewId: params.reviewId,
        reviewKind,
        action:
          reviewKind === 'game'
            ? action === 'reject'
              ? 'reject_game'
              : 'approve_game'
            : action === 'reject'
              ? 'reject_event'
              : 'approve_event',
      },
      REVIEW_LINK_TTL
    );
  const basePath = reviewKind === 'game' ? 'games' : 'events';
  return buildWebScreenUrl(`/${basePath}/${encodeURIComponent(params.reviewId)}/${action}`, {
    token,
  });
}

function buildAppReviewUrl(
  pathname: string,
  params: Record<string, string | null | undefined>
): string {
  return buildWebScreenUrl(pathname, params);
}

export function buildCoachJoinRequestReviewUrl(params: {
  organizationId: string;
  organizationName?: string | null;
  requestId?: string | null;
  action?: 'approve' | 'reject';
  token?: string;
}): string {
  const action = params.action === 'reject' ? 'reject' : 'approve';
  const requestId = String(params.requestId || '').trim();
  // Without a requestId we can't sign a meaningful token — fall back to the
  // app-handoff page (deep-link into the app for manual review).
  if (!requestId) {
    return buildAppReviewUrl('/organization-join-requests', {
      organization_id: params.organizationId,
      organization_name: params.organizationName || undefined,
      action,
    });
  }
  const token =
    params.token ||
    signReviewToken(
      {
        requestId,
        orgId: params.organizationId,
        action: action === 'reject' ? 'reject_join_request' : 'approve_join_request',
      },
      REVIEW_LINK_TTL
    );
  // Direct one-click review hosted on the API server. Mirrors the league
  // approval pattern: signed token IS the authorization, owner does not
  // need to sign in to the app to approve.
  return buildWebScreenUrl(
    `/organizations/join-requests/${encodeURIComponent(requestId)}/email/${action}`,
    { token }
  );
}

export function buildCoachApplicationReviewUrl(params: {
  coachId: string;
  action?: 'approve' | 'reject';
  token?: string;
}): string {
  const action = params.action === 'reject' ? 'reject' : 'approve';
  const token =
    params.token ||
    signReviewToken(
      {
        coachId: params.coachId,
        action: action === 'reject' ? 'reject_coach' : 'approve_coach',
      },
      REVIEW_LINK_TTL
    );
  return buildWebScreenUrl(`/admin/coaches/${encodeURIComponent(params.coachId)}/${action}`, {
    token,
  });
}

export function buildLeagueApprovalReviewUrl(params: {
  leagueId: string;
  action?: 'approve' | 'reject';
  token?: string;
}): string {
  const action = params.action === 'reject' ? 'reject' : 'approve';
  const token =
    params.token ||
    signReviewToken(
      {
        orgId: params.leagueId,
        action: action === 'reject' ? 'reject_league' : 'approve_league',
      },
      REVIEW_LINK_TTL
    );
  return buildWebScreenUrl(`/organizations/${encodeURIComponent(params.leagueId)}/${action}`, {
    token,
  });
}

export function buildAbuseReportReviewUrl(params: {
  reportId: string;
  action?: 'resolve' | 'dismiss';
  token?: string;
}): string {
  const action = params.action === 'dismiss' ? 'dismiss' : 'resolve';
  const token =
    params.token ||
    signReviewToken(
      {
        reportId: params.reportId,
        action: action === 'dismiss' ? 'dismiss_abuse_report' : 'resolve_abuse_report',
      },
      REVIEW_LINK_TTL
    );
  return buildWebScreenUrl(`/admin/reports/${encodeURIComponent(params.reportId)}/${action}`, {
    token,
  });
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
  // Use app review links for admin actions so the reviewer lands in the
  // authenticated admin dashboard instead of a browser confirmation page.
  const approveUrl = buildLeagueApprovalReviewUrl({
    leagueId: params.leagueId,
    action: 'approve',
    token: params.approveToken,
  });
  const rejectUrl = buildLeagueApprovalReviewUrl({
    leagueId: params.leagueId,
    action: 'reject',
    token: params.rejectToken,
  });

  // v1.0.2 audit fix: send to ALL admin emails, not just the first
  const { getAllAdminEmails } = await import('./adminEmails.js');
  const adminEmails = getAllAdminEmails();

  // Send to all admins in parallel. The requester in this flow is the
  // league-owner applicant (the one who just created the league and needs
  // platform approval).
  const results = await Promise.all(
    adminEmails.map(to =>
      sendJoinRequestAdminTemplate({
        to,
        subject: `New League Awaiting Approval: ${params.leagueName}`,
        leagueName: params.leagueName,
        requesterName: params.ownerName,
        requesterEmail: params.ownerEmail,
        adminName: 'Admin',
        sport: params.sport,
        orgType: params.orgType,
        approveUrl,
        rejectUrl,
        supportingDocumentUrl: params.supportingDocumentUrl,
        includeRequesterEmail: true,
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
  coachUsername?: string;
  coachEmail: string;
  organizationName: string;
  organizationId: string;
  requestId?: string;
  approveUrl?: string;
  rejectUrl?: string;
  coachNotes?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.COACH_JOIN_REQUEST_OWNER;
  const subject = `New Coach Request: ${params.coachName} wants to join ${params.organizationName}`;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_COACH_JOIN_REQUEST_OWNER_TEMPLATE_ID — falling back to shared admin template'
    );
    return sendJoinRequestAdminTemplate({
      to: params.ownerEmail,
      subject,
      leagueName: params.organizationName,
      requesterName: params.coachName,
      requesterUsername: params.coachUsername,
      requesterEmail: params.coachEmail,
      adminName: params.ownerName,
      sport: 'N/A',
      orgType: 'Coach join request',
      approveUrl: params.approveUrl,
      rejectUrl: params.rejectUrl,
      coachNotes: params.coachNotes,
      includeRequesterEmail: false,
    });
  }
  return sendTemplateEmail(
    templateId,
    params.ownerEmail,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      owner_name: params.ownerName,
      coach_name: params.coachName,
      coach_email: '',
      organization_name: params.organizationName,
      approve_url: params.approveUrl || '',
      reject_url: params.rejectUrl || '',
      coach_notes: params.coachNotes || '',
    },
    `Coach join request email sent to ${params.ownerEmail}`
  );
}

export async function sendCoachApplicationAdminEmail(params: {
  to: string;
  applicantName: string;
  applicantUsername?: string;
  applicantEmail: string;
  applicantUserId?: string;
  organizationName?: string;
  approveUrl?: string;
  rejectUrl?: string;
  coachNotes?: string;
  supportingDocumentUrl?: string;
}): Promise<boolean> {
  return sendJoinRequestAdminTemplate({
    to: params.to,
    subject: `New coach application: ${params.applicantName}`,
    leagueName: params.organizationName || 'VarsityHub Coach Application',
    requesterName: params.applicantName,
    requesterUsername: params.applicantUsername,
    requesterEmail: params.applicantEmail,
    adminName: 'Admin',
    sport: 'N/A',
    orgType: 'Coach application',
    approveUrl: params.approveUrl,
    rejectUrl: params.rejectUrl,
    coachNotes: params.coachNotes,
    supportingDocumentUrl: params.supportingDocumentUrl,
  });
}

export async function sendEventPendingReviewEmail(params: {
  to: string;
  reviewerName?: string;
  requesterName?: string;
  requesterUsername?: string;
  requesterEmail?: string;
  eventTitle: string;
  eventType?: string;
  teamName?: string;
  reviewId: string;
  reviewKind?: 'event' | 'game';
  approveUrl?: string;
  rejectUrl?: string;
  coachNotes?: string;
  includeRequesterEmail?: boolean;
}): Promise<boolean> {
  const reviewKind = params.reviewKind || 'event';
  const subject = `New ${reviewKind} awaiting approval: ${params.eventTitle}`;
  const approveUrl =
    params.approveUrl ||
    buildEventReviewUrl({
      reviewId: params.reviewId,
      reviewKind,
      action: 'approve',
    });
  const rejectUrl =
    params.rejectUrl ||
    buildEventReviewUrl({
      reviewId: params.reviewId,
      reviewKind,
      action: 'reject',
    });
  const templateId = TEMPLATE_IDS.EVENT_PENDING_REVIEW_DEDICATED;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_EVENT_PENDING_REVIEW_TEMPLATE_ID — falling back to shared admin template'
    );
    return sendJoinRequestAdminTemplate({
      to: params.to,
      subject,
      leagueName: params.teamName || 'VarsityHub Event Review',
      requesterName: params.requesterName || 'VarsityHub User',
      requesterUsername: params.requesterUsername,
      requesterEmail: params.requesterEmail || '',
      adminName: params.reviewerName || 'Reviewer',
      sport: params.eventType || 'Event',
      orgType: reviewKind === 'game' ? 'Pending game review' : 'Pending event review',
      approveUrl,
      rejectUrl,
      coachNotes: params.coachNotes,
      includeRequesterEmail: params.includeRequesterEmail === true,
    });
  }
  return sendTemplateEmail(
    templateId,
    params.to,
    subject,
    {
      ...getCommonTemplateData(),
      subject,
      reviewer_name: params.reviewerName || 'Reviewer',
      requester_name: params.requesterName || 'VarsityHub User',
      requester_email: params.includeRequesterEmail === true ? params.requesterEmail || '' : '',
      event_title: params.eventTitle,
      event_type: params.eventType || 'Event',
      team_name: params.teamName || 'VarsityHub',
      review_kind: reviewKind,
      approve_url: approveUrl,
      reject_url: rejectUrl,
      coach_notes: params.coachNotes || '',
    },
    `Event pending review email sent to ${params.to}`
  );
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
    console.error(
      '[email] Missing SENDGRID_ORG_APPROVAL_TEMPLATE_ID — org owner will not receive approval email'
    );
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
      dashboard_url: buildWebScreenUrl('/organization?tab=teams'),
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
    console.error(
      '[email] Missing SENDGRID_ORG_DENIAL_TEMPLATE_ID — org owner will not receive rejection email'
    );
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
  destination?: 'organization' | 'coach_agreement' | 'coach_final_setup';
}): Promise<boolean> {
  const subject = `Congratulations on being accepted!`;
  const templateId = TEMPLATE_IDS.JOIN_REQUEST_APPROVED;
  if (!templateId) {
    console.error('[email] Missing SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID');
    return false;
  }

  const destination = params.destination || 'organization';
  const destinationUrl =
    destination === 'coach_agreement'
      ? buildWebScreenUrl('/onboarding/coach-agreement')
      : destination === 'coach_final_setup'
        ? buildWebScreenUrl('/onboarding/step-3-league')
        : buildWebScreenUrl('/organization?tab=teams');

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
      org_url: destinationUrl,
      dashboard_url: destinationUrl,
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
  action: 'league_approved' | 'league_rejected' | 'ad_approved' | 'ad_rejected';
  leagueName: string;
  ownerName?: string;
  ownerEmail?: string;
  reason?: string;
}): Promise<boolean> {
  const templateId = TEMPLATE_IDS.ADMIN_ACTION_CONFIRMATION;
  if (!templateId) {
    console.error(
      '[email] Missing SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID — admin will not receive confirmation'
    );
    return false;
  }

  const actionLabel =
    params.action === 'league_approved' || params.action === 'ad_approved'
      ? 'Approved'
      : 'Rejected';

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
      // Template renders {{reason}} unconditionally
      // (admin-action-confirmation.html:59). Without a default the
      // paragraph renders empty; "No reason provided" is the same
      // language used elsewhere in the email layer.
      reason: params.reason || 'No reason provided',
    },
    `Admin action confirmation (${params.action}) sent to ${params.to}`
  );
}

// Non-mandatory email functions removed:
// - sendNewCoachRequestEmail, sendAthleteInvitationEmail
// - sendRoleAssignmentEmail, sendInvitationDeclinedEmail
// - sendTeamRosterUpdateEmail, sendUserConfirmationEmail
