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
  const opts: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, opts);
}

export function verifyJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as T;
  } catch (_error) {
    return null;
  }
}

/** Generate a cryptographically random opaque refresh token (64-char hex string). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Hash a refresh token for safe database storage (SHA-256). */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export { DEFAULT_ACCESS_TOKEN_EXPIRY };

