import { prisma as defaultPrisma } from './prisma.js';
import { isReservedUsername } from './reservedUsernames.js';

// Mirror of the server username contract (auth.ts updateMeSchema + client
// utils/formUtils USERNAME_REGEX): lowercase letters, digits, dot, underscore.
const USERNAME_RE = /^[a-z0-9_.]+$/;
const MIN_LEN = 3;
const MAX_LEN = 20;

/**
 * Turn an arbitrary source string (email local-part, display name) into the
 * allowed username charset: lowercase, strip anything but [a-z0-9_.], and trim
 * leading/trailing dots/underscores. Returns '' when nothing usable remains.
 */
export function slugifyUsernameBase(input: string | null | undefined): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9_.]+/g, '')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, MAX_LEN);
}

type PrismaLike = { user: { findFirst: (args: any) => Promise<{ id: string } | null> } };

/**
 * Generate a unique, valid username from a base (email local-part preferred,
 * else display name). Guarantees the result matches USERNAME_RE, is 3–20 chars,
 * is not reserved, and is unique (case-insensitive) in the users table. Appends
 * an underscore + random digits on collision, trimming the root to stay ≤20.
 *
 * Used by every account-creation path (register, Google, Apple) and the
 * backfill script so no VarsityHub user is ever without a username — the app
 * shows users by @username only (utils/userHandle.ts).
 */
export async function generateUniqueUsername(
  base: string | null | undefined,
  prisma: PrismaLike = defaultPrisma as unknown as PrismaLike,
  // Case-insensitive set of usernames already claimed earlier in this batch but
  // not yet written to the DB (used by the backfill so a dry run — or a burst of
  // same-base rows — never proposes the same handle twice). Mutated as handles
  // are chosen.
  extraTaken?: Set<string>
): Promise<string> {
  const isTaken = async (candidate: string): Promise<boolean> => {
    if (!USERNAME_RE.test(candidate) || candidate.length < MIN_LEN || candidate.length > MAX_LEN) {
      return true;
    }
    if (isReservedUsername(candidate)) return true;
    if (extraTaken?.has(candidate.toLowerCase())) return true;
    const existing = await prisma.user.findFirst({
      where: { username: { equals: candidate, mode: 'insensitive' } },
      select: { id: true },
    });
    return !!existing;
  };

  let root = slugifyUsernameBase(base);
  if (root.length < MIN_LEN) root = (`user${root}`).slice(0, MAX_LEN);

  // 1) Try the bare root.
  if (!(await isTaken(root))) return root;

  // 2) Append random numeric suffixes, trimming the root to leave room.
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9_000_000)); // 4–7 digits
    const rootRoom = Math.max(1, MAX_LEN - suffix.length - 1); // 1 for the '_'
    const trimmed = root.slice(0, rootRoom) || 'user';
    const candidate = `${trimmed}_${suffix}`.slice(0, MAX_LEN);
    if (!(await isTaken(candidate))) return candidate;
  }

  // 3) Last-resort deterministic-unique fallback (timestamp base36).
  return `user_${Date.now().toString(36)}`.slice(0, MAX_LEN);
}
