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

const DEFAULT_ACCESS_TOKEN_EXPIRY = '7d';

export function signJwt(payload: Record<string, unknown>, expiresIn: string = DEFAULT_ACCESS_TOKEN_EXPIRY): string {
  // @ts-expect-error - expiresIn accepts string but SignOptions type is strict
  const opts: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, opts);
}

export function verifyJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch (_error) {
    return null;
  }
}

export { DEFAULT_ACCESS_TOKEN_EXPIRY };

