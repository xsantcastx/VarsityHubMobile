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

export function formatUserLabel(user?: UserLike | null, fallback = 'User') {
  const displayName = nonEmpty(user?.display_name);
  if (displayName) return displayName;

  const username = nonEmpty(user?.username);
  if (username) return `@${username}`;

  const email = nonEmpty(user?.email);
  if (email) return email;

  // v1.0.3: if the server returned a user with an id but no display fields
  // (happens with OAuth users who haven't completed step-2 onboarding), use
  // a stable short-id rather than the previous "Unknown User" which looked
  // like a system error and made it impossible to tell threads apart.
  const id = nonEmpty(user?.id);
  if (id) {
    return `User ${id.slice(-4).toUpperCase()}`;
  }

  return fallback;
}
