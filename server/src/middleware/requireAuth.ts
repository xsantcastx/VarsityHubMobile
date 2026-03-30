import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // Immediately reject banned users — don't wait for JWT expiry
  if ((req.user as any).banned) {
    return res.status(403).json({ error: 'Account suspended', message: 'Your account has been suspended.' });
  }
  return next();
}
