import { buildText, renderEmailShell, type RenderedEmailTemplate } from './shared.js';

interface WelcomeTemplateInput {
  appBaseUrl: string;
  userName?: string;
}

export function createWelcomeEmailTemplate({
  appBaseUrl,
  userName,
}: WelcomeTemplateInput): RenderedEmailTemplate {
  const displayName = userName || 'there';

  return {
    subject: 'Welcome to VarsityHub',
    text: buildText([
      `Hi ${displayName},`,
      '',
      'Welcome to VarsityHub. Your account is ready, and you can now finish onboarding, follow teams, and manage your season workflows.',
      '',
      `Open VarsityHub: ${appBaseUrl}`,
    ]),
    html: renderEmailShell({
      title: 'Welcome to VarsityHub',
      intro: `Hi ${displayName}, your account is ready.`,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">
          You can now finish onboarding, follow teams, and manage your season workflows in VarsityHub.
        </p>
      `,
      footerNote: appBaseUrl,
    }),
  };
}
