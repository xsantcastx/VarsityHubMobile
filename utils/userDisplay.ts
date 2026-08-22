import { formatUserHandle } from './userHandle';

type UserLike = {
  id?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
};

/**
 * A user's display label. Product rule (2026-08-18): users are shown by their
 * @username only — never their real name (display_name) or email. This now
 * delegates to the single source of truth, formatUserHandle (utils/userHandle),
 * so every caller (DM list/search, blocked users, staff roster) shows @username.
 * The `fallback` argument is retained for signature compatibility but unused —
 * a missing username renders as the neutral "@user" placeholder, never a real
 * name or a system-looking id.
 */
export function formatUserLabel(user?: UserLike | null, _fallback = 'User') {
  return formatUserHandle(user);
}
