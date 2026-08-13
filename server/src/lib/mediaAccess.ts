import crypto from 'crypto';

const SIGNING_SECRET = process.env.JWT_SECRET || '';
const DEFAULT_TTL_SECONDS = 5 * 60;

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return `/${trimmed}`;
  return trimmed;
}

/** Upper bound on a signable path. Well past any real upload key. */
const MAX_MEDIA_PATH_LENGTH = 512;

/**
 * Allowlist of characters permitted in a signable media path, anchored to the
 * `/uploads/` prefix. Only unreserved URL characters and `/` are allowed, so
 * traversal, encoding tricks, control characters, query/fragment smuggling and
 * protocol-relative URLs are all inexpressible rather than individually denied.
 *
 * Replaces the previous denylist (`rawPath.includes('..')`), which let
 * percent-encoded traversal (`%2e%2e`, `%252e%252e`) through: those carry no
 * literal '..', so the route happily minted a valid HMAC for an
 * attacker-shaped path. express.static blocked the actual read, so it was never
 * file disclosure — but signing paths we would never serve is the wrong default,
 * and it only held because a downstream component happened to be careful.
 */
const SIGNABLE_MEDIA_PATH = /^\/uploads\/[A-Za-z0-9/_.-]+$/;

/**
 * Whether `value` is a path this server is willing to mint a signature for.
 *
 * Note the `..` check is still applied on top of the allowlist: `.` and `/` are
 * both legal characters individually, so the pattern alone would admit
 * `/uploads/../secrets`.
 */
export function isSignableMediaPath(value: string): boolean {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  if (!path || path.length > MAX_MEDIA_PATH_LENGTH) return false;
  if (!SIGNABLE_MEDIA_PATH.test(path)) return false;
  // Reject any traversal segment the allowlist can still spell.
  if (path.split('/').includes('..')) return false;
  return true;
}

export function signMediaPath(path: string, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  if (!SIGNING_SECRET) {
    throw new Error('Signing secret is not configured');
  }
  const normalized = normalizePath(path);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = `${normalized}:${exp}`;
  const token = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex');
  return { path: normalized, token, exp };
}

export function verifyMediaSignature(
  path: string,
  token?: string | null,
  exp?: number | null
): boolean {
  if (!SIGNING_SECRET) return false;
  if (!token || !exp) return false;
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) return false;
  const normalized = normalizePath(path);
  const data = `${normalized}:${exp}`;
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex');

  // Compare BYTE length, not string length. crypto.timingSafeEqual throws a
  // RangeError on a byte-length mismatch, and a 64-CHARACTER token containing a
  // multi-byte character (e.g. 63 ASCII + 'é') is 65 BYTES — it slipped past the
  // old `expected.length !== token.length` guard and made this throw. On the
  // public /uploads media middleware that surfaced as an unauthenticated 500
  // plus a Sentry `unknown_error`, i.e. free log spam and quota burn for any
  // scanner. Buffers are built explicitly so both sides are unambiguous.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const tokenBuf = Buffer.from(token, 'utf8');
  if (expectedBuf.length !== tokenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, tokenBuf);
}
