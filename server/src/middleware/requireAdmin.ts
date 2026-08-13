import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { isAdminEmail } from '../lib/adminEmails.js';
import { logSecurityEvent } from '../lib/securityEvents.js';
import type { AuthedRequest } from './auth.js';

export function isEmailAdmin(email?: string | null): boolean {
  return isAdminEmail(email);
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    logSecurityEvent({
      type: 'authz.admin_denied',
      severity: 'warning',
      ip: req.ip ?? null,
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId ?? null,
      metadata: { reason: 'unauthenticated' },
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true, email_verified: true },
  });
  if (!me?.email_verified) {
    // An unverified account reaching an admin route is either a misconfigured
    // admin or someone probing the allowlist — worth its own event type.
    logSecurityEvent({
      type: 'authz.unverified_admin_attempt',
      severity: 'critical',
      userId: req.user.id,
      email: me?.email ?? null,
      ip: req.ip ?? null,
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId ?? null,
    });
    return res.status(403).json({ error: 'Email verification required' });
  }
  if (!isAdminEmail(me?.email)) {
    // A verified, authenticated non-admin deliberately hitting an admin route.
    // This is the highest-signal event in the whole stream: it is never a
    // legitimate client action, since the app never routes non-admins here.
    logSecurityEvent({
      type: 'authz.admin_denied',
      severity: 'critical',
      userId: req.user.id,
      email: me?.email ?? null,
      ip: req.ip ?? null,
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId ?? null,
      metadata: { reason: 'not_allowlisted' },
    });
    return res.status(403).json({ error: 'Admin only' });
  }
  return next();
}

export async function getIsAdmin(req: AuthedRequest): Promise<boolean> {
  if (!req.user) return false;
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true, email_verified: true },
  });
  return !!me?.email_verified && isAdminEmail(me?.email);
}

/**
 * userId-based variant of getIsAdmin() for call sites that don't hold a req.
 * Admin privilege ALWAYS requires a verified email — the bare isEmailAdmin()
 * string check must never gate access on its own (2026-07-13 audit).
 */
export async function isVerifiedAdminUser(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, email_verified: true },
  });
  return !!me?.email_verified && isAdminEmail(me?.email);
}
