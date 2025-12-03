import sendgridMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';

// Initialize SendGrid API client
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS || '';
if (SENDGRID_API_KEY) {
  sendgridMail.setApiKey(SENDGRID_API_KEY);
}

// SendGrid Dynamic Template IDs
export const SENDGRID_TEMPLATES = {
  VERIFICATION: process.env.SENDGRID_TEMPLATE_VERIFICATION || 'd-e4a32dd538ee42358d1d5aba509445ac',
  PASSWORD_RESET: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET || 'd-e4a32dd538ee42358d1d5aba509445ac',
  GENERAL: process.env.SENDGRID_TEMPLATE_GENERAL || 'd-e4a32dd538ee42358d1d5aba509445ac',
};

// Fallback: Create reusable transporter object using SMTP transport
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // For SendGrid, this is literally "apikey"
        pass: process.env.SMTP_PASS, // Your SendGrid API key
      },
    })
  : null;

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using SendGrid Dynamic Templates (preferred) or SMTP fallback
 */
export async function sendEmailWithTemplate(params: {
  to: string;
  templateId?: string;
  dynamicData: Record<string, any>;
  subject?: string;
}): Promise<boolean> {
  const { to, templateId, dynamicData, subject } = params;
  
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid API key not configured - cannot send templated email');
    console.log('📧 Would have sent templated email:', {
      to,
      templateId,
      dynamicData,
    });
    return false;
  }

  try {
    const msg = {
      to,
      from: process.env.FROM_EMAIL || 'noreply@varsityhub.app',
      templateId: templateId || SENDGRID_TEMPLATES.GENERAL,
      dynamicTemplateData: dynamicData,
      ...(subject && { subject }), // Optional subject override
    };

    await sendgridMail.send(msg);

    console.log('✅ Templated email sent successfully:', {
      to,
      templateId: msg.templateId,
    });
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send templated email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    return false;
  }
}

/**
 * Send an email using the configured SMTP service (fallback for non-templated emails)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!transporter) {
    console.warn('⚠️ Email service not configured - SMTP credentials missing');
    console.log('📧 Would have sent email:', {
      to: options.to,
      subject: options.subject,
      text: options.text?.substring(0, 100),
    });
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@varsityhub.app',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('✅ Email sent successfully:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
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
  const { reporterName, reporterEmail, subject, message, userId } = params;

  const htmlContent = `
    <h2>🚨 New Abuse Report Submitted</h2>
    <p><strong>From:</strong> ${reporterName} (${reporterEmail})</p>
    ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
    <p><strong>Subject:</strong> ${subject}</p>
    <hr>
    <h3>Report Details:</h3>
    <p>${message.replace(/\n/g, '<br>')}</p>
    <hr>
    <p><em>Submitted at ${new Date().toLocaleString()}</em></p>
    <p><small>This is an automated notification from the VarsityHub reporting system.</small></p>
  `;

  const textContent = `
🚨 NEW ABUSE REPORT SUBMITTED

From: ${reporterName} (${reporterEmail})
${userId ? `User ID: ${userId}` : ''}
Subject: ${subject}

Report Details:
${message}

---
Submitted at ${new Date().toLocaleString()}
This is an automated notification from the VarsityHub reporting system.
  `.trim();

  return sendEmail({
    to: process.env.CUSTOMER_SERVICE_EMAIL || 'customerservice@varsityhub.app',
    subject: `[ABUSE REPORT] ${subject}`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send password reset email with 6-digit code
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your VarsityHub Password</h2>
      <p>You requested to reset your password. Use the code below to continue:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #0066cc; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h1>
      </div>
      <p>This code will expire in 30 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">VarsityHub - Connecting Athletes & Fans</p>
    </div>
  `;

  const textContent = `
Reset Your VarsityHub Password

You requested to reset your password. Use the code below to continue:

${code}

This code will expire in 30 minutes.

If you didn't request this, you can safely ignore this email.

---
VarsityHub - Connecting Athletes & Fans
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Reset Your VarsityHub Password',
    text: textContent,
    html: htmlContent,
  });
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
}): Promise<boolean> {
  const { adminEmail, adminName, requesterName, organizationName, message, requestId } = params;

  const approveUrl = `${process.env.WEB_URL || 'https://varsityhub.app'}/organizations/join-requests/${requestId}/approve`;
  const denyUrl = `${process.env.WEB_URL || 'https://varsityhub.app'}/organizations/join-requests/${requestId}/deny`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Join Request for ${organizationName}</h2>
      <p>Hi ${adminName},</p>
      <p><strong>${requesterName}</strong> has requested to join your organization: <strong>${organizationName}</strong></p>
      ${message ? `
        <div style="background: #f4f4f4; padding: 15px; margin: 20px 0; border-left: 4px solid #0066cc;">
          <p style="margin: 0;"><strong>Message from ${requesterName}:</strong></p>
          <p style="margin: 10px 0 0 0;">${message}</p>
        </div>
      ` : ''}
      <p>You can review this request in your organization dashboard.</p>
      <div style="margin: 30px 0;">
        <a href="${approveUrl}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">Approve Request</a>
        <a href="${denyUrl}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Deny Request</a>
      </div>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">VarsityHub - Connecting Athletes & Fans</p>
    </div>
  `;

  const textContent = `
New Join Request for ${organizationName}

Hi ${adminName},

${requesterName} has requested to join your organization: ${organizationName}

${message ? `Message from ${requesterName}:\n${message}\n\n` : ''}

You can review this request in your organization dashboard.

Approve: ${approveUrl}
Deny: ${denyUrl}

---
VarsityHub - Connecting Athletes & Fans
  `.trim();

  return sendEmail({
    to: adminEmail,
    subject: `New Join Request for ${organizationName}`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send approval notification to user
 */
export async function sendJoinRequestApproved(params: {
  userEmail: string;
  userName: string;
  organizationName: string;
  adminName: string;
}): Promise<boolean> {
  const { userEmail, userName, organizationName, adminName } = params;

  const orgUrl = `${process.env.WEB_URL || 'https://varsityhub.app'}/organizations`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #22c55e;">✅ Join Request Approved!</h2>
      <p>Hi ${userName},</p>
      <p>Great news! Your request to join <strong>${organizationName}</strong> has been approved by ${adminName}.</p>
      <p>You can now access all features and participate in ${organizationName}'s activities.</p>
      <div style="margin: 30px 0;">
        <a href="${orgUrl}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Organization</a>
      </div>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">VarsityHub - Connecting Athletes & Fans</p>
    </div>
  `;

  const textContent = `
✅ JOIN REQUEST APPROVED!

Hi ${userName},

Great news! Your request to join ${organizationName} has been approved by ${adminName}.

You can now access all features and participate in ${organizationName}'s activities.

View Organization: ${orgUrl}

---
VarsityHub - Connecting Athletes & Fans
  `.trim();

  return sendEmail({
    to: userEmail,
    subject: `You're now a member of ${organizationName}!`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send denial notification to user
 */
export async function sendJoinRequestDenied(params: {
  userEmail: string;
  userName: string;
  organizationName: string;
  reason?: string;
}): Promise<boolean> {
  const { userEmail, userName, organizationName, reason } = params;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Join Request Update</h2>
      <p>Hi ${userName},</p>
      <p>Thank you for your interest in joining <strong>${organizationName}</strong>.</p>
      <p>Unfortunately, your join request has not been approved at this time.</p>
      ${reason ? `
        <div style="background: #f4f4f4; padding: 15px; margin: 20px 0; border-left: 4px solid #666;">
          <p style="margin: 0;"><strong>Reason:</strong></p>
          <p style="margin: 10px 0 0 0;">${reason}</p>
        </div>
      ` : ''}
      <p>You're welcome to reach out to the organization directly if you have questions.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">VarsityHub - Connecting Athletes & Fans</p>
    </div>
  `;

  const textContent = `
Join Request Update

Hi ${userName},

Thank you for your interest in joining ${organizationName}.

Unfortunately, your join request has not been approved at this time.

${reason ? `Reason: ${reason}\n\n` : ''}

You're welcome to reach out to the organization directly if you have questions.

---
VarsityHub - Connecting Athletes & Fans
  `.trim();

  return sendEmail({
    to: userEmail,
    subject: `Join Request Update - ${organizationName}`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send an organization invite email to a recipient
 */
export async function sendOrganizationInviteEmail(params: {
  to: string;
  organizationName: string;
  role?: string;
  inviterName?: string;
}): Promise<boolean> {
  const { to, organizationName, role, inviterName } = params;
  const appUrl = `${process.env.WEB_URL || 'https://varsityhub.app'}/invites`;

  const prettyRole = role ? role.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : 'member';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827;">You're invited to ${organizationName}</h2>
      <p>${inviterName ? `${inviterName} has` : 'You have'} invited you to join <strong>${organizationName}</strong> as <strong>${prettyRole}</strong>.</p>
      <p>Sign in with this email to view and accept your invite.</p>
      <div style="margin: 30px 0;">
        <a href="${appUrl}" style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Invites</a>
      </div>
      <p style="color: #6B7280; font-size: 12px;">If you didn't expect this, you can ignore this email.</p>
    </div>
  `;

  const textContent = `You're invited to ${organizationName}\n\n$${inviterName ? inviterName + ' has' : 'You have'} invited you to join ${organizationName} as ${prettyRole}.\n\nSign in with this email to view and accept your invite:\n${appUrl}\n\nIf you didn't expect this, you can ignore this email.`.replace(/^\$/m, '');

  return sendEmail({
    to,
    subject: `Invitation to join ${organizationName}`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send a team invite email to a recipient
 */
export async function sendTeamInviteEmail(params: {
  to: string;
  teamName: string;
  organizationName?: string | null;
  role?: string;
  inviterName?: string;
}): Promise<boolean> {
  const { to, teamName, organizationName, role, inviterName } = params;
  const appUrl = `${process.env.WEB_URL || 'https://varsityhub.app'}/invites`;
  const prettyRole = role ? role.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : 'member';

  const orgLabel = organizationName ? ` in ${organizationName}` : '';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827;">You're invited to ${teamName}${orgLabel}</h2>
      <p>${inviterName ? `${inviterName} has` : 'You have'} invited you to join <strong>${teamName}</strong>${orgLabel} as <strong>${prettyRole}</strong>.</p>
      <p>Sign in with this email to view and accept your invite.</p>
      <div style="margin: 30px 0;">
        <a href="${appUrl}" style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Invites</a>
      </div>
      <p style="color: #6B7280; font-size: 12px;">If you didn't expect this, you can ignore this email.</p>
    </div>
  `;

  const textContent = `You're invited to ${teamName}${orgLabel}\n\n$${inviterName ? inviterName + ' has' : 'You have'} invited you to join ${teamName}${orgLabel} as ${prettyRole}.\n\nSign in with this email to view and accept your invite:\n${appUrl}\n\nIf you didn't expect this, you can ignore this email.`.replace(/^\$/m, '');

  return sendEmail({
    to,
    subject: `Invitation to join ${teamName}`,
    text: textContent,
    html: htmlContent,
  });
}
