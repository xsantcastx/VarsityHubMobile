import { buildText, escapeHtml, renderEmailShell, type RenderedEmailTemplate } from './shared.js';

interface VerificationTemplateInput {
  appBaseUrl: string;
  code: string;
  userName?: string;
}

export function createVerificationEmailTemplate({
  appBaseUrl,
  code,
  userName,
}: VerificationTemplateInput): RenderedEmailTemplate {
  const displayName = userName || 'VarsityHub User';
  const subject = `${code} is your VarsityHub verification code`;

  return {
    subject,
    text: buildText([
      `Hi ${displayName},`,
      '',
      'Welcome to VarsityHub. Please verify your email address to complete your registration.',
      '',
      `Your verification code is: ${code}`,
      'This code will expire in 30 minutes.',
      '',
      "If you didn't create a VarsityHub account, you can safely ignore this email.",
      '',
      `VarsityHub`,
      appBaseUrl,
    ]),
    html: renderEmailShell({
      title: 'Verify your email',
      intro: `Hi ${displayName}, please use the code below to finish creating your VarsityHub account.`,
      bodyHtml: `
        <div style="margin:24px 0;padding:24px;border-radius:16px;background:linear-gradient(135deg,#2563eb,#1d4ed8);text-align:center;">
          <div style="font-size:13px;color:#dbeafe;margin-bottom:10px;">Verification code</div>
          <div style="display:inline-block;background:#ffffff;border-radius:12px;padding:18px 22px;font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">
            ${escapeHtml(code)}
          </div>
        </div>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">This code expires in <strong>30 minutes</strong>.</p>
      `,
      footerNote: `If you did not create a VarsityHub account, ignore this email. ${appBaseUrl}`,
    }),
  };
}
