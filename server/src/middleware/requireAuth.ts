
import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './auth.js';
import { requireNotBanned } from './requireNotBanned.js';

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  await requireNotBanned(req, res, next);
}
