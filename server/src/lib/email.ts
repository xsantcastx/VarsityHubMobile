import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
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
};

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export function initEmailService() {
  if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('✅ SendGrid email service initialized');
  } else {
    console.warn('⚠️ SENDGRID_API_KEY not set - emails will not be sent');
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
    console.log(`✅ Verification email sent to ${email}`);
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
    console.log(`✅ Password reset email sent to ${email}`);
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
    console.log(`✅ Team invite sent to ${params.to} for ${params.teamName}`);
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
    console.log(`✅ Organization invite sent to ${params.to} for ${params.organizationName}`);
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
    console.log(`✅ Abuse report sent to customer service from ${params.reporterEmail}`);
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
    console.log(`✅ Join request notification sent to ${params.adminEmail}`);
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
    console.log(`✅ Join request approved notification sent to ${params.userEmail}`);
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
    console.log(`✅ Join request denied notification sent to ${params.userEmail}`);
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
    console.log(`✅ Organization approval email sent to ${params.to}`);
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
    console.log(`✅ Organization denial email sent to ${params.to}`);
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
        next_steps: params.nextSteps || 'If you believe this is a mistake, reply to this email and we'll review it.',
      },
    });
    console.log(`✅ Content moderation email sent to ${params.to} (action: ${params.action})`);
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
    console.log(`✅ Billing notice sent to ${params.to} (type: ${params.type})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send billing notice:', error);
    return false;
  }
}

