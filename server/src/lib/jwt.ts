import jwt, { type Secret, type SignOptions, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { env } from './env.js';

const JWT_SECRET: Secret = env.JWT_SECRET;

// Validate JWT_SECRET on startup
const jwtSecretString = typeof JWT_SECRET === 'string' ? JWT_SECRET : '';
if (!jwtSecretString || jwtSecretString === 'dev-secret-change-me' || jwtSecretString.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be set to a secure random string (minimum 32 characters) in production');
  }
  console.warn('WARNING: Using weak JWT_SECRET. Generate a secure secret with: openssl rand -base64 32');
}

// Reduced access token expiry - use refresh tokens for long-lived sessions
const DEFAULT_ACCESS_TOKEN_EXPIRY = '1h';

export function signJwt(payload: Record<string, unknown>, expiresIn: string = DEFAULT_ACCESS_TOKEN_EXPIRY) {
  const opts: SignOptions = { expiresIn: expiresIn as any } as SignOptions;
  return jwt.sign(payload, JWT_SECRET, opts);
}

/**
 * SECURITY: JWT verification result with detailed error information
 */
export type JwtVerifyResult<T> =
  | { valid: true; payload: T }
  | { valid: false; reason: 'expired' | 'invalid' | 'malformed' | 'not_active' | 'unknown'; error?: string };

/**
 * SECURITY: Verify JWT with detailed error reporting for logging/metrics.
 * Use this when you need to know WHY verification failed.
 */
export function verifyJwtDetailed<T = any>(token: string): JwtVerifyResult<T> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as T;
    return { valid: true, payload };
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return { valid: false, reason: 'expired', error: `Token expired at ${err.expiredAt}` };
    }
    if (err instanceof NotBeforeError) {
      return { valid: false, reason: 'not_active', error: `Token not active until ${err.date}` };
    }
    if (err instanceof JsonWebTokenError) {
      // Covers: invalid signature, malformed token, etc.
      return { valid: false, reason: 'malformed', error: err.message };
    }
    return { valid: false, reason: 'unknown', error: String(err) };
  }
}

/**
 * Simple JWT verification - returns payload or null.
 * SECURITY: Now logs verification failures for security monitoring.
 */
export function verifyJwt<T = any>(token: string): T | null {
  const result = verifyJwtDetailed<T>(token);
  if (result.valid) {
    return result.payload;
  }

  // SECURITY: Log failed verification attempts (but don't expose token content)
  // In production, you might want to send this to a monitoring service
  if (result.reason !== 'expired') {
    // Don't log expired tokens as they're normal behavior
    console.warn(`[jwt] Token verification failed: ${result.reason}`, {
      reason: result.reason,
      // Don't log the actual error message in production as it might leak info
      ...(process.env.NODE_ENV !== 'production' && { detail: result.error })
    });
  }

  return null;
}

export { DEFAULT_ACCESS_TOKEN_EXPIRY };
