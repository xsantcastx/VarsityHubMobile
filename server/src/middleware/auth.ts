import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { setUserContext, clearUserContext } from '../lib/sentry.js';

export interface AuthedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

export async function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    // Clear Sentry user context if no auth token
    clearUserContext();
    return next();
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyJwt<{ id: string; iat?: number }>(token);
  if (payload?.id) {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { password_changed_at: true, banned: true, banned_until: true, ban_reason: true },
      });
    } catch (dbErr) {
      // DB error — let request continue unauthenticated rather than crash every request
      console.error('[auth] Database error during auth check:', (dbErr as any)?.message || dbErr);
      clearUserContext();
      return next();
    }

    // Reject deleted users silently
    if (!user) {
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

    req.user = { id: payload.id };
    // Set Sentry user context for better error tracking
    setUserContext(payload.id);
  } else {
    clearUserContext();
  }
  next();
}

