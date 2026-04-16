import type { Response } from 'express';

export interface SendErrorOptions {
  code?: string;
  details?: unknown;
  message?: string;
}

type ErrorEnvelope = {
  error: string;
  code?: string;
  details?: unknown;
  message?: string;
  errorCode?: string;
  metadata?: unknown;
};

export function buildErrorEnvelope(error: string, options: SendErrorOptions = {}): ErrorEnvelope {
  const { code, details, message } = options;

  return {
    error,
    ...(code ? { code, errorCode: code } : {}),
    ...(details !== undefined ? { details, metadata: details } : {}),
    ...(message ? { message } : {}),
  };
}

export function sendError(
  res: Response,
  status: number,
  error: string,
  options: SendErrorOptions = {}
) {
  return res.status(status).json(buildErrorEnvelope(error, options));
}
