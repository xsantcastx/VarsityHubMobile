/**
 * The ONE identity VarsityHub shows for a user: their @username.
 *
 * Product rule (owner): users are looked up and shown by their username — never
 * a generic "User" placeholder when a real username exists.
 *
 * A genuinely missing username is a data gap the backend should close (every
 * user is assigned a username at signup). Until then, an absent username renders
 * as a neutral "@user" placeholder rather than exposing an internal id.
 */

// A raw internal id stored verbatim as a username (legacy rows) is not a real
// handle — treat it as "no handle" so we never surface an id. Valid usernames
// are [a-z0-9_.] and 3–20 chars (see server usernameGenerator), so a 20+ char
// CUID or a hyphenated UUID can never be a valid username; this only guards
// legacy id-as-username rows.
//
// NOTE: the old "8+ lowercase chars, no consecutive vowel pair" heuristic was
// REMOVED. It misclassified ordinary handles like "jfranc15" / "johnsmith" /
// "superfan" as ids and rendered them "@user", while ironically passing actual
// id-shaped handles (e.g. "user_ab12cd"). It caught none of the ids the
// generator produces and hid real users. Do not reintroduce it.
export const isInternalId = (s?: string | null): boolean => {
  if (!s) return true;
  const v = s.trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || // UUID
    /^c[0-9a-z]{20,}$/.test(v) // CUID stored verbatim as a username
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

/** Single-letter avatar fallback — from the username, never a real name. */
export function userHandleInitial(user: HandleUserLike): string {
  const uname = typeof user?.username === 'string' ? user.username.trim() : '';
  if (uname && !isInternalId(uname)) return uname.charAt(0).toUpperCase();
  return '?';
}
