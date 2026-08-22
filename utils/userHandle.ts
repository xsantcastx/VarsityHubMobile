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

// A raw internal id stored verbatim as a username (legacy rows), not a real
// handle — treat it as "no handle" so we never surface an id. Valid usernames
// are [a-z0-9_.] and 3–20 chars (see server usernameGenerator), so a 21+char
// CUID can never be a valid username; this only guards legacy id-as-username
// rows.
//
// The old "8+ lowercase chars, no consecutive vowel pair" rule was REMOVED: it
// misclassified ordinary handles like "jacobgflamm" / "superfan" / "johnsmith"
// as ids and rendered them "@user", while ironically passing actual id-shaped
// handles (e.g. "user_ab12cd"). It caught none of the ids the generator
// actually produces (those contain an underscore) and hid real users.
const isInternalId = (s?: string | null): boolean => {
  if (!s) return true;
  return /^c[0-9a-z]{20,}$/.test(s.trim()); // CUID stored verbatim
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
