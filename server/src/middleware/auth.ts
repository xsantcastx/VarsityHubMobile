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
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { password_changed_at: true, banned: true },
    });

    // Reject deleted or banned users
    if (!user || user.banned) {
      clearUserContext();
      return next();
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

