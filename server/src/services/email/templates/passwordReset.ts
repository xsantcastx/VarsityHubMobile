import { buildText, escapeHtml, renderEmailShell, type RenderedEmailTemplate } from './shared.js';

interface PasswordResetTemplateInput {
  appBaseUrl: string;
  code: string;
}

export function createPasswordResetEmailTemplate({
  appBaseUrl,
  code,
}: PasswordResetTemplateInput): RenderedEmailTemplate {
  const subject = `${code} is your VarsityHub password reset code`;

  return {
    subject,
    text: buildText([
      'Hi,',
      '',
      'We received a request to reset your VarsityHub password.',
      '',
      `Your password reset code is: ${code}`,
      'This code will expire in 30 minutes.',
      '',
      "If you didn't request a password reset, you can safely ignore this email.",
      '',
      `VarsityHub`,
      appBaseUrl,
    ]),
    html: renderEmailShell({
      title: 'Reset your password',
      intro: 'Use the reset code below to choose a new VarsityHub password.',
      bodyHtml: `
        <div style="margin:24px 0;padding:24px;border-radius:16px;background:linear-gradient(135deg,#dc2626,#b91c1c);text-align:center;">
          <div style="font-size:13px;color:#fee2e2;margin-bottom:10px;">Password reset code</div>
          <div style="display:inline-block;background:#ffffff;border-radius:12px;padding:18px 22px;font-size:32px;font-weight:800;letter-spacing:8px;color:#b91c1c;">
            ${escapeHtml(code)}
          </div>
        </div>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">This code expires in <strong>30 minutes</strong>.</p>
      `,
      footerNote: `If you did not request a reset, no action is required. ${appBaseUrl}`,
    }),
  };
}
