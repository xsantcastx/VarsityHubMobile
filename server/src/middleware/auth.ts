import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt.js';

export interface AuthedRequest extends Request {
  user?: { id: string };
}

export function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyJwt<{ id: string }>(token);
  if (payload?.id) {
    req.user = { id: payload.id };
  }
  next();
}

