type UserLike = {
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
};

const nonEmpty = (value?: string | null) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

export function formatUserLabel(user?: UserLike | null, fallback = 'User') {
  const displayName = nonEmpty(user?.display_name);
  if (displayName) return displayName;

  const username = nonEmpty(user?.username);
  if (username) return `@${username}`;

  const email = nonEmpty(user?.email);
  if (email) return email;

  return fallback;
}
