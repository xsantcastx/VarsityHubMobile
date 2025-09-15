import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}
