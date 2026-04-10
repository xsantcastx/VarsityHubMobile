import { buildText, escapeHtml, renderEmailShell, type RenderedEmailTemplate } from './shared.js';

interface TeamInviteTemplateInput {
  appBaseUrl: string;
  teamName: string;
  organizationName?: string | null;
  recipientName?: string;
  inviterName?: string;
  role?: string;
  inviteUrl: string;
}

export function createTeamInviteEmailTemplate({
  appBaseUrl,
  teamName,
  organizationName,
  recipientName,
  inviterName,
  role,
  inviteUrl,
}: TeamInviteTemplateInput): RenderedEmailTemplate {
  const subject = `You've been invited to join ${teamName}`;
  const resolvedRole = role || 'member';

  return {
    subject,
    text: buildText([
      `Hi ${recipientName || 'there'},`,
      '',
      `${inviterName || 'A VarsityHub coach'} invited you to join ${teamName}${organizationName ? ` (${organizationName})` : ''} as ${resolvedRole}.`,
      `Open invite: ${inviteUrl}`,
      '',
      `VarsityHub`,
      appBaseUrl,
    ]),
    html: renderEmailShell({
      title: 'Team invitation',
      intro: `${inviterName || 'A VarsityHub coach'} invited ${recipientName || 'you'} to join ${teamName}.`,
      bodyHtml: `
        <div style="margin:24px 0;padding:20px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#1e3a8a;"><strong>Team</strong></p>
          <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(teamName)}</p>
          ${
            organizationName
              ? `<p style="margin:0 0 8px 0;font-size:14px;color:#334155;">Organization: ${escapeHtml(organizationName)}</p>`
              : ''
          }
          <p style="margin:0;font-size:14px;color:#334155;">Role: ${escapeHtml(resolvedRole)}</p>
        </div>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#334155;">
          Open the invitation link below in the app or browser.
        </p>
        <p style="margin:0;">
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:14px 18px;border-radius:12px;background:#2563eb;color:#ffffff;font-weight:700;text-decoration:none;">
            Open invite
          </a>
        </p>
      `,
      footerNote: appBaseUrl,
    }),
  };
}
