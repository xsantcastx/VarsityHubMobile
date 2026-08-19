/**
 * The ONE identity VarsityHub shows for a user: their @username.
 *
 * Product rule (owner, 2026-08-18): users are only ever looked up and shown by
 * their username — never their real name (`display_name`) and never a generic
 * "User". A person's real name must not leak onto public surfaces.
 *
 * A genuinely missing username is a data gap the backend must close (every user
 * should be assigned a username at signup), NOT a reason to fall back to
 * display_name. Until backfill completes, an absent username renders as a
 * neutral "@user" placeholder rather than exposing the person's real name.
 */

// Usernames that are actually system-generated ids (CUIDs / random ids), not
// real handles — treat them as "no handle" so we never surface a raw id.
const isInternalId = (s?: string | null): boolean => {
  if (!s) return true;
  const v = s.trim();
  return (
    /^c[0-9a-z]{20,}$/.test(v) || // CUID v1
    (/^[0-9a-z]{8,}$/.test(v) && !/[aeiou]{2,}/i.test(v)) // random id (no vowel pairs)
  );
};

type HandleUserLike = { username?: string | null } | null | undefined;

/** The display handle for a user. `@username`, or `@user` when none is set. */
export function formatUserHandle(user: HandleUserLike, opts?: { at?: boolean }): string {
  const at = opts?.at !== false;
  const uname = typeof user?.username === 'string' ? user.username.trim() : '';
  if (uname && !isInternalId(uname)) return at ? `@${uname}` : uname;
  return at ? '@user' : 'user';
}

/** True when the user has a real, showable username. */
export function hasRealUsername(user: HandleUserLike): boolean {
  const uname = typeof user?.username === 'string' ? user.username.trim() : '';
  return !!uname && !isInternalId(uname);
}

/** Single-letter avatar fallback — from the username, never the real name. */
export function userHandleInitial(user: HandleUserLike): string {
  const uname = typeof user?.username === 'string' ? user.username.trim() : '';
  if (uname && !isInternalId(uname)) return uname.charAt(0).toUpperCase();
  return '?';
}
