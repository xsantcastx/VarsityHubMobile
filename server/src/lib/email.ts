import sgMail from '@sendgrid/mail';
import { debugLog } from './debugLog.js';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
// Default from email and base URL are safe non-secret values used only for fallback
// Production environments override these with ENV variables
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');

// Template IDs for SendGrid dynamic templates
const TEMPLATE_IDS = {
  VERIFICATION: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || '',
  TEAM_INVITE: process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID || '',
  ORG_INVITE: process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID || '',
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',
  ABUSE_REPORT: process.env.SENDGRID_ABUSE_REPORT_TEMPLATE_ID || '',
  JOIN_REQUEST_ADMIN: process.env.SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID || '',
  JOIN_REQUEST_APPROVED: process.env.SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID || '',
  JOIN_REQUEST_DENIED: process.env.SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID || '',
  ORG_APPROVAL: process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID || '',
  ORG_DENIAL: process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID || '',
  CONTENT_MODERATION: process.env.SENDGRID_CONTENT_MODERATION_TEMPLATE_ID || '',
  BILLING_NOTICE: process.env.SENDGRID_BILLING_NOTICE_TEMPLATE_ID || '',
  COACH_ONBOARDING: process.env.SENDGRID_COACH_ONBOARDING_TEMPLATE_ID || '',
  FAN_WELCOME: process.env.SENDGRID_FAN_WELCOME_TEMPLATE_ID || '',
  PAYMENT_RECEIPT: process.env.SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID || '',
  PAYMENT_FAILED: process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID || '',
  SUBSCRIPTION_CANCELED: process.env.SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID || '',
  MEMBERSHIP_APPROVED: process.env.SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID || '',
  MEMBERSHIP_DENIED: process.env.SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID || '',
  EVENT_APPROVED: process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID || '',
  EVENT_REJECTED: process.env.SENDGRID_EVENT_REJECTED_TEMPLATE_ID || '',
  SECURITY_ALERT: process.env.SENDGRID_SECURITY_ALERT_TEMPLATE_ID || '',
  PLAN_LIMIT_WARNING: process.env.SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID || '',
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

if (SENDGRID_API_KEY) {
  // snyk:ignore=Use of Hardcoded Credentials
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export function isSendGridConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

export function getMissingEmailTemplates(required: TemplateKey[] = REQUIRED_TEMPLATE_KEYS): string[] {
  return required
    .filter((key) => !TEMPLATE_IDS[key])
    .map((key) => key.toLowerCase());
}

export function initEmailService() {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SENDGRID_API_KEY not set - emails will not be sent');
    return;
  }

  // snyk:ignore=Use of Hardcoded Credentials
  sgMail.setApiKey(SENDGRID_API_KEY);
  const missing = getMissingEmailTemplates();
  if (missing.length) {
    console.warn(`[email] SendGrid template IDs missing: ${missing.join(', ')}`);
  } else {
    debugLog('✅ SendGrid email service initialized (all required templates configured)');
  }
}

/**
 * Send verification email with 6-digit code
 */
export async function sendVerificationEmail(email: string, token: string, userName?: string): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.VERIFICATION) {
    console.warn('[email] SendGrid verification template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.VERIFICATION,
      dynamicTemplateData: {
        verification_link: `${APP_BASE_URL}/verify?token=${encodeURIComponent(token)}`,
        user_name: userName || 'Varsity Hub user',
        verification_code: token,
      },
    });
    debugLog(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    return false;
  }
}

/**
 * Send password reset email with 6-digit code
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PASSWORD_RESET) {
    console.warn('[email] SendGrid password reset template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PASSWORD_RESET,
      dynamicTemplateData: {
        reset_code: code,
        expires_in: '30 minutes',
      },
    });
    debugLog(`✅ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return false;
  }
}

/**
 * Send team invite with personalized team branding
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
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.TEAM_INVITE) {
    console.warn('[email] SendGrid team invite template not configured');
    return false;
  }

  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'member';

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.TEAM_INVITE,
      dynamicTemplateData: {
        recipient_name: params.recipientName || '',
        team_name: params.teamName,
        org_name: params.organizationName || '',
        role: prettyRole,
        inviter_name: params.inviterName || 'VarsityHub Coach',
        invite_url: `${APP_BASE_URL}/invites`,
        hero_image: params.teamHeroUrl || `${APP_BASE_URL}/default-team-hero.jpg`,
        logo_image: params.teamLogoUrl || `${APP_BASE_URL}/default-team-logo.jpg`,
        primary_color: params.primaryColor || '#2563EB',
      },
    });
    debugLog(`✅ Team invite sent to ${params.to} for ${params.teamName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send team invite:', error);
    return false;
  }
}

/**
 * Send organization invite with personalized org branding
 */
export async function sendOrganizationInviteEmail(params: {
  to: string;
  organizationName: string;
  role?: string;
  inviterName?: string;
  orgLogoUrl?: string;
  primaryColor?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.ORG_INVITE) {
    console.warn('[email] SendGrid org invite template not configured');
    return false;
  }

  const prettyRole = params.role?.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'member';

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.ORG_INVITE,
      dynamicTemplateData: {
        org_name: params.organizationName,
        role: prettyRole,
        inviter_name: params.inviterName || 'VarsityHub Admin',
        invite_url: `${APP_BASE_URL}/invites`,
        logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
        primary_color: params.primaryColor || '#2563EB',
      },
    });
    debugLog(`✅ Organization invite sent to ${params.to} for ${params.organizationName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send organization invite:', error);
    return false;
  }
}

/**
 * Send abuse report notification to customer service
 */
export async function sendAbuseReportNotification(params: {
  reporterName: string;
  reporterEmail: string;
  subject: string;
  message: string;
  userId?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.ABUSE_REPORT) {
    console.warn('[email] SendGrid abuse report template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: process.env.CUSTOMER_SERVICE_EMAIL || 'customerservice@varsityhub.app',
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.ABUSE_REPORT,
      dynamicTemplateData: {
        reporter_name: params.reporterName,
        reporter_email: params.reporterEmail,
        subject: params.subject,
        message: params.message,
        user_id: params.userId || '',
        submitted_at: new Date().toLocaleString(),
      },
    });
    debugLog(`✅ Abuse report sent to customer service from ${params.reporterEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send abuse report:', error);
    return false;
  }
}

/**
 * Send join request notification to organization admin
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
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.JOIN_REQUEST_ADMIN) {
    console.warn('[email] SendGrid join request admin template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.adminEmail,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.JOIN_REQUEST_ADMIN,
      dynamicTemplateData: {
        admin_name: params.adminName,
        requester_name: params.requesterName,
        org_name: params.organizationName,
        message: params.message || '',
        approve_url: `${APP_BASE_URL}/organizations/join-requests/${params.requestId}/approve`,
        deny_url: `${APP_BASE_URL}/organizations/join-requests/${params.requestId}/deny`,
        logo_image: params.orgLogoUrl || `${APP_BASE_URL}/default-org-logo.jpg`,
      },
    });
    debugLog(`✅ Join request notification sent to ${params.adminEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send join request notification:', error);
    return false;
  }
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
 * Send coach onboarding welcome email with role-specific content
 */
export async function sendCoachOnboardingEmail(params: {
  to: string;
  coachName: string;
  plan: 'rookie' | 'veteran' | 'legend';
  teamName?: string;
  organizationName?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.COACH_ONBOARDING) {
    console.warn('[email] SendGrid coach onboarding template not configured');
    return false;
  }

  // Customize content based on plan
  const planDescriptions: Record<string, { title: string; features: string[] }> = {
    rookie: {
      title: 'Rookie Coach - Free Plan',
      features: [
        'Create and manage up to 2 teams',
        'Invite players to your teams',
        'Post game schedules and updates',
        'Track basic team stats',
      ],
    },
    veteran: {
      title: 'Veteran Coach - Premium Plan',
      features: [
        'Create unlimited teams',
        'Invite up to 5 authorized users per team',
        'Advanced team analytics and statistics',
        'Priority support',
        'Manage organization memberships',
      ],
    },
    legend: {
      title: 'Legend Coach - Elite Plan',
      features: [
        'Unlimited teams and authorized users',
        'Full organization management tools',
        'Advanced analytics and reporting',
        'Priority 24/7 support',
        'Custom team branding and styling',
        'Create extracurricular clubs',
      ],
    },
  };

  const planInfo = planDescriptions[params.plan] || planDescriptions.rookie;

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.COACH_ONBOARDING,
      dynamicTemplateData: {
        coach_name: params.coachName,
        plan: params.plan.toUpperCase(),
        plan_title: planInfo.title,
        team_name: params.teamName || 'Your Team',
        org_name: params.organizationName || '',
        features: planInfo.features,
        dashboard_url: `${APP_BASE_URL}/(tabs)/feed`,
        manage_teams_url: `${APP_BASE_URL}/manage-teams`,
        invite_players_url: `${APP_BASE_URL}/manage-teams`,
      },
    });
    debugLog(`✅ Coach onboarding email sent to ${params.to} (plan: ${params.plan})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send coach onboarding email:', error);
    return false;
  }
}

/**
 * Send fan welcome email
 */
export async function sendFanWelcomeEmail(params: {
  to: string;
  fanName: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.FAN_WELCOME) {
    console.warn('[email] SendGrid fan welcome template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.FAN_WELCOME,
      dynamicTemplateData: {
        fan_name: params.fanName,
        explore_url: `${APP_BASE_URL}/(tabs)/feed`,
        nearby_games_url: `${APP_BASE_URL}/game-map`,
        create_post_url: `${APP_BASE_URL}/create-post`,
      },
    });
    debugLog(`✅ Fan welcome email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send fan welcome email:', error);
    return false;
  }
}

export async function sendPaymentReceiptEmail(params: {
  to: string;
  planName: string;
  amount: string;
  billingPeriod: string;
  invoiceUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PAYMENT_RECEIPT) {
    console.warn('[email] SendGrid payment receipt template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PAYMENT_RECEIPT,
      dynamicTemplateData: {
        plan_name: params.planName,
        amount: params.amount,
        billing_period: params.billingPeriod,
        invoice_url: params.invoiceUrl || `${APP_BASE_URL}/billing`,
      },
    });
    debugLog(`✅ Payment receipt email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send payment receipt email:', error);
    return false;
  }
}

export async function sendPaymentFailedEmail(params: {
  to: string;
  planName: string;
  reason?: string;
  manageUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PAYMENT_FAILED) {
    console.warn('[email] SendGrid payment failed template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PAYMENT_FAILED,
      dynamicTemplateData: {
        plan_name: params.planName,
        reason: params.reason || 'Your card was declined.',
        manage_url: params.manageUrl || `${APP_BASE_URL}/settings/subscription`,
      },
    });
    debugLog(`✅ Payment failure email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send payment failure email:', error);
    return false;
  }
}

export async function sendSubscriptionCanceledEmail(params: {
  to: string;
  planName: string;
  renewalDate?: string;
  reactivateUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.SUBSCRIPTION_CANCELED) {
    console.warn('[email] SendGrid subscription canceled template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.SUBSCRIPTION_CANCELED,
      dynamicTemplateData: {
        plan_name: params.planName,
        renewal_date: params.renewalDate || 'end of current period',
        reactivate_url: params.reactivateUrl || `${APP_BASE_URL}/settings/subscription`,
      },
    });
    debugLog(`✅ Subscription canceled email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send subscription canceled email:', error);
    return false;
  }
}

export async function sendMembershipDecisionEmail(params: {
  to: string;
  teamName: string;
  organizationName?: string;
  approved: boolean;
  manageUrl?: string;
}): Promise<boolean> {
  const templateId = params.approved ? TEMPLATE_IDS.MEMBERSHIP_APPROVED : TEMPLATE_IDS.MEMBERSHIP_DENIED;
  if (!SENDGRID_API_KEY || !templateId) {
    console.warn('[email] SendGrid membership decision template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        team_name: params.teamName,
        org_name: params.organizationName || '',
        manage_url: params.manageUrl || `${APP_BASE_URL}/teams`,
      },
    });
    debugLog(`✅ Membership ${params.approved ? 'approved' : 'denied'} email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send membership decision email:', error);
    return false;
  }
}

export async function sendEventDecisionEmail(params: {
  to: string;
  eventName: string;
  eventDate?: string;
  approved: boolean;
  reviewUrl?: string;
  reason?: string;
}): Promise<boolean> {
  const templateId = params.approved ? TEMPLATE_IDS.EVENT_APPROVED : TEMPLATE_IDS.EVENT_REJECTED;
  if (!SENDGRID_API_KEY || !templateId) {
    console.warn('[email] SendGrid event decision template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        event_name: params.eventName,
        event_date: params.eventDate || '',
        review_url: params.reviewUrl || `${APP_BASE_URL}/events`,
        reason: params.reason || '',
      },
    });
    debugLog(`✅ Event ${params.approved ? 'approved' : 'rejected'} email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send event decision email:', error);
    return false;
  }
}

export async function sendSecurityAlertEmail(params: {
  to: string;
  alertType: 'password_change' | 'new_device' | 'email_change';
  ipAddress?: string;
  location?: string;
  manageUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.SECURITY_ALERT) {
    console.warn('[email] SendGrid security alert template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.SECURITY_ALERT,
      dynamicTemplateData: {
        alert_type: params.alertType,
        ip_address: params.ipAddress || 'Unknown',
        location: params.location || 'Unknown location',
        manage_url: params.manageUrl || `${APP_BASE_URL}/settings/security`,
      },
    });
    debugLog(`✅ Security alert email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send security alert email:', error);
    return false;
  }
}

export async function sendPlanLimitWarningEmail(params: {
  to: string;
  planName: string;
  resourceType: 'team' | 'organization';
  used: number;
  limit: number | null;
  upgradeUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PLAN_LIMIT_WARNING) {
    console.warn('[email] SendGrid plan limit warning template not configured');
    return false;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PLAN_LIMIT_WARNING,
      dynamicTemplateData: {
        plan_name: params.planName,
        resource_type: params.resourceType,
        used_count: params.used,
        limit: params.limit === null ? 'Unlimited' : params.limit,
        upgrade_url: params.upgradeUrl || `${APP_BASE_URL}/settings/subscription`,
      },
    });
    debugLog(`✅ Plan limit warning email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send plan limit warning email:', error);
    return false;
  }
}

/**
 * Send ad reservation confirmation email
 * Sent immediately after advertiser books dates
 */
export async function sendAdReservationEmail(params: {
  to: string;
  advertiserName: string;
  businessName: string;
  reservedDates: string[]; // ISO date strings
  totalCost: number; // in dollars
  targetZip: string;
  checkoutLink: string;
  adPreviewUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PAYMENT_RECEIPT) {
    console.warn('[email] SendGrid email not configured for ad reservations');
    return false;
  }

  const formattedDates = reservedDates.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(', ');

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PAYMENT_RECEIPT, // Reuse payment receipt template structure
      dynamicTemplateData: {
        advertiser_name: params.advertiserName,
        business_name: params.businessName,
        reserved_dates: formattedDates,
        date_count: params.reservedDates.length,
        total_cost: `$${params.totalCost.toFixed(2)}`,
        target_zip: params.targetZip,
        checkout_link: params.checkoutLink,
        ad_preview_url: params.adPreviewUrl || '',
      },
    });
    debugLog(`✅ Ad reservation email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send ad reservation email:', error);
    return false;
  }
}

/**
 * Send payment required / checkout abandoned reminder email
 * Sent N hours after reservation if payment not completed
 */
export async function sendPaymentRequiredEmail(params: {
  to: string;
  advertiserName: string;
  businessName: string;
  totalCost: number;
  checkoutLink: string;
  hoursRemaining: number;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PAYMENT_FAILED) {
    console.warn('[email] SendGrid email not configured for payment reminders');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PAYMENT_FAILED, // Reuse template
      dynamicTemplateData: {
        advertiser_name: params.advertiserName,
        business_name: params.businessName,
        total_cost: `$${params.totalCost.toFixed(2)}`,
        checkout_link: params.checkoutLink,
        hours_remaining: params.hoursRemaining,
        expiry_message: `Your reservation expires in ${params.hoursRemaining} hours`,
      },
    });
    debugLog(`✅ Payment required email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send payment required email:', error);
    return false;
  }
}

/**
 * Send "Ad Goes Live" notification email
 * Sent when ad first appears in feeds (date range enters "current")
 */
export async function sendAdGoesLiveEmail(params: {
  to: string;
  advertiserName: string;
  businessName: string;
  adTitle: string;
  targetZip: string;
  liveUntilDate: string; // ISO date
  analyticsDashboardUrl: string;
  adPreviewUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.BILLING_NOTICE) {
    console.warn('[email] SendGrid email not configured for ad go-live notification');
    return false;
  }

  const liveUntilFormatted = new Date(liveUntilDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.BILLING_NOTICE,
      dynamicTemplateData: {
        advertiser_name: params.advertiserName,
        business_name: params.businessName,
        ad_title: params.adTitle,
        target_zip: params.targetZip,
        live_until: liveUntilFormatted,
        analytics_dashboard: params.analyticsDashboardUrl,
        ad_preview: params.adPreviewUrl || '',
      },
    });
    debugLog(`✅ Ad goes live email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send ad goes live email:', error);
    return false;
  }
}

/**
 * P1: Send roster threshold alert to coach
 * Triggers when team reaches roster size threshold that affects billing
 */
export async function sendRosterThresholdAlertEmail(params: {
  to: string;
  coachName: string;
  teamName: string;
  rosterCount: number;
  thresholdCost: number;
  manageBillingUrl: string;
}) {
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.BILLING_NOTICE,
      dynamicTemplateData: {
        coach_name: params.coachName,
        team_name: params.teamName,
        roster_count: params.rosterCount,
        threshold_cost: `$${params.thresholdCost.toFixed(2)}/month`,
        manage_billing_url: params.manageBillingUrl,
        action_text: 'Review Billing & Team Settings',
      },
    });
    debugLog(`✅ Roster threshold alert sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send roster threshold alert:', error);
    return false;
  }
}

/**
 * P1: Send staff invitation email to invitee
 * Sent when head coach invites assistant coach or staff member
 */
export async function sendStaffInvitationEmail(params: {
  to: string;
  inviteeName: string;
  inviterName: string;
  teamName: string;
  inviteLink: string;
  expiryDays: number;
  onboardingUrl: string;
}) {
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.TEAM_INVITE,
      dynamicTemplateData: {
        invitee_name: params.inviteeName,
        inviter_name: params.inviterName,
        team_name: params.teamName,
        invite_link: params.inviteLink,
        expiry_days: params.expiryDays,
        onboarding_url: params.onboardingUrl,
      },
    });
    debugLog(`✅ Staff invitation email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send staff invitation email:', error);
    return false;
  }
}

/**
 * P1: Send staff invitation confirmation email to head coach
 * Confirms that invitation was sent successfully
 */
export async function sendStaffInvitationConfirmationEmail(params: {
  to: string;
  coachName: string;
  inviteeName: string;
  inviteeEmail: string;
  teamName: string;
  manageBillingUrl: string;
}) {
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.TEAM_INVITE,
      dynamicTemplateData: {
        coach_name: params.coachName,
        invitee_name: params.inviteeName,
        invitee_email: params.inviteeEmail,
        team_name: params.teamName,
        manage_staff_url: params.manageBillingUrl,
        action_text: 'Manage Staff',
      },
    });
    debugLog(`✅ Staff invitation confirmation sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send staff invitation confirmation:', error);
    return false;
  }
}

/**
 * P1: Send report resolution notification
 * Sent when abuse/violation report is resolved by Trust & Safety team
 */
export async function sendReportResolutionEmail(params: {
  to: string;
  userName: string;
  reportType: string;
  resolutionStatus: 'resolved' | 'dismissed';
  resolutionReason: string;
  appealUrl: string;
}) {
  try {
    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.SYSTEM_NOTIFICATION,
      dynamicTemplateData: {
        user_name: params.userName,
        report_type: params.reportType,
        resolution_status: params.resolutionStatus,
        resolution_reason: params.resolutionReason,
        appeal_url: params.appealUrl,
        action_text: 'Review Decision',
      },
    });
    debugLog(`✅ Report resolution email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send report resolution email:', error);
    return false;
  }
}
