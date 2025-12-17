import sgMail from '@sendgrid/mail';
import { debugLog } from './debugLog.js';

// Initialize SendGrid

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');

const TEMPLATE_IDS = {
  // Auth & Security
  VERIFICATION: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || '',
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',
  PASSWORD_CHANGED: process.env.SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID || '',
  ACCOUNT_RECOVERY: process.env.SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID || '',
  LOGIN_NEW_DEVICE: process.env.SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID || '',
  SECURITY_ALERT: process.env.SENDGRID_SECURITY_ALERT_TEMPLATE_ID || '',

  // Support & Trust
  ABUSE_REPORT: process.env.SENDGRID_ABUSE_REPORT_TEMPLATE_ID || '',
  REPORT_RESOLVED: process.env.SENDGRID_REPORT_RESOLVED_TEMPLATE_ID || '',
  REPORT_DISMISSED: process.env.SENDGRID_REPORT_DISMISSED_TEMPLATE_ID || '',
  ACCOUNT_WARNING: process.env.SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID || '',
  CONTENT_REMOVED: process.env.SENDGRID_CONTENT_REMOVED_TEMPLATE_ID || '',
  ACCOUNT_SUSPENSION_7_DAYS: process.env.SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID || '',
  ACCOUNT_SUSPENSION_45_DAYS: process.env.SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID || '',
  ACCOUNT_PERMANENT_BAN: process.env.SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID || '',
  CONTENT_MODERATION: process.env.SENDGRID_CONTENT_MODERATION_TEMPLATE_ID || '',

  // Event Management
  EVENT_SUBMISSION_RECEIVED: process.env.SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID || '',
  EVENT_APPROVED: process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID || '',
  EVENT_DENIED: process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID || '',
  EVENT_REMINDER: process.env.SENDGRID_EVENT_REMINDER_TEMPLATE_ID || '',
  EVENT_UPDATED: process.env.SENDGRID_EVENT_UPDATED_TEMPLATE_ID || '',
  EVENT_CANCELED: process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID || '',
  EVENT_RSVP_CONFIRMED: process.env.SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID || '',

  // Membership & Invitations
  ORGANIZATION_INVITATION:
    process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID || process.env.SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID || '',
  TEAM_INVITATION:
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID || process.env.SENDGRID_TEAM_INVITATION_TEMPLATE_ID || '',
  ATHLETE_INVITATION: process.env.SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID || '',
  ROLE_ASSIGNMENT: process.env.SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID || '',
  ROSTER_THRESHOLD: process.env.SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID || '',
  INVITATION_DECLINED: process.env.SENDGRID_INVITATION_DECLINED_TEMPLATE_ID || '',
  TEAM_ROSTER_UPDATE: process.env.SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID || '',
  MEMBER_REMOVED: process.env.SENDGRID_MEMBER_REMOVED_TEMPLATE_ID || '',
  STAFF_MEMBER_JOINED: process.env.SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID || '',
  STAFF_INVITATION: process.env.SENDGRID_STAFF_INVITATION_TEMPLATE_ID || '',
  STAFF_INVITATION_CONFIRMATION: process.env.SENDGRID_STAFF_INVITATION_CONFIRMATION_TEMPLATE_ID || '',

  // Organizations
  USER_CONFIRMATION: process.env.SENDGRID_USER_CONFIRMATION_TEMPLATE_ID || '',
  ORG_APPROVAL: process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID || '',
  ORG_DENIAL: process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID || '',

  // Billing & Plans
  PAYMENT_FAILED: process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID || '',
  PAYMENT_RECEIPT: process.env.SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID || '',
  BILLING_NOTICE: process.env.SENDGRID_BILLING_NOTICE_TEMPLATE_ID || '',
  SUBSCRIPTION_CANCELED: process.env.SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID || '',
  SUBSCRIPTION_EXPIRING: process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID || '',
  PLAN_LIMIT_WARNING: process.env.SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID || '',

  // Ads & Monetization
  AD_RESERVATION: process.env.SENDGRID_AD_RESERVATION_TEMPLATE_ID || '',
  PAYMENT_REQUIRED: process.env.SENDGRID_PAYMENT_REQUIRED_TEMPLATE_ID || '',
  AD_GOES_LIVE: process.env.SENDGRID_AD_GOES_LIVE_TEMPLATE_ID || '',

  // Lifecycle & Engagement
  COACH_ONBOARDING: process.env.SENDGRID_COACH_ONBOARDING_TEMPLATE_ID || '',
  FAN_WELCOME: process.env.SENDGRID_FAN_WELCOME_TEMPLATE_ID || '',
  SEASON_WRAP_UP: process.env.SENDGRID_SEASON_WRAP_UP_TEMPLATE_ID || '',
  POST_HIGHLIGHT: process.env.SENDGRID_POST_HIGHLIGHT_TEMPLATE_ID || '',
  ATHLETE_FOLLOWER_NOTIFICATION: process.env.SENDGRID_ATHLETE_FOLLOWER_NOTIFICATION_TEMPLATE_ID || '',
  PROFILE_COMPLETION_NUDGE: process.env.SENDGRID_PROFILE_COMPLETION_NUDGE_TEMPLATE_ID || '',
  DORMANT_USER_DIGEST: process.env.SENDGRID_DORMANT_USER_DIGEST_TEMPLATE_ID || '',
} as const;

type TemplateKey = keyof typeof TEMPLATE_IDS;
const REQUIRED_TEMPLATE_KEYS: TemplateKey[] = ['VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'ACCOUNT_RECOVERY'];

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export function isSendGridConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

async function sendTemplateEmail(
  templateKey: TemplateKey,
  label: string,
  to: string,
  dynamicTemplateData: Record<string, any>
): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn(`[email] SendGrid API key not configured; cannot send ${label}`);
    return false;
  }
  const templateId = TEMPLATE_IDS[templateKey];
  if (!templateId) {
    console.warn(`[email] ${label} template (${templateKey}) not configured`);
    return false;
  }
  try {
    await sgMail.send({
      to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData,
    });
    debugLog(`✅ ${label} email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send ${label} email to ${to}:`, error);
    return false;
  }
}

export function getMissingEmailTemplates(required: TemplateKey[] = REQUIRED_TEMPLATE_KEYS): string[] {
  return required.filter((key) => !TEMPLATE_IDS[key]).map((key) => key.toLowerCase());
}

export function initEmailService() {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SENDGRID_API_KEY not set - emails will not be sent');
    return;
  }

  sgMail.setApiKey(SENDGRID_API_KEY);
  const missing = getMissingEmailTemplates();
  if (missing.length) {
    console.warn(`[email] SendGrid template IDs missing: ${missing.join(', ')}`);
  } else {
    debugLog('✅ SendGrid email service initialized (password reset, password changed, account recovery)');
  }
}

const chicagoTimeFormat = { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Chicago' } as const;

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  userName?: string,
  resetLink?: string,
  expiresInLabel: string = '1 hour'
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PASSWORD_RESET) {
    console.warn('[email] SendGrid password reset template not configured');
    return false;
  }

  const link = resetLink || `${APP_BASE_URL}/reset/${encodeURIComponent(code)}`;

  try {
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PASSWORD_RESET,
      dynamicTemplateData: {
        USERNAME: userName || 'VarsityHub member',
        RESET_LINK: link,
        expires_in: expiresInLabel,
        reset_code: code,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return false;
  }
}

export async function sendPasswordChangedEmail(
  email: string,
  userName?: string,
  changeDate?: string
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.PASSWORD_CHANGED) {
    console.warn('[email] SendGrid password changed template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.PASSWORD_CHANGED,
      dynamicTemplateData: {
        USERNAME: userName || 'VarsityHub member',
        CHANGE_DATE: changeDate || new Date().toLocaleString('en-US', chicagoTimeFormat),
        USER_EMAIL: email,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Password changed alert sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password changed email:', error);
    return false;
  }
}

export async function sendAccountRecoveryEmail(
  email: string,
  userName?: string,
  recoveryDate?: string
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.ACCOUNT_RECOVERY) {
    console.warn('[email] SendGrid account recovery template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.ACCOUNT_RECOVERY,
      dynamicTemplateData: {
        USERNAME: userName || 'VarsityHub member',
        ACCOUNT_EMAIL: email,
        RECOVERY_DATE: recoveryDate || new Date().toLocaleString('en-US', chicagoTimeFormat),
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Account recovery email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send account recovery email:', error);
    return false;
  }
}

const disabledEmail = async (name: string): Promise<boolean> => {
  console.warn(`[email] ${name} is disabled (template removed)`);
  return false;
};

const makeDisabled = (name: string) => async (..._args: any[]): Promise<boolean> => disabledEmail(name);

export async function sendVerificationEmail(
  email: string,
  code: string,
  userName?: string
): Promise<boolean> {
  const verificationLink = `${APP_BASE_URL}/verify-email?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
  return sendTemplateEmail('VERIFICATION', 'verification', email, {
    verification_code: code,
    verification_link: verificationLink,
    user_name: userName || 'VarsityHub member',
  });
}

// Support & Organization notifications
export async function sendAbuseReportNotification(params: {
  reporterName: string;
  reporterEmail: string;
  subject: string;
  message: string;
  userId?: string | null;
  reportedUserId?: string | null;
  reportedUserEmail?: string | null;
  reportedUserName?: string | null;
  contextUrl?: string | null;
  submittedAt?: string;
  to?: string;
}): Promise<boolean> {
  const destination =
    params.to || process.env.CUSTOMER_SERVICE_EMAIL || process.env.SUPPORT_EMAIL || EMAIL_FROM;
  if (!destination) {
    console.warn('[email] No destination configured for abuse reports');
    return false;
  }

  return sendTemplateEmail('ABUSE_REPORT', 'abuse report notification', destination, {
    reporter_name: params.reporterName,
    reporter_email: params.reporterEmail,
    subject: params.subject,
    message: params.message,
    user_id: params.userId || undefined,
    reported_user_id: params.reportedUserId || undefined,
    reported_user_email: params.reportedUserEmail || undefined,
    reported_user_name: params.reportedUserName || undefined,
    context_url: params.contextUrl || undefined,
    submitted_at: params.submittedAt || new Date().toISOString(),
  });
}

export async function sendOrganizationApprovalEmail(params: {
  to: string;
  organizationName: string;
  dashboardLink?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('ORG_APPROVAL', 'organization approval', params.to, {
    org_name: params.organizationName,
    dashboard_url: params.dashboardLink || `${APP_BASE_URL}/organizations`,
    logo_image: params.orgLogoUrl || undefined,
  });
}

export async function sendOrganizationDenialEmail(params: {
  to: string;
  organizationName: string;
  reason?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('ORG_DENIAL', 'organization denial', params.to, {
    org_name: params.organizationName,
    reason: params.reason || 'Please review your submission and try again.',
    logo_image: params.orgLogoUrl || undefined,
  });
}

export async function sendContentModerationEmail(params: {
  to: string;
  action: 'removed' | 'flagged' | 'restored';
  postId?: string;
  reason?: string;
  nextSteps?: string;
}): Promise<boolean> {
  return sendTemplateEmail('CONTENT_MODERATION', 'content moderation', params.to, {
    action: params.action,
    post_id: params.postId || '',
    reason: params.reason || '',
    next_steps: params.nextSteps || 'Reply to this email if you have questions.',
  });
}

// Billing & subscriptions
type BillingNoticeType = 'payment_succeeded' | 'payment_failed' | 'subscription_canceled' | 'subscription_renewed';

export async function sendBillingNoticeEmail(params: {
  to: string;
  type: BillingNoticeType;
  planName: string;
  amount?: string | null;
  manageUrl?: string;
  teamName?: string | null;
  orgName?: string | null;
  perks?: string[];
}): Promise<boolean> {
  return sendTemplateEmail('BILLING_NOTICE', 'billing notice', params.to, {
    notice_type: params.type,
    plan_name: params.planName,
    amount: params.amount || '$0.00',
    manage_url: params.manageUrl || `${APP_BASE_URL}/billing`,
    team_name: params.teamName || undefined,
    org_name: params.orgName || undefined,
    perks: params.perks && params.perks.length ? params.perks : undefined,
  });
}

type CoachPlan = 'rookie' | 'veteran' | 'legend';

const coachPlanBenefits: Record<CoachPlan, string[]> = {
  rookie: ['2 free teams', 'Basic messaging', 'Community feed access'],
  veteran: ['Unlimited staff invites', 'Advanced analytics', '$1.50 per extra team'],
  legend: ['Unlimited teams', 'Premium support', 'Season highlight packages'],
};

export async function sendCoachOnboardingEmail(params: {
  to: string;
  coachName: string;
  plan: CoachPlan;
  teamName?: string | null;
  organizationName?: string | null;
  dashboardUrl?: string;
}): Promise<boolean> {
  const planLabel = params.plan.charAt(0).toUpperCase() + params.plan.slice(1);
  return sendTemplateEmail('COACH_ONBOARDING', 'coach onboarding', params.to, {
    coach_name: params.coachName,
    plan_name: planLabel,
    team_name: params.teamName || 'Your VarsityHub Team',
    organization_name: params.organizationName || 'Your program',
    plan_features: coachPlanBenefits[params.plan],
    dashboard_url: params.dashboardUrl || `${APP_BASE_URL}/manage-teams`,
    support_url: `${APP_BASE_URL}/support`,
  });
}

export async function sendFanWelcomeEmail(params: {
  to: string;
  fanName: string;
  featuredTeamLink?: string;
  exploreLink?: string;
}): Promise<boolean> {
  return sendTemplateEmail('FAN_WELCOME', 'fan welcome', params.to, {
    fan_name: params.fanName,
    featured_team_link: params.featuredTeamLink || `${APP_BASE_URL}/teams`,
    explore_link: params.exploreLink || `${APP_BASE_URL}/discover`,
  });
}

export async function sendPaymentReceiptEmail(params: {
  to: string;
  planName: string;
  amount: string;
  billingPeriod: string;
  invoiceUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('PAYMENT_RECEIPT', 'payment receipt', params.to, {
    plan_name: params.planName,
    amount: params.amount,
    billing_period: params.billingPeriod,
    invoice_url: params.invoiceUrl || undefined,
  });
}

export async function sendSubscriptionCanceledEmail(params: {
  to: string;
  planName: string;
  renewalDate?: string;
  reactivateUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('SUBSCRIPTION_CANCELED', 'subscription canceled', params.to, {
    plan_name: params.planName,
    renewal_date: params.renewalDate || 'End of current billing period',
    reactivate_url: params.reactivateUrl || `${APP_BASE_URL}/billing`,
  });
}

export async function sendPlanLimitWarningEmail(params: {
  to: string;
  planName: string;
  resourceType: 'team' | 'organization';
  used: number;
  limit: number | null;
  upgradeUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('PLAN_LIMIT_WARNING', 'plan limit warning', params.to, {
    plan_name: params.planName,
    resource_type: params.resourceType,
    used_count: params.used,
    limit: typeof params.limit === 'number' ? params.limit : 'Unlimited',
    upgrade_url: params.upgradeUrl || `${APP_BASE_URL}/upgrade?from=${params.resourceType}_limit`,
  });
}

export async function sendSecurityAlertEmail(params: {
  to: string;
  alertType: 'password_change' | 'new_device' | 'email_change';
  ipAddress?: string;
  location?: string;
  manageUrl?: string;
  secureAccountLink?: string;
  changePasswordLink?: string;
  contactSupportLink?: string;
}): Promise<boolean> {
  return sendTemplateEmail('SECURITY_ALERT', 'security alert', params.to, {
    alert_type: params.alertType,
    ip_address: params.ipAddress || '',
    location: params.location || '',
    manage_url: params.manageUrl || `${APP_BASE_URL}/settings/security`,
    secure_account_link: params.secureAccountLink || `${APP_BASE_URL}/settings/security`,
    change_password_link: params.changePasswordLink || `${APP_BASE_URL}/reset-password`,
    contact_support_link: params.contactSupportLink || `${APP_BASE_URL}/support`,
  });
}
export const sendTeamInviteEmail = makeDisabled('sendTeamInviteEmail');
export const sendOrganizationInviteEmail = makeDisabled('sendOrganizationInviteEmail');

// ✅ Team Management: Organization Invitation
export async function sendOrganizationInvitationEmail(params: {
  to: string;
  recipientName: string;
  organizationName: string;
  inviterName: string;
  role: string;
  acceptLink: string;
  declineLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.ORGANIZATION_INVITATION;
    if (!templateId) {
      console.warn('[email] SendGrid organization invitation template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        recipient_name: params.recipientName,
        organization_name: params.organizationName,
        inviter_name: params.inviterName,
        role: params.role,
        accept_link: params.acceptLink,
        decline_link: params.declineLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Organization invitation email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send organization invitation email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Team Invitation
export async function sendTeamInvitationEmail(params: {
  to: string;
  recipientName: string;
  teamName: string;
  inviterName: string;
  role: string;
  acceptLink: string;
  declineLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.TEAM_INVITATION;
    if (!templateId) {
      console.warn('[email] SendGrid team invitation template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        recipient_name: params.recipientName,
        team_name: params.teamName,
        inviter_name: params.inviterName,
        role: params.role,
        accept_link: params.acceptLink,
        decline_link: params.declineLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Team invitation email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send team invitation email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Athlete Invitation
export async function sendAthleteInvitationEmail(params: {
  to: string;
  athleteName: string;
  teamName: string;
  coachName: string;
  sport: string;
  acceptLink: string;
  declineLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.ATHLETE_INVITATION;
    if (!templateId) {
      console.warn('[email] SendGrid athlete invitation template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        athlete_name: params.athleteName,
        team_name: params.teamName,
        coach_name: params.coachName,
        sport: params.sport,
        accept_link: params.acceptLink,
        decline_link: params.declineLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Athlete invitation email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send athlete invitation email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Role Assignment
export async function sendRoleAssignmentEmail(params: {
  to: string;
  userName: string;
  newRole: string;
  teamName: string;
  assignedBy: string;
  assignedDate: string;
  dashboardLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.ROLE_ASSIGNMENT;
    if (!templateId) {
      console.warn('[email] SendGrid role assignment template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        new_role: params.newRole,
        team_name: params.teamName,
        assigned_by: params.assignedBy,
        assigned_date: params.assignedDate,
        dashboard_link: params.dashboardLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Role assignment email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send role assignment email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Roster Threshold Alert
export async function sendRosterThresholdEmail(params: {
  to: string;
  coachName: string;
  teamName: string;
  currentRosterCount: number;
  maxRosterCount: number;
  upgradeLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.ROSTER_THRESHOLD;
    if (!templateId) {
      console.warn('[email] SendGrid roster threshold template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        coach_name: params.coachName,
        team_name: params.teamName,
        current_roster_count: params.currentRosterCount,
        max_roster_count: params.maxRosterCount,
        upgrade_link: params.upgradeLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Roster threshold email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send roster threshold email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Invitation Declined
export async function sendInvitationDeclinedEmail(params: {
  to: string;
  senderName: string;
  declinedByName: string;
  teamName: string;
  role: string;
  declinedDate: string;
  reasonProvided?: string;
  viewTeamUrl: string;
  resendInvitationUrl: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.INVITATION_DECLINED;
    if (!templateId) {
      console.warn('[email] SendGrid invitation declined template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        sender_name: params.senderName,
        declined_by_name: params.declinedByName,
        team_name: params.teamName,
        role: params.role,
        declined_date: params.declinedDate,
        reason_provided: params.reasonProvided || 'No reason provided',
        view_team_url: params.viewTeamUrl,
        resend_invitation_url: params.resendInvitationUrl,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Invitation declined email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send invitation declined email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Team Roster Update
export async function sendTeamRosterUpdateEmail(params: {
  to: string;
  coachName: string;
  teamName: string;
  updateType: string;
  playerName: string;
  updateDate: string;
  viewRosterLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.TEAM_ROSTER_UPDATE;
    if (!templateId) {
      console.warn('[email] SendGrid team roster update template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        coach_name: params.coachName,
        team_name: params.teamName,
        update_type: params.updateType,
        player_name: params.playerName,
        update_date: params.updateDate,
        view_roster_link: params.viewRosterLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Team roster update email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send team roster update email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Membership: User Confirmation
export async function sendUserConfirmationEmail(params: {
  to: string;
  userName: string;
  confirmationLink: string;
  expiresIn: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.USER_CONFIRMATION;
    if (!templateId) {
      console.warn('[email] SendGrid user confirmation template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        confirmation_link: params.confirmationLink,
        expires_in: params.expiresIn,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ User confirmation email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send user confirmation email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Team Management: Member Removed Notification
export async function sendMemberRemovedEmail(params: {
  to: string;
  userName: string;
  teamName: string;
  organizationName: string;
  removedBy: string;
  removalDate: string;
  removalReason?: string;
  contactEmail: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.MEMBER_REMOVED;
    if (!templateId) {
      console.warn('[email] SendGrid member removed template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        team_name: params.teamName,
        organization_name: params.organizationName,
        removed_by: params.removedBy,
        removal_date: params.removalDate,
        removal_reason: params.removalReason || 'No reason provided',
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
        contact_email: params.contactEmail,
      },
    });
    debugLog(`✅ Member removed email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send member removed email to ${params.to}:`, error);
    return false;
  }
}

// ✅ Billing: Payment Failed Notification
export async function sendPaymentFailedEmail(params: {
  to: string;
  userName: string;
  paymentMethodLast4: string;
  failedAmount: string;
  failedDate: string;
  planName: string;
  retryDate: string;
  updatePaymentLink: string;
  contactSupportLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.PAYMENT_FAILED;
    if (!templateId) {
      console.warn('[email] SendGrid payment failed template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        payment_method_last4: params.paymentMethodLast4,
        failed_amount: params.failedAmount,
        failed_date: params.failedDate,
        plan_name: params.planName,
        retry_date: params.retryDate,
        update_payment_link: params.updatePaymentLink,
        contact_support_link: params.contactSupportLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Payment failed email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send payment failed email to ${params.to}:`, error);
    return false;
  }
}

// ✅ PHASE 1: Report Resolution Email (Resolved/Dismissed abuse reports)
export async function sendReportResolutionEmail(params: {
  to: string;
  userName: string;
  reportId: string;
  reportType: string;
  resolutionStatus: 'resolved' | 'dismissed';
  resolutionReason: string;
  appealUrl: string;
  submitDate?: string;
  resolutionDate?: string;
  reportDetailLink?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = params.resolutionStatus === 'resolved' ? TEMPLATE_IDS.REPORT_RESOLVED : TEMPLATE_IDS.REPORT_DISMISSED;
    
    if (!templateId) {
      console.warn(`[email] SendGrid report resolution template not configured (status=${params.resolutionStatus})`);
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        report_id: params.reportId,
        report_type: params.reportType,
        resolution_status: params.resolutionStatus,
        resolution_reason: params.resolutionReason,
        appeal_url: params.appealUrl,
        submit_date: params.submitDate || '',
        resolution_date: params.resolutionDate || '',
        report_detail_link: params.reportDetailLink || '',
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Report resolution email (${params.resolutionStatus}) sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send report resolution email:', error);
    return false;
  }
}

// Event Management Emails
export async function sendEventSubmissionReceivedEmail(params: {
  to: string;
  coachName: string;
  eventName: string;
  eventDate: string; // Formatted: "Friday, January 24, 2025"
  eventTime: string; // Formatted: "7:00 PM CT"
  eventLocation: string;
  submissionDate: string; // Formatted: "Jan 15, 2025 · 2:30 PM CT"
  organizationName: string;
  statusLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_SUBMISSION_RECEIVED;
    if (!templateId) {
      console.warn('[email] SendGrid event submission template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        coach_name: params.coachName,
        event_name: params.eventName,
        event_date: params.eventDate,
        event_time: params.eventTime,
        event_location: params.eventLocation,
        submission_date: params.submissionDate,
        organization_name: params.organizationName,
        status_link: params.statusLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event submission email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send event submission email to ${params.to}:`, error);
    return false;
  }
}

export async function sendEventApprovedEmail(params: {
  to: string;
  coachName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  opponent?: string;
  organizationName: string;
  approvalNotes?: string;
  eventLink: string;
  manageLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_APPROVED;
    if (!templateId) {
      console.warn('[email] SendGrid event approved template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        coach_name: params.coachName,
        event_name: params.eventName,
        event_date: params.eventDate,
        event_time: params.eventTime,
        event_location: params.eventLocation,
        opponent: params.opponent || 'TBD',
        organization_name: params.organizationName,
        approval_notes: params.approvalNotes || 'Your event has been approved. Great work!',
        event_link: params.eventLink,
        manage_link: params.manageLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event approved email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send event approved email to ${params.to}:`, error);
    return false;
  }
}

export async function sendEventDeniedEmail(params: {
  to: string;
  coachName: string;
  eventName: string;
  eventDate: string;
  denialReason: string;
  resubmitLink: string;
  supportLink: string;
  organizationName: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_DENIED;
    if (!templateId) {
      console.warn('[email] SendGrid event denied template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        coach_name: params.coachName,
        event_name: params.eventName,
        event_date: params.eventDate,
        denial_reason: params.denialReason,
        resubmit_link: params.resubmitLink,
        support_link: params.supportLink,
        organization_name: params.organizationName,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event denied email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send event denied email to ${params.to}:`, error);
    return false;
  }
}

export async function sendEventReminderEmail(params: {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  opponent?: string;
  organizationName: string;
  checkInLink: string;
  calendarLink: string;
  directionsLink: string;
  preferencesLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_REMINDER;
    if (!templateId) {
      console.warn('[email] SendGrid event reminder template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        recipient_name: params.recipientName,
        event_name: params.eventName,
        event_date: params.eventDate,
        event_time: params.eventTime,
        event_location: params.eventLocation,
        opponent: params.opponent || 'TBD',
        organization_name: params.organizationName,
        check_in_link: params.checkInLink,
        calendar_link: params.calendarLink,
        directions_link: params.directionsLink,
        preferences_link: params.preferencesLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event reminder email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send event reminder email to ${params.to}:`, error);
    return false;
  }
}

export async function sendEventUpdatedEmail(params: {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  organizationName: string;
  updatedAt: string;
  changeSummary: string;
  eventDetailLink: string;
  calendarLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_UPDATED;
    if (!templateId) {
      console.warn('[email] SendGrid event updated template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        recipient_name: params.recipientName,
        event_name: params.eventName,
        event_date: params.eventDate,
        event_time: params.eventTime,
        event_location: params.eventLocation,
        organization_name: params.organizationName,
        updated_at: params.updatedAt,
        change_summary: params.changeSummary,
        event_detail_link: params.eventDetailLink,
        calendar_link: params.calendarLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event updated email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send event updated email to ${params.to}:`, error);
    return false;
  }
}

export async function sendEventCanceledEmail(params: {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  canceledAt: string;
  organizationName: string;
  cancelReason: string;
  rescheduleInfo?: string;
  upcomingEventsLink: string;
  contactOrganizerLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_CANCELED;
    if (!templateId) {
      console.warn('[email] SendGrid event canceled template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        recipient_name: params.recipientName,
        event_name: params.eventName,
        event_date: params.eventDate,
        event_time: params.eventTime,
        event_location: params.eventLocation,
        canceled_at: params.canceledAt,
        organization_name: params.organizationName,
        cancel_reason: params.cancelReason,
        reschedule_info: params.rescheduleInfo || 'No reschedule information available at this time.',
        upcoming_events_link: params.upcomingEventsLink,
        contact_organizer_link: params.contactOrganizerLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event canceled email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send event canceled email to ${params.to}:`, error);
    return false;
  }
}

// ✅ PHASE 1B: Account Action Emails (Warning, Content Removal, Suspension, Permanent Ban)
export async function sendAccountWarningEmail(params: {
  to: string;
  userName: string;
  reportId: string;
  violationType: string;
  appealUrl: string;
  warningReason?: string;
  communityGuidelinesUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.ACCOUNT_WARNING;
    if (!templateId) {
      console.warn('[email] SendGrid account warning template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        report_id: params.reportId,
        violation_type: params.violationType,
        warning_reason: params.warningReason || 'Your account received a warning for violating our Community Guidelines.',
        appeal_url: params.appealUrl,
        community_guidelines_url: params.communityGuidelinesUrl || 'https://varsityhub.app/community-guidelines',
        privacy_policy_url: 'https://varsityhub.app/privacy',
      },
    });
    debugLog(`✅ Account warning email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send account warning email:', error);
    return false;
  }
}

export async function sendContentRemovedEmail(params: {
  to: string;
  userName: string;
  reportId: string;
  contentType: string;
  removalReason: string;
  // Optional fields to match template tokens
  reportType?: string; // maps to {{report_type}}
  removalDate?: string; // maps to {{removal_date}}
  contentPreview?: string; // maps to {{content_preview}}
  appealUrl: string;
  communityGuidelinesUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.CONTENT_REMOVED;
    if (!templateId) {
      console.warn('[email] SendGrid content removed template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        report_id: params.reportId,
        content_type: params.contentType,
        // Additional fields used by the template
        report_type: params.reportType || 'Policy Violation',
        removal_date: params.removalDate || new Date().toLocaleDateString(),
        content_preview: params.contentPreview || undefined,
        removal_reason: params.removalReason,
        appeal_url: params.appealUrl,
        community_guidelines_url: params.communityGuidelinesUrl || 'https://varsityhub.app/community-guidelines',
        privacy_policy_url: 'https://varsityhub.app/privacy',
      },
    });
    debugLog(`✅ Content removed email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send content removed email:', error);
    return false;
  }
}

export async function sendAccountSuspensionEmail(params: {
  to: string;
  userName: string;
  reportId: string;
  violationType: string;
  suspensionDays: number;
  suspensionDate: string;
  reinstatementDate: string;
  suspensionReason: string;
  appealUrl: string;
  communityGuidelinesUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    // Use different template IDs based on suspension days
    const templateId = params.suspensionDays === 7 
      ? TEMPLATE_IDS.ACCOUNT_SUSPENSION_7_DAYS
      : TEMPLATE_IDS.ACCOUNT_SUSPENSION_45_DAYS;
    
    if (!templateId) {
      console.warn(`[email] SendGrid account suspension template (${params.suspensionDays} days) not configured`);
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        report_id: params.reportId,
        violation_type: params.violationType,
        // Template expects both raw days and a human-readable duration
        suspension_days: params.suspensionDays,
        suspension_duration: `${params.suspensionDays} days`,
        suspension_date: params.suspensionDate,
        reinstatement_date: params.reinstatementDate,
        suspension_reason: params.suspensionReason,
        // Also provide report_type alias for template compatibility
        report_type: params.violationType,
        appeal_url: params.appealUrl,
        community_guidelines_url: params.communityGuidelinesUrl || 'https://varsityhub.app/community-guidelines',
        privacy_policy_url: 'https://varsityhub.app/privacy',
      },
    });
    debugLog(`✅ Account suspension email (${params.suspensionDays} days) sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send account suspension email:', error);
    return false;
  }
}

export async function sendAccountPermanentBanEmail(params: {
  to: string;
  userName: string;
  reportId: string;
  violationType: string;
  banReason: string;
  appealUrl: string;
  supportEmail?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.ACCOUNT_PERMANENT_BAN;
    if (!templateId) {
      console.warn('[email] SendGrid permanent ban template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        report_id: params.reportId,
        violation_type: params.violationType,
        // Template compatibility: also send report_type and ban_date
        report_type: params.violationType,
        ban_date: new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short'
        }),
        ban_reason: params.banReason,
        appeal_url: params.appealUrl,
        support_email: params.supportEmail || 'customerservice@varsityhub.app',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
        privacy_policy_url: 'https://varsityhub.app/privacy',
      },
    });
    debugLog(`✅ Account permanent ban email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send account permanent ban email:', error);
    return false;
  }
}

/**
 * Send Event RSVP Confirmed Email
 * Triggered when a user RSVPs to an event
 */
export async function sendEventRsvpConfirmedEmail(params: {
  to: string;
  userName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  rsvpConfirmedAt: string;
  organizationName: string;
  eventDetailLink: string;
  calendarLink: string;
  cancelRsvpLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.EVENT_RSVP_CONFIRMED;
    if (!templateId) {
      console.warn('[email] SendGrid Event RSVP Confirmed template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        event_name: params.eventName,
        event_date: params.eventDate,
        event_time: params.eventTime,
        event_location: params.eventLocation,
        rsvp_confirmed_at: params.rsvpConfirmedAt,
        organization_name: params.organizationName,
        event_detail_link: params.eventDetailLink,
        calendar_link: params.calendarLink,
        cancel_rsvp_link: params.cancelRsvpLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Event RSVP confirmed email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send Event RSVP confirmed email to ${params.to}:`, error);
    return false;
  }
}

const formatCurrency = (value?: number | string | null): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `$${value.toFixed(2)}`;
  }
  if (typeof value === 'string' && value.trim().length) {
    return value;
  }
  return '$0.00';
};

export async function sendEventDecisionEmail(params: {
  to: string;
  coachName: string;
  eventName: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  organizationName?: string;
  approved: boolean;
  reviewUrl: string;
  manageUrl?: string;
  opponent?: string;
  approvalNotes?: string;
  reason?: string;
  resubmitLink?: string;
  supportLink?: string;
}): Promise<boolean> {
  if (params.approved) {
    return sendEventApprovedEmail({
      to: params.to,
      coachName: params.coachName,
      eventName: params.eventName,
      eventDate: params.eventDate || '',
      eventTime: params.eventTime || '',
      eventLocation: params.eventLocation || '',
      opponent: params.opponent,
      organizationName: params.organizationName || 'VarsityHub',
      approvalNotes: params.approvalNotes,
      eventLink: params.reviewUrl,
      manageLink: params.manageUrl || params.reviewUrl,
    });
  }

  return sendEventDeniedEmail({
    to: params.to,
    coachName: params.coachName,
    eventName: params.eventName,
    eventDate: params.eventDate || '',
    denialReason: params.reason || 'Please update the event and resubmit.',
    resubmitLink: params.resubmitLink || params.reviewUrl,
    supportLink: params.supportLink || `${APP_BASE_URL}/support`,
    organizationName: params.organizationName || 'VarsityHub',
  });
}

// Advertising & monetization emails
export async function sendAdReservationEmail(params: {
  to: string;
  advertiserName: string;
  businessName: string;
  reservedDates: string[];
  totalCost?: number | null;
  targetZip?: string | null;
  checkoutLink: string;
  adPreviewUrl?: string | null;
}): Promise<boolean> {
  const formattedDates = params.reservedDates.length ? params.reservedDates.join(', ') : 'Selected dates';
  return sendTemplateEmail('AD_RESERVATION', 'ad reservation confirmation', params.to, {
    advertiser_name: params.advertiserName,
    business_name: params.businessName,
    reserved_dates: formattedDates,
    total_cost: formatCurrency(params.totalCost),
    target_zip: params.targetZip || '',
    checkout_link: params.checkoutLink,
    ad_preview_url: params.adPreviewUrl || undefined,
  });
}

export async function sendPaymentRequiredEmail(params: {
  to: string;
  advertiserName: string;
  businessName: string;
  totalCost?: number | null;
  checkoutLink: string;
  hoursRemaining: number;
}): Promise<boolean> {
  return sendTemplateEmail('PAYMENT_REQUIRED', 'ad payment reminder', params.to, {
    advertiser_name: params.advertiserName,
    business_name: params.businessName,
    total_cost: formatCurrency(params.totalCost),
    checkout_link: params.checkoutLink,
    hours_remaining: params.hoursRemaining,
  });
}

export async function sendAdGoesLiveEmail(params: {
  to: string;
  advertiserName: string;
  businessName: string;
  adTitle: string;
  targetZip?: string;
  liveUntilDate?: string;
  analyticsDashboardUrl: string;
  adPreviewUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('AD_GOES_LIVE', 'ad goes live', params.to, {
    advertiser_name: params.advertiserName,
    business_name: params.businessName,
    ad_title: params.adTitle,
    target_zip: params.targetZip || '',
    live_until: params.liveUntilDate || '',
    analytics_dashboard_url: params.analyticsDashboardUrl,
    ad_preview_url: params.adPreviewUrl || undefined,
  });
}

// Team & staff alerts queued via worker
export async function sendRosterThresholdAlertEmail(params: {
  to: string;
  coachName: string;
  teamName: string;
  rosterCount: number;
  maxRosterCount?: number;
  thresholdCost?: number;
  manageBillingUrl?: string;
}): Promise<boolean> {
  return sendTemplateEmail('ROSTER_THRESHOLD', 'roster threshold alert', params.to, {
    coach_name: params.coachName,
    team_name: params.teamName,
    current_roster_count: params.rosterCount,
    max_roster_count: params.maxRosterCount ?? 15,
    upgrade_link: params.manageBillingUrl || `${APP_BASE_URL}/billing`,
    threshold_cost: params.thresholdCost ? formatCurrency(params.thresholdCost) : undefined,
  });
}

export async function sendStaffInvitationEmail(params: {
  to: string;
  inviteeName: string;
  inviterName: string;
  teamName: string;
  inviteLink: string;
  expiryDays: number;
  onboardingUrl: string;
}): Promise<boolean> {
  return sendTemplateEmail('STAFF_INVITATION', 'staff invitation', params.to, {
    invitee_name: params.inviteeName,
    inviter_name: params.inviterName,
    team_name: params.teamName,
    invite_link: params.inviteLink,
    expiry_days: params.expiryDays,
    onboarding_url: params.onboardingUrl,
  });
}

export async function sendStaffInvitationConfirmationEmail(params: {
  to: string;
  coachName: string;
  inviteeName: string;
  inviteeEmail: string;
  teamName: string;
  manageStaffUrl: string;
}): Promise<boolean> {
  return sendTemplateEmail('STAFF_INVITATION_CONFIRMATION', 'staff invitation confirmation', params.to, {
    coach_name: params.coachName,
    invitee_name: params.inviteeName,
    invitee_email: params.inviteeEmail,
    team_name: params.teamName,
    manage_staff_url: params.manageStaffUrl,
  });
}

export async function sendSeasonWrapUpEmail(params: {
  to: string;
  coachName: string;
  teamName: string;
  seasonYear: number;
  gamesPlayed: number;
  winLossRecord: string;
  seasonHighlightsUrl: string;
  nextSeasonSignupUrl: string;
}): Promise<boolean> {
  return sendTemplateEmail('SEASON_WRAP_UP', 'season wrap up', params.to, {
    coach_name: params.coachName,
    team_name: params.teamName,
    season_year: params.seasonYear,
    games_played: params.gamesPlayed,
    win_loss_record: params.winLossRecord,
    season_highlights_url: params.seasonHighlightsUrl,
    next_season_signup_url: params.nextSeasonSignupUrl,
  });
}

export async function sendPostHighlightEmail(params: {
  to: string;
  creatorName: string;
  milestoneNumber: number;
  postPreviewUrl?: string;
  postTitle?: string;
  shareLink?: string;
  reactionsLink?: string;
}): Promise<boolean> {
  return sendTemplateEmail('POST_HIGHLIGHT', 'post milestone highlight', params.to, {
    creator_name: params.creatorName,
    milestone_number: params.milestoneNumber,
    post_preview_url: params.postPreviewUrl || undefined,
    post_title: params.postTitle || 'Your post',
    share_link: params.shareLink || `${APP_BASE_URL}/share`,
    reactions_link: params.reactionsLink || `${APP_BASE_URL}/notifications`,
  });
}

export async function sendAthleteFollowerNotificationEmail(params: {
  to: string;
  athleteName: string;
  followerName: string;
  followerProfileUrl: string;
  followBackLink: string;
  dmLink: string;
  followerStats?: string;
}): Promise<boolean> {
  return sendTemplateEmail('ATHLETE_FOLLOWER_NOTIFICATION', 'athlete follower notification', params.to, {
    athlete_name: params.athleteName,
    follower_name: params.followerName,
    follower_profile_url: params.followerProfileUrl,
    follow_back_link: params.followBackLink,
    dm_link: params.dmLink,
    follower_stats: params.followerStats || '',
  });
}

export async function sendProfileCompletionNudgeEmail(params: {
  to: string;
  userName: string;
  missingFields: string[];
  profileEditUrl: string;
  completionBenefit: string;
  estimatedTime: string;
}): Promise<boolean> {
  return sendTemplateEmail('PROFILE_COMPLETION_NUDGE', 'profile completion nudge', params.to, {
    user_name: params.userName,
    missing_fields: params.missingFields,
    profile_edit_url: params.profileEditUrl,
    completion_benefit: params.completionBenefit,
    estimated_time: params.estimatedTime,
  });
}

export async function sendDormantUserDigestEmail(params: {
  to: string;
  userName: string;
  daysAbsent: number;
  nearbyGamesCount: number;
  nearbyGamesList?: string;
  trendingPostsCount: number;
  openAppLink: string;
  exploreLink: string;
}): Promise<boolean> {
  return sendTemplateEmail('DORMANT_USER_DIGEST', 'dormant user digest', params.to, {
    user_name: params.userName,
    days_absent: params.daysAbsent,
    nearby_games_count: params.nearbyGamesCount,
    nearby_games_list: params.nearbyGamesList || '',
    trending_posts_count: params.trendingPostsCount,
    open_app_link: params.openAppLink,
    explore_link: params.exploreLink,
  });
}

/**
 * Send Login from New Device Email
 * Triggered when user logs in from unrecognized device/location
 */
export async function sendLoginFromNewDeviceEmail(params: {
  to: string;
  userName: string;
  deviceType: string;
  deviceLocation: string;
  loginDate: string;
  loginTime: string;
  ipAddress: string;
  secureAccountLink: string;
  changePasswordLink: string;
  contactSupportLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.LOGIN_NEW_DEVICE;
    if (!templateId) {
      console.warn('[email] SendGrid Login New Device template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        device_type: params.deviceType,
        device_location: params.deviceLocation,
        login_date: params.loginDate,
        login_time: params.loginTime,
        ip_address: params.ipAddress,
        secure_account_link: params.secureAccountLink,
        change_password_link: params.changePasswordLink,
        contact_support_link: params.contactSupportLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Login new device email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send login new device email to ${params.to}:`, error);
    return false;
  }
}

/**
 * Send Staff Member Joined Email
 * Triggered when a team invitation is accepted
 */
export async function sendStaffMemberJoinedEmail(params: {
  to: string;
  recipientName: string;
  newMemberName: string;
  memberRole: string;
  teamName: string;
  joinedDate: string;
  organizationName: string;
  viewTeamLink: string;
  manageStaffLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.STAFF_MEMBER_JOINED;
    if (!templateId) {
      console.warn('[email] SendGrid Staff Member Joined template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        recipient_name: params.recipientName,
        new_member_name: params.newMemberName,
        member_role: params.memberRole,
        team_name: params.teamName,
        joined_date: params.joinedDate,
        organization_name: params.organizationName,
        view_team_link: params.viewTeamLink,
        manage_staff_link: params.manageStaffLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Staff member joined email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send staff member joined email to ${params.to}:`, error);
    return false;
  }
}

/**
 * Send Subscription Expiring Email
 * Triggered 7 days before subscription expiration
 */
export async function sendSubscriptionExpiringEmail(params: {
  to: string;
  userName: string;
  planName: string;
  expiresDate: string;
  daysRemaining: string;
  renewalPrice: string;
  featuresLosing: string[];
  renewLink: string;
  manageSubscriptionLink: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[email] SendGrid API key not configured');
    return false;
  }

  try {
    const templateId = TEMPLATE_IDS.SUBSCRIPTION_EXPIRING;
    if (!templateId) {
      console.warn('[email] SendGrid Subscription Expiring template not configured');
      return false;
    }

    await sgMail.send({
      to: params.to,
      from: EMAIL_FROM,
      templateId,
      dynamicTemplateData: {
        user_name: params.userName,
        plan_name: params.planName,
        expires_date: params.expiresDate,
        days_remaining: params.daysRemaining,
        renewal_price: params.renewalPrice,
        features_losing: params.featuresLosing,
        renew_link: params.renewLink,
        manage_subscription_link: params.manageSubscriptionLink,
        privacy_policy_url: 'https://varsityhub.app/privacy',
        community_guidelines_url: 'https://varsityhub.app/community-guidelines',
      },
    });
    debugLog(`✅ Subscription expiring email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send subscription expiring email to ${params.to}:`, error);
    return false;
  }
}
