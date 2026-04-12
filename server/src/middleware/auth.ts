import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { setUserContext, clearUserContext } from '../lib/sentry.js';

export interface AuthedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

/**
 * In-memory cache for user ban/session state.
 *
 * Auth middleware runs on every authenticated request. Without a cache this
 * caused 1 DB lookup per request before any route handler ran — the single
 * biggest source of request latency under load. 60 s TTL means a banned user
 * or session_version bump takes up to a minute to propagate, which is an
 * acceptable tradeoff for the throughput win.
 */
type CachedUser = {
  banned: boolean;
  sessionVersion: number;
  suspendedUntilMs: number | null;
  expiresAt: number;
};
const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<string, CachedUser>();

function readCache(userId: string): CachedUser | null {
  const hit = userCache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    userCache.delete(userId);
    return null;
  }
  return hit;
}

function writeCache(
  userId: string,
  data: Omit<CachedUser, 'expiresAt'>,
): void {
  // Opportunistic size cap — prevent unbounded growth under heavy traffic.
  if (userCache.size > 10_000) {
    const firstKey = userCache.keys().next().value;
    if (firstKey) userCache.delete(firstKey);
  }
  userCache.set(userId, { ...data, expiresAt: Date.now() + USER_CACHE_TTL_MS });
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
  let cached = readCache(payload.id);
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
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    };
    writeCache(payload.id, cached);
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
