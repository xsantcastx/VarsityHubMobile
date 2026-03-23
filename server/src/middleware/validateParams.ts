/**
 * Express param handler to validate that URL parameter IDs are valid CUID/UUID format.
 * Prisma CUIDs are 25-char alphanumeric strings starting with 'c'.
 * UUIDs are 36-char hyphenated hex strings.
 *
 * Usage: router.param('id', validateIdParam);
 *        router.param('userId', validateIdParam);
 */
import type { Request, Response, NextFunction } from 'express';

// Match Prisma CUID (c + 24-25 alphanumeric) or UUID v4
const VALID_ID_PATTERN = /^(c[a-z0-9]{24,25}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Express param callback — validates a single named param.
 * Attach to each router with: router.param('id', validateIdParam)
 */
export function validateIdParam(req: Request, res: Response, next: NextFunction, value: string) {
  if (!VALID_ID_PATTERN.test(value)) {
    return res.status(400).json({
      error: 'Invalid ID format',
      message: 'The provided ID is not a valid identifier.',
    });
  }
  next();
}

/**
 * Registers ID validation on all common param names for a router.
 */
export function registerIdValidation(router: import('express').Router) {
  // Note: sessionId excluded — Stripe session IDs (cs_test_...) are not CUID/UUID format
  const paramNames = ['id', 'userId', 'teamId', 'orgId', 'inviteId', 'postId', 'gameId', 'eventId', 'adId', 'membershipId', 'mediaId', 'commentId', 'reportId'];
  for (const name of paramNames) {
    router.param(name, validateIdParam);
  }
}
