import type { Response } from 'express';

/**
 * Standardized error response format: { error: string, code?: string }
 * Provides consistency across all API endpoints
 *
 * @module lib/apiResponse
 */

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

/**
 * Send a standardized error response
 *
 * @param res Express Response object
 * @param status HTTP status code (400, 401, 403, 404, 500, etc.)
 * @param error Human-readable error message
 * @param code Optional error code for client-side handling (e.g., 'INVALID_CREDENTIALS', 'PROMO_EXPIRED')
 * @param details Optional additional details for debugging
 * @returns Response object for chaining
 *
 * @example
 * return apiError(res, 400, 'Invalid promo code', 'PROMO_INVALID');
 * return apiError(res, 429, 'Too many requests', 'RATE_LIMITED');
 */
export function apiError(
  res: Response,
  status: number,
  error: string,
  code?: string,
  details?: any
): Response {
  const response: ApiErrorResponse = { error };
  if (code) response.code = code;
  if (details) response.details = details;
  return res.status(status).json(response);
}

/**
 * Send a standardized success response (optional helper for consistency)
 *
 * @param res Express Response object
 * @param data Response data
 * @param status HTTP status code (default: 200)
 * @returns Response object
 *
 * @example
 * return apiSuccess(res, { id: '123', name: 'Test' });
 * return apiSuccess(res, { ok: true }, 201);
 */
export function apiSuccess(
  res: Response,
  data: any,
  status = 200
): Response {
  return res.status(status).json(data);
}
