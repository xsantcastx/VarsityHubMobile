// Lightweight client-side email HTML generators for preview/testing
// Provides: reportResolvedHTML, reportDismissedHTML, accountSuspendedHTML

type AppealData = {
  reportId: string | number;
  violationType?: string;
  suspensionDate?: string; // ISO or readable
  reinstatementDate?: string; // ISO or readable
  userName?: string;
  appealMailto?: string; // mailto link built by backend
};

export function reportResolvedHTML({ reportId, userName }: AppealData) {
  const name = userName ?? 'VarsityHub User';
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #111;">
    <h2>✅ Report Resolved</h2>
    <p>Hi ${name},</p>
    <p>Your report <strong>#${reportId}</strong> has been reviewed and action has been taken.</p>
    <p>Thank you for helping keep VarsityHub safe.</p>
  </div>
  `;
}

export function reportDismissedHTML({ reportId, userName, appealMailto }: AppealData) {
  const name = userName ?? 'VarsityHub User';
  const appealLink = appealMailto
    ? `<p>If you believe this was in error, you may <a href="${appealMailto}">submit an appeal via email</a>.</p>`
    : '';
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #111;">
    <h2>📝 Report Dismissed</h2>
    <p>Hi ${name},</p>
    <p>Your report <strong>#${reportId}</strong> was reviewed. We did not find a violation.</p>
    ${appealLink}
  </div>
  `;
}

export function accountSuspendedHTML({
  reportId,
  violationType,
  suspensionDate,
  reinstatementDate,
  userName,
  appealMailto,
}: AppealData) {
  const name = userName ?? 'VarsityHub Team';
  const suspend = suspensionDate ?? '';
  const reinstate = reinstatementDate ?? '';
  const violation = violationType ?? 'Policy Violation';
  const appealLink = appealMailto
    ? `<p><strong>Submit an Appeal:</strong> <a href="${appealMailto}">Email Customer Service</a></p>`
    : '';
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111;">
    <h2>⚠️ Account Suspended (45 Days)</h2>
    <p>Hi ${name},</p>
    <p>The account associated with report <strong>#${reportId}</strong> has been suspended for 45 days.</p>
    <p><strong>Violation Type:</strong> ${violation}<br/>
       <strong>Suspension Date:</strong> ${suspend}<br/>
       <strong>Reinstatement Date:</strong> ${reinstate}</p>
    <p>If you believe this suspension is in error, you may appeal.</p>
    ${appealLink}
    <p>Thank you,<br/>VarsityHub Trust & Safety</p>
  </div>
  `;
}

// Small helper to compute +45 days client-side for previews
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
