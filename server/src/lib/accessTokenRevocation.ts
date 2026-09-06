import { cacheGet, cacheSet } from './cache.js';
import { verifyJwt } from './jwt.js';

const ACCESS_TOKEN_REVOKED_PREFIX = 'auth:access-token-revoked:';
const MIN_REVOKE_TTL_SECONDS = 1;
const MAX_REVOKE_TTL_SECONDS = 15 * 60;

const memoryDenylist = new Map<string, number>();

function cacheKey(jti: string): string {
  return `${ACCESS_TOKEN_REVOKED_PREFIX}${jti}`;
}

function cleanupMemoryDenylist(nowMs = Date.now()): void {
  if (process.env.NODE_ENV === 'production') return;
  for (const [jti, expiresAtMs] of memoryDenylist.entries()) {
    if (expiresAtMs <= nowMs) memoryDenylist.delete(jti);
  }
}

function rememberRevokedTokenInMemory(jti: string, ttlSeconds: number): void {
  if (process.env.NODE_ENV === 'production') return;
  cleanupMemoryDenylist();
  memoryDenylist.set(jti, Date.now() + ttlSeconds * 1000);
}

function isRevokedInMemory(jti: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  cleanupMemoryDenylist();
  return memoryDenylist.has(jti);
}

export function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token || null;
}

export async function revokeAccessToken(rawAccessToken: string): Promise<boolean> {
  const payload = verifyJwt<{ jti?: string; exp?: number }>(rawAccessToken);
  if (!payload?.jti || !payload.exp) return false;

  const ttlSeconds = Math.min(MAX_REVOKE_TTL_SECONDS, Math.floor(payload.exp - Date.now() / 1000));
  if (ttlSeconds < MIN_REVOKE_TTL_SECONDS) return false;

  rememberRevokedTokenInMemory(payload.jti, ttlSeconds);
  await cacheSet(cacheKey(payload.jti), true, ttlSeconds);
  return true;
}

export async function isAccessTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  if (isRevokedInMemory(jti)) return true;
  return (await cacheGet<boolean>(cacheKey(jti))) === true;
}

export function __clearAccessTokenRevocationsForTests(): void {
  memoryDenylist.clear();
}
