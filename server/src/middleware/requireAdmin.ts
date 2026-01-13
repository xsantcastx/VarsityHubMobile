import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from './auth.js';
import { ApiError } from '../lib/apiResponse.js';

/**
 * SECURITY: Check if email is in the admin list (fallback/bootstrap only).
 * Primary admin check should use the database is_admin flag in preferences.
 */
export function isEmailAdmin(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS || '';
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * SECURITY: Check if user has admin privileges.
 * Uses BOTH database flag (preferences.is_admin) AND email allowlist for defense-in-depth.
 * User must have is_admin: true in preferences OR be in ADMIN_EMAILS env var.
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, preferences: true }
  });
  if (!user) return false;

  // Check database flag first (preferred method)
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  if (prefs.is_admin === true) return true;

  // Fallback to email allowlist (for bootstrap/migration)
  return isEmailAdmin(user.email);
}

/**
 * SECURITY: Middleware that requires admin privileges.
 * Returns 401 for unauthenticated requests, 403 for non-admin users.
 */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return ApiError.unauthorized(res);

  const isAdmin = await checkIsAdmin(req.user.id);
  if (!isAdmin) {
    console.warn(`[security] Non-admin user ${req.user.id} attempted admin action: ${req.method} ${req.path}`);
    return ApiError.adminOnly(res);
  }

  return next();
}

/**
 * SECURITY: Helper to check if current request user is admin.
 * Use this for conditional logic, not for authorization (use requireAdmin middleware instead).
 */
export async function getIsAdmin(req: AuthedRequest): Promise<boolean> {
  if (!req.user) return false;
  return checkIsAdmin(req.user.id);
}
