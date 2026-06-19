import { APP_REVIEW_EMAIL } from './appReviewFixture.js';

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

function withAppReviewAdminAccess(emails: string[]): string[] {
  const demoEmail = APP_REVIEW_EMAIL.trim().toLowerCase();
  return emails.includes(demoEmail) ? emails : [...emails, demoEmail];
}

const rawAdminEmails = process.env.ADMIN_EMAILS || '';
export const ADMIN_EMAILS: string[] = withAppReviewAdminAccess(parseEmailList(rawAdminEmails));

/**
 * Parsed ADMIN_NOTIFICATION_EMAILS — cached at module load time.
 * Falls back to ADMIN_EMAILS for backward compatibility so old deploys keep working.
 */
const rawAdminNotificationEmails =
  process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAILS || '';
export const ADMIN_NOTIFICATION_EMAILS: string[] = parseEmailList(rawAdminNotificationEmails);

function getCurrentAdminEmails(): string[] {
  return withAppReviewAdminAccess(parseEmailList(process.env.ADMIN_EMAILS));
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

/**
 * The super admin mailbox. Banner-ad and new-organization approvals must ALWAYS
 * be routed here regardless of how ADMIN_EMAILS / ADMIN_NOTIFICATION_EMAILS are
 * configured, so a non-empty env (e.g. ADMIN_EMAILS=admin@…) can't silently
 * divert these approvals away from customer service.
 */
export const SUPER_ADMIN_EMAIL = 'customerservice@varsityhub.app';

/**
 * Recipients for approvals that must always include the super admin (new orgs,
 * banner ads). Unions the super admin into the configured notification list and
 * dedupes, so customerservice@varsityhub.app is guaranteed present.
 */
export function getApprovalNotificationEmails(): string[] {
  const emails = getAllAdminEmails().map((e) => e.toLowerCase());
  const superAdmin = SUPER_ADMIN_EMAIL.toLowerCase();
  return emails.includes(superAdmin) ? emails : [...emails, superAdmin];
}
