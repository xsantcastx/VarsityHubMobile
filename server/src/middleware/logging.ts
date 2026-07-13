import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { debugLog } from '../lib/debugLog.js';

export interface RequestWithLogging extends Request {
  requestId?: string;
  startTime?: number;
}

/**
 * Middleware to add request ID and timing to every request.
 * Honors an incoming x-request-id header (e.g. from mobile client or Railway) so the
 * same ID flows through Railway logs and client-side error reports. Falls back to a
 * freshly-generated UUID when absent.
 */
export function requestLogging(req: RequestWithLogging, res: Response, next: NextFunction) {
  req.requestId = (req.headers['x-request-id'] as string | undefined) || randomUUID();
  req.startTime = Date.now();
  // Echo the ID back so clients can correlate their request with Railway logs.
  res.setHeader('x-request-id', req.requestId);

  debugLog(`[${req.requestId}] → ${req.method} ${req.path}`);

  // Log response when finished — warn on slow requests in all environments
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    debugLog(`[${req.requestId}] ← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    if (duration > 2000) {
      console.error(
        `[slow-request] ERROR ${req.method} ${req.path} took ${duration}ms (threshold: 2000ms)`
      );
    } else if (duration > 500) {
      console.warn(
        `[slow-request] WARN ${req.method} ${req.path} took ${duration}ms (threshold: 500ms)`
      );
    }
  });

  next();
}

/**
 * Middleware specifically for payment endpoints
 * Logs detailed payment context: price IDs, session IDs, user IDs, amounts
 */
export function paymentLogging(req: RequestWithLogging, res: Response, next: NextFunction) {
  const reqId = req.requestId || randomUUID();
  const method = req.method;
  const path = req.path;

  // Log incoming payment request with body details
  debugLog(`[${reqId}] 💳 Payment Request: ${method} ${path}`);

  if (req.body) {
    const { plan, team_count, promo_code } = req.body;
    if (plan) debugLog(`[${reqId}]   Plan: ${plan}`);
    if (team_count) debugLog(`[${reqId}]   Team Count: ${team_count}`);
    if (promo_code) debugLog(`[${reqId}]   Promo Code: ${promo_code}`);
  }

  // Intercept response to log Stripe session details
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (body && typeof body === 'object') {
      if (body.sessionId || body.session_id) {
        debugLog(`[${reqId}]   Stripe Session: ${body.sessionId || body.session_id}`);
      }
      if (body.url) {
        debugLog(`[${reqId}]   Checkout URL: ${body.url.substring(0, 50)}...`);
      }
      if (body.error) {
        debugLog(`[${reqId}]   ⚠️ Payment Error: ${body.error}`);
      }
    }
    return originalJson(body);
  };

  next();
}

/**
 * Error logging middleware for payments
 * Captures and logs detailed error context for payment failures
 */
export function paymentErrorLogging(
  err: any,
  req: RequestWithLogging,
  res: Response,
  next: NextFunction
) {
  const reqId = req.requestId || 'unknown';

  debugLog(`[${reqId}] ❌ Payment Error: ${err.message || err}`);

  if (err.statusCode) {
    debugLog(`[${reqId}]   Status Code: ${err.statusCode}`);
  }

  if (err.type) {
    debugLog(`[${reqId}]   Error Type: ${err.type}`);
  }

  if (err.raw) {
    debugLog(`[${reqId}]   Stripe Raw: ${JSON.stringify(err.raw).substring(0, 200)}`);
  }

  next(err);
}
