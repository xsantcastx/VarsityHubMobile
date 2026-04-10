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
  const payload = verifyJwt<{ id: string }>(token);
  if (payload?.id) {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, banned: true },
    });
    if (!user || user.banned) {
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
