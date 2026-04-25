/**
 * Parsed ADMIN_EMAILS — cached at module load time.
 * Used only for admin access control.
 */
function parseEmailList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const rawAdminEmails = process.env.ADMIN_EMAILS || '';
export const ADMIN_EMAILS: string[] = parseEmailList(rawAdminEmails);

/**
 * Parsed ADMIN_NOTIFICATION_EMAILS — cached at module load time.
 * Falls back to ADMIN_EMAILS for backward compatibility so old deploys keep working.
 */
const rawAdminNotificationEmails =
  process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAILS || '';
export const ADMIN_NOTIFICATION_EMAILS: string[] = parseEmailList(rawAdminNotificationEmails);

function getCurrentAdminEmails(): string[] {
  return parseEmailList(process.env.ADMIN_EMAILS);
}

function getCurrentAdminNotificationEmails(): string[] {
  return parseEmailList(process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAILS);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getCurrentAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Return the primary admin notification email.
 * Falls back to customerservice@varsityhub.app (not a personal email).
 */
export function getPrimaryAdminEmail(): string {
  return getCurrentAdminNotificationEmails()[0] || 'customerservice@varsityhub.app';
}

/**
 * Return all admin notification recipients.
 * Falls back to ADMIN_EMAILS for backward compatibility and always includes at least one address.
 */
export function getAllAdminEmails(): string[] {
  const adminNotificationEmails = getCurrentAdminNotificationEmails();
  return adminNotificationEmails.length > 0
    ? [...adminNotificationEmails]
    : ['customerservice@varsityhub.app'];
}
