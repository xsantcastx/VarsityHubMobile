import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { ApiError } from '../lib/apiResponse.js';

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return ApiError.unauthorized(res);
  }
  return next();
}
