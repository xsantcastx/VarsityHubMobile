type UserLike = {
  id?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
};

const nonEmpty = (value?: string | null) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * The one front-facing identity string for a user. Owner rule: a user is
 * recognized ONLY by their @username — never a real/government name, email,
 * Apple ID, or Gmail. So this deliberately ignores display_name and email and
 * NEVER surfaces them. If there is no username yet (e.g. an OAuth user who
 * hasn't finished onboarding), fall back to a stable, non-identifying short id
 * so rows/threads stay distinguishable — but no personal data leaks.
 */
export function formatUserLabel(user?: UserLike | null, fallback = 'User') {
  const username = nonEmpty(user?.username);
  if (username) return `@${username}`;

  const id = nonEmpty(user?.id);
  if (id) {
    return `User ${id.slice(-4).toUpperCase()}`;
  }

  return fallback;
}
