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
