import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { setUserContext, clearUserContext } from '../lib/sentry.js';

export interface AuthedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

// Routes that never need auth — skip DB lookup entirely
const PUBLIC_PREFIXES = ['/health', '/.well-known', '/privacy-policy', '/terms', '/support'];

export async function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    // Clear Sentry user context if no auth token
    clearUserContext();
    return next();
  }

  // Skip DB lookup for public endpoints — even if a token is present
  if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) {
    clearUserContext();
    return next();
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyJwt<{ id: string; iat?: number; se?: number }>(token);
  if (!payload) {
    // AUTH-6: Log invalid/expired token attempts for security monitoring
    console.warn('[auth] Invalid or expired token presented', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      tokenLength: token.length,
    });
    clearUserContext();
    return next();
  }

  if (payload?.id) {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          password_changed_at: true,
          session_epoch: true,
          banned: true,
          banned_until: true,
          ban_reason: true,
          deleted_at: true,
          deletion_anonymized: true,
        },
      });
    } catch (dbErr) {
      // DB error — return 503 instead of silently degrading to anonymous access
      console.error('[auth] Database error during auth check:', (dbErr as any)?.message || dbErr);
      clearUserContext();
      return _res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    }

    // Deleted accounts should behave like anonymous traffic. Check this before
    // the ban path so stale tokens from self-deleted accounts don't leak an
    // "account banned" response.
    if (!user || (user as any).deleted_at || (user as any).deletion_anonymized) {
      clearUserContext();
      return next();
    }
    // Banned or suspended users get explicit 403 with reason
    if (user.banned) {
      clearUserContext();
      return _res.status(403).json({ error: 'Your account has been banned.', code: 'ACCOUNT_BANNED', ban_reason: (user as any).ban_reason || undefined });
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      clearUserContext();
      return _res.status(403).json({ error: 'Your account is temporarily suspended.', code: 'ACCOUNT_SUSPENDED', banned_until: user.banned_until });
    }

    // Reject tokens issued before the last password change
    if (payload.iat && user.password_changed_at && payload.iat < Math.floor(user.password_changed_at.getTime() / 1000)) {
      clearUserContext();
      return next();
    }

    // Enforce single-session: reject tokens whose `se` doesn't match the user's
    // current epoch. A new login (login/oauth/password-reset) bumps the epoch,
    // which immediately invalidates every other access token the user holds.
    // Tokens minted before this rollout don't have `se`; treat those as legacy
    // and let them expire on their own 15-minute TTL.
    if (typeof payload.se === 'number' && payload.se !== (user as any).session_epoch) {
      clearUserContext();
      return next();
    }

    req.user = { id: payload.id };
    // Set Sentry user context for better error tracking
    setUserContext(payload.id);
  } else {
    clearUserContext();
  }
  next();
}
