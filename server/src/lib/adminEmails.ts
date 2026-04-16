/**
 * Parsed ADMIN_EMAILS — cached at module load time.
 * Avoids re-parsing the env var on every request across 20+ call sites.
 */
const raw = process.env.ADMIN_EMAILS || '';
export const ADMIN_EMAILS: string[] = raw
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * v1.0.2 audit fix: Return the primary admin email for notifications.
 * Falls back to customerservice@varsityhub.app (not a personal email).
 */
export function getPrimaryAdminEmail(): string {
  return ADMIN_EMAILS[0] || 'customerservice@varsityhub.app';
}

/**
 * v1.0.2 audit fix: Return ALL admin emails for notifications that
 * should reach every admin (approval requests, abuse reports, etc.).
 * Always includes at least one address.
 */
export function getAllAdminEmails(): string[] {
  return ADMIN_EMAILS.length > 0 ? [...ADMIN_EMAILS] : ['customerservice@varsityhub.app'];
}
