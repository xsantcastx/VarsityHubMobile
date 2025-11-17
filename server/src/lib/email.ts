import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP transport
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
 * Send an email using the configured SMTP service
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
    to: 'customerservice@varsityhub.app',
    subject: `[ABUSE REPORT] ${subject}`,
    text: textContent,
    html: htmlContent,
  });
}
