import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { bindRequestContext } from '../lib/sentry.js';
import type { AuthedRequest } from './auth.js';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9:._-]{8,200}$/;

const normalizeHeaderValue = (value: string | string[] | undefined): string | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!REQUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
};

export function resolveIncomingRequestId(
  value: string | string[] | undefined,
  fallback: () => string = randomUUID
): string {
  return normalizeHeaderValue(value) ?? fallback();
}

export function requestContextMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const requestId =
    (req.id != null && String(req.id).trim().length > 0 ? String(req.id) : null) ??
    resolveIncomingRequestId(req.headers[REQUEST_ID_HEADER]);

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  if (req.log?.child) {
    req.log = req.log.child({ requestId });
  }

  bindRequestContext({
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.user?.id,
  });

  next();
}
