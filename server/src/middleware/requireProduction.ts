import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './auth.js';

/**
 * Centralized guard for production-only behavior. Use this instead of
 * scattered NODE_ENV checks across routes. This prevents accidental dev
 * paths leaking into production and makes it easy to audit enforcement.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Middleware: Reject requests in production if a required config is missing.
 * Catches configuration drift before it causes security issues.
 *
 * Usage: router.get('/foo', requireConfigured('STRIPE_SECRET_KEY'), handler)
 */
export function requireConfigured(...envVars: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!isProduction()) return next();
    
    const missing = envVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error('[env-guard] Production missing required config:', missing.join(', '));
      return res.status(503).json({ error: 'Service unavailable' });
    }
    return next();
  };
}

/**
 * Type-safe environment variable getter with production enforcement.
 * Falls back to a default in dev, but always returns a value (never null).
 *
 * Usage:
 *   const key = getConfigOrDefault('STRIPE_SECRET_KEY', 'dev-key-12345');
 *   // → prod: throws if STRIPE_SECRET_KEY is missing
 *   // → dev: 'dev-key-12345' if missing
 */
export function getConfigOrDefault(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (value) return value;
  
  if (isProduction()) {
    throw new Error(`[env-guard] Production missing required config: ${key}`);
  }
  
  return defaultValue;
}

/**
 * Development-only console logging. Prevents sensitive debug output in prod.
 *
 * Usage:
 *   if (devOnly()) {
 *     console.log('[context]', { sensitive: data });
 *   }
 */
export function devOnly(): boolean {
  return !isProduction();
}
