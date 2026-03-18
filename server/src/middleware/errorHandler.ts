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
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle AppError instances
  if (err instanceof AppError) {
    const logDetails = err.getLogDetails();
    
    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      console.error('[AppError]', logDetails);
      // Capture server errors in Sentry
      captureException(err, {
        context: 'app_error',
        extra: logDetails,
        tags: {
          errorCode: err.errorCode,
          statusCode: String(err.statusCode),
        },
      });
    } else if (err.statusCode >= 400) {
      // Log client errors at warn level (not errors)
      console.warn('[AppError]', logDetails);
    }

    // Send error response
    res.status(err.statusCode).json(err.toJSON());
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
    
    console.warn('[ValidationError]', validationError.getLogDetails());
    res.status(400).json(validationError.toJSON());
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    
    // Unique constraint violation (do not leak schema/column names to client)
    if (prismaError.code === 'P2002') {
      console.warn('[ConflictError] P2002', { target: prismaError.meta?.target, path: req.path });
      const conflictError = new ConflictError('Resource already exists');
      res.status(409).json(conflictError.toJSON());
      return;
    }
    
    // Record not found
    if (prismaError.code === 'P2025') {
      const notFoundError = new NotFoundError('Resource not found');
      console.warn('[NotFoundError]', notFoundError.getLogDetails());
      res.status(404).json(notFoundError.toJSON());
      return;
    }
    
    // Foreign key constraint violation (do not leak schema/field names to client)
    if (prismaError.code === 'P2003') {
      console.warn('[ValidationError] P2003', { field: prismaError.meta?.field_name, path: req.path });
      const validationError = new ValidationError('Invalid reference');
      res.status(400).json(validationError.toJSON());
      return;
    }
  }

  // Handle unknown errors (500)
  console.error('[Unknown Error]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Capture in Sentry
  captureException(err, {
    context: 'unknown_error',
    extra: {
      path: req.path,
      method: req.method,
      body: req.body ? Object.fromEntries(
        Object.entries(req.body).map(([k, v]) =>
          /password|secret|token|code/i.test(k) ? [k, '[REDACTED]'] : [k, v]
        )
      ) : undefined,
      query: req.query,
      params: req.params,
    },
  });

  // Send generic error response (don't leak internal details)
  res.status(500).json({
    error: 'Internal server error',
    errorCode: 'INTERNAL_SERVER_ERROR',
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
