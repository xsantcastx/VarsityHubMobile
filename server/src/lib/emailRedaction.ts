/**
 * Email redaction helper for logs.
 *
 * Redacts the local-part of an email address to the first character + `***`,
 * keeping the domain visible for operational correlation. All email addresses
 * are redacted — not just minors — because adult email addresses are also PII
 * and don't belong in stdout / Railway logs. Minor-email redaction is a strict
 * subset of this behavior, which satisfies COPPA logging hygiene.
 *
 * Examples:
 *   alice@gmail.com       -> a***@gmail.com
 *   bob.smith@example.co  -> b***@example.co
 *   not-an-email          -> [redacted]
 *   null / undefined      -> [redacted]
 *
 * Set `EMAIL_LOG_UNREDACTED=1` in a non-production environment to bypass for
 * local debugging. In production, the env var is ignored fail-closed.
 */
export function redactEmail(value: unknown): string {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && process.env.EMAIL_LOG_UNREDACTED === '1') {
    return typeof value === 'string' ? value : String(value ?? '');
  }

  if (typeof value !== 'string' || value.length === 0) return '[redacted]';
  const trimmed = value.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '[redacted]';

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain.includes('.')) return '[redacted]';

  return `${local.charAt(0)}***@${domain}`;
}

/**
 * Redact either a single email or an array of emails for logging.
 * Preserves array shape so JSON audit logs remain structurally equivalent.
 */
export function redactEmailList(value: unknown): string | string[] {
  if (Array.isArray(value)) return value.map(v => redactEmail(v));
  return redactEmail(value);
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const OTP_PATTERN = /\b\d{6}\b/g;

export function sanitizeEmailSubject(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '[redacted-subject]';
  return value.replace(OTP_PATTERN, '[redacted-code]');
}

export function sanitizeEmailLogMessage(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '[redacted-log]';
  return sanitizeEmailSubject(value).replace(EMAIL_PATTERN, match => redactEmail(match));
}
