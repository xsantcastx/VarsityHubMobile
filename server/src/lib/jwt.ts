import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

const JWT_SECRET: Secret = process.env.JWT_SECRET as Secret;

// Validate JWT_SECRET on startup
const jwtSecretString = typeof JWT_SECRET === 'string' ? JWT_SECRET : '';
if (!jwtSecretString || jwtSecretString === 'dev-secret-change-me' || jwtSecretString.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be set to a secure random string (minimum 32 characters) in production');
  }
  console.warn('WARNING: Using weak JWT_SECRET. Generate a secure secret with: openssl rand -base64 32');
}

const DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export function signJwt(payload: Record<string, unknown>, expiresIn: string = DEFAULT_ACCESS_TOKEN_EXPIRY): string {
  // @ts-expect-error - expiresIn accepts string but SignOptions type is strict
  const opts: SignOptions = { algorithm: 'HS256', expiresIn };
  return jwt.sign(payload, JWT_SECRET, opts);
}

/**
 * Sign an access token bound to a specific user's current session epoch.
 * The `se` claim lets the auth middleware reject every token issued before
 * the user's most recent login, which is what enforces the "only one active
 * session per user" rule.
 */
export function signAccessTokenForSession(userId: string, sessionEpoch: number): string {
  return signJwt({ id: userId, se: sessionEpoch });
}

export function verifyJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as T;
  } catch (_error) {
    return null;
  }
}

/**
 * Generate a cryptographically random opaque refresh token (64-char hex
 * string). LEGACY shape — used by `hashRefreshToken` (SHA-256). Kept for
 * non-refresh uses like email verification codes; new refresh tokens go
 * through `generateRefreshTokenV2` instead.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hex of a token. Used for legacy v1 refresh tokens AND for
 * non-refresh purposes (email verification codes, password reset codes).
 * Do NOT call this for newly-generated refresh tokens — use
 * `hashRefreshTokenSecret` (bcrypt-based) instead.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── v2 refresh tokens (bcrypt-based, versioned) ─────────────────────────
//
// Threat model: a DB dump of `RefreshToken` should not let an attacker
// forge or rainbow-table refresh tokens. SHA-256 of a 256-bit random is
// already infeasible to brute-force, but SHA-256 has no salt — two users
// with identical (improbable) tokens collide, and any attacker who steals
// the DB can confirm guesses cheaply.
//
// v2 splits the raw token into `<keyId>.<secret>`:
//   - keyId (8 bytes hex) is the deterministic lookup column (RefreshToken.key_id)
//   - secret (32 bytes hex) is bcrypt-hashed into RefreshToken.token_hash
//
// Lookup is still O(1) (by indexed key_id), but verification requires the
// raw secret — making DB-dump replay impossible without a CPU-bound bcrypt
// brute-force per token. RefreshToken.hash_version distinguishes v1/v2 so
// we can read both during the migration window and lazily upgrade.

export const REFRESH_TOKEN_HASH_VERSION_V2 = 2;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a v2 refresh token: `<keyId>.<secret>` shape.
 * Returns the raw token (to send to the client) plus its parts (so the
 * caller can store keyId + bcrypt(secret) without re-parsing).
 */
export function generateRefreshTokenV2(): { raw: string; keyId: string; secret: string } {
  const keyId = crypto.randomBytes(8).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  return { raw: `${keyId}.${secret}`, keyId, secret };
}

/** bcrypt the secret half of a v2 token for DB storage. */
export async function hashRefreshTokenSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

/**
 * Parse a raw refresh token. v2 tokens have a `<16-hex-char>.<rest>` shape;
 * anything else is treated as legacy v1 (lookup by SHA-256 over the whole
 * raw value).
 */
export function parseRefreshToken(
  raw: string,
): { version: 1 } | { version: 2; keyId: string; secret: string } {
  const dotIdx = raw.indexOf('.');
  if (dotIdx !== 16) return { version: 1 };
  const keyId = raw.slice(0, dotIdx);
  if (!/^[a-f0-9]{16}$/.test(keyId)) return { version: 1 };
  return { version: 2, keyId, secret: raw.slice(dotIdx + 1) };
}

/**
 * Verify a raw refresh token against a stored hash. Branches on
 * `hash_version`: v1 = SHA-256 equality, v2 = bcrypt compare on the
 * secret half. Constant-time on the v1 path (Node's crypto compares are
 * timing-safe via `timingSafeEqual`).
 */
export async function verifyRefreshTokenHash(
  raw: string,
  storedHash: string,
  version: number | null | undefined,
): Promise<boolean> {
  const v = version ?? 1;
  if (v === REFRESH_TOKEN_HASH_VERSION_V2) {
    const parsed = parseRefreshToken(raw);
    if (parsed.version !== 2) return false;
    return bcrypt.compare(parsed.secret, storedHash);
  }
  const candidate = hashRefreshToken(raw);
  if (candidate.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
}

export { DEFAULT_ACCESS_TOKEN_EXPIRY };

