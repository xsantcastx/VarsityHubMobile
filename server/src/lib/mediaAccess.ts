import crypto from 'crypto';

const SIGNING_SECRET = process.env.JWT_SECRET || '';
const DEFAULT_TTL_SECONDS = 5 * 60;

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return `/${trimmed}`;
  return trimmed;
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
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
