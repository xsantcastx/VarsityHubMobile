import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../lib/jwt.js';
import { LruCache } from '../lib/lruCache.js';
import { prisma } from '../lib/prisma.js';
import { setUserContext, clearUserContext } from '../lib/sentry.js';

export interface AuthedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

/**
 * In-memory auth-state cache.
 *
 * Hot path: avoids 1 DB lookup per request. Cold path: banned/suspended
 * entries get a shorter TTL so a moderation decision can't leave an abuser
 * operating for a full minute. Eviction is true LRU — under heavy traffic we
 * evict genuinely cold entries rather than whatever map inserted first.
 */
type CachedUser = {
  banned: boolean;
  sessionVersion: number;
  suspendedUntilMs: number | null;
};
const AUTH_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_NEGATIVE_TTL_MS = 10_000;
const AUTH_CACHE_MAX_ENTRIES = 10_000;
const userCache = new LruCache<string, CachedUser>(AUTH_CACHE_MAX_ENTRIES);

function ttlFor(entry: CachedUser): number {
  if (entry.banned) return AUTH_CACHE_NEGATIVE_TTL_MS;
  if (entry.suspendedUntilMs !== null && entry.suspendedUntilMs > Date.now()) {
    return AUTH_CACHE_NEGATIVE_TTL_MS;
  }
  return AUTH_CACHE_TTL_MS;
}

/** Called by admin ban/unban and session-bump paths to force cache invalidation. */
export function invalidateAuthCache(userId: string): void {
  userCache.delete(userId);
}

export async function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    clearUserContext();
    return next();
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyJwt<{ id: string; sv?: number }>(token);
  if (!payload?.id) {
    clearUserContext();
    return next();
  }

  // Fast path: serve from cache
  let cached = userCache.get(payload.id);
  if (!cached) {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, banned: true, preferences: true },
    });
    if (!user) {
      clearUserContext();
      return next();
    }
    const prefs =
      user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};
    const sessionVersion =
      typeof prefs.session_version === 'number' && Number.isFinite(prefs.session_version)
        ? prefs.session_version
        : 0;
    const suspensionUntil =
      typeof prefs.suspension_until === 'string' ? new Date(String(prefs.suspension_until)) : null;
    const suspendedUntilMs =
      suspensionUntil instanceof Date && !Number.isNaN(suspensionUntil.getTime())
        ? suspensionUntil.getTime()
        : null;
    cached = {
      banned: !!user.banned,
      sessionVersion,
      suspendedUntilMs,
    };
    userCache.set(payload.id, cached, ttlFor(cached));
  }

  if (cached.banned) {
    clearUserContext();
    return next();
  }
  if ((payload.sv ?? 0) !== cached.sessionVersion) {
    clearUserContext();
    return next();
  }
  if (cached.suspendedUntilMs !== null && cached.suspendedUntilMs > Date.now()) {
    clearUserContext();
    return next();
  }
  req.user = { id: payload.id };
  setUserContext(payload.id);
  next();
}
