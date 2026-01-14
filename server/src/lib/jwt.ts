import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
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

export function verifyJwt<T = any>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch {
    return null;
  }
}

export { DEFAULT_ACCESS_TOKEN_EXPIRY };
