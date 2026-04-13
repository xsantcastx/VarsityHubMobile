/**
 * Centralized Error Handling Middleware
 * 
 * Catches all errors and formats consistent responses.
 * Should be added as the last middleware in Express app.
 */

import type { NextFunction, Request, Response } from 'express';
import { captureException } from '../lib/sentry.js';
import { AppError } from '../lib/errors/AppError.js';
import { ValidationError } from '../lib/errors/ValidationError.js';
import { AuthenticationError } from '../lib/errors/AuthenticationError.js';
import { AuthorizationError } from '../lib/errors/AuthorizationError.js';
import { NotFoundError } from '../lib/errors/NotFoundError.js';
import { ConflictError } from '../lib/errors/ConflictError.js';
import { RateLimitError } from '../lib/errors/RateLimitError.js';

type RequestWithContext = Request & {
  id?: string;
  requestId?: string;
  user?: { id: string };
  log?: {
    error?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
  };
};

const getRequestIdString = (req: RequestWithContext) =>
  req.id != null ? String(req.id) : req.requestId || 'unknown';

const redactBody = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([key, value]) =>
      /password|secret|token|code/i.test(key) ? [key, '[REDACTED]'] : [key, value]
    )
  );
};

/**
 * Error handling middleware
 * 
 * Handles:
 * - AppError instances (operational errors)
 * - Zod validation errors
 * - Prisma errors
 * - Unknown errors (500)
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const request = req as RequestWithContext;
  const requestId = getRequestIdString(request);
  const route = request.originalUrl || request.path;
  const logContext = {
    requestId,
    method: request.method,
    route,
    userId: request.user?.id,
  };

  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle AppError instances
  if (err instanceof AppError) {
    const logDetails = err.getLogDetails();
    
    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      request.log?.error?.({ err, ...logContext, details: logDetails }, 'Operational server error');
      // Capture server errors in Sentry
      captureException(err, {
        context: 'app_error',
        extra: logDetails,
        tags: {
          errorCode: err.errorCode,
          statusCode: String(err.statusCode),
          request_id: requestId,
        },
        user: request.user ? { id: request.user.id } : undefined,
      });
    } else if (err.statusCode >= 400) {
      // Log client errors at warn level (not errors)
      request.log?.warn?.({ ...logContext, details: logDetails }, 'Operational client error');
    }

    // Send error response
    res.status(err.statusCode).json({ ...err.toJSON(), requestId });
    return;
  }

  // Handle Zod validation errors (from safeParse)
  if (err.name === 'ZodError' && 'issues' in err) {
    const zodError = err as any;
    const validationError = new ValidationError('Invalid input', {
      validationIssues: zodError.issues.map((issue: any) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
    
    request.log?.warn?.(
      { ...logContext, details: validationError.getLogDetails() },
      'Validation error'
    );
    res.status(400).json({ ...validationError.toJSON(), requestId });
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    
    // Unique constraint violation (do not leak schema/column names to client)
    if (prismaError.code === 'P2002') {
      request.log?.warn?.(
        { ...logContext, target: prismaError.meta?.target },
        'Prisma unique constraint violation'
      );
      const conflictError = new ConflictError('Resource already exists');
      res.status(409).json({ ...conflictError.toJSON(), requestId });
      return;
    }
    
    // Record not found
    if (prismaError.code === 'P2025') {
      const notFoundError = new NotFoundError('Resource not found');
      request.log?.warn?.(
        { ...logContext, details: notFoundError.getLogDetails() },
        'Prisma record not found'
      );
      res.status(404).json({ ...notFoundError.toJSON(), requestId });
      return;
    }
    
    // Foreign key constraint violation (do not leak schema/field names to client)
    if (prismaError.code === 'P2003') {
      request.log?.warn?.(
        { ...logContext, field: prismaError.meta?.field_name },
        'Prisma foreign key constraint violation'
      );
      const validationError = new ValidationError('Invalid reference');
      res.status(400).json({ ...validationError.toJSON(), requestId });
      return;
    }
  }

  // Handle unknown errors (500)
  request.log?.error?.(
    {
      err,
      ...logContext,
      query: request.query,
      params: request.params,
      body: redactBody(request.body),
    },
    'Unhandled request error'
  );

  // Capture in Sentry
  captureException(err, {
    context: 'unknown_error',
    extra: {
      path: route,
      method: request.method,
      body: redactBody(request.body),
      query: request.query,
      params: request.params,
    },
    tags: {
      request_id: requestId,
      route,
    },
    user: request.user ? { id: request.user.id } : undefined,
  });

  // Send generic error response (don't leak internal details)
  res.status(500).json({
    error: 'Internal server error',
    errorCode: 'INTERNAL_SERVER_ERROR',
    requestId,
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack,
    }),
  });
}

/**
 * Async error wrapper
 * 
 * Wraps async route handlers to catch errors and pass to error handler.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
