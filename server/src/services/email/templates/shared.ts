export interface RenderedEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

interface EmailShellOptions {
  title: string;
  eyebrow?: string;
  intro?: string;
  bodyHtml: string;
  footerNote?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildText(lines: Array<string | null | undefined>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join('\n');
}

export function renderEmailShell({
  title,
  eyebrow = 'VarsityHub',
  intro,
  bodyHtml,
  footerNote,
}: EmailShellOptions): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #dbe4f0;border-radius:20px;padding:32px 24px;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;margin-bottom:12px;">
        ${escapeHtml(eyebrow)}
      </div>
      <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.2;color:#0f172a;">
        ${escapeHtml(title)}
      </h1>
      ${intro ? `<p style="margin:0 0 20px 0;font-size:16px;line-height:1.7;color:#334155;">${escapeHtml(intro)}</p>` : ''}
      ${bodyHtml}
      ${
        footerNote
          ? `<p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(footerNote)}</p>`
          : ''
      }
    </div>
  </div>
</body>
</html>
  `.trim();
}
