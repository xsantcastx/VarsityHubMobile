import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

const JWT_SECRET: Secret = (process.env.JWT_SECRET || 'dev-secret-change-me') as Secret;

export function signJwt(payload: Record<string, unknown>, expiresIn: string = '7d') {
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

