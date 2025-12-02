import { prisma } from './prisma.js';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'EMAIL_VERIFIED'
  | 'ADMIN_USER_BAN'
  | 'ADMIN_USER_UNBAN'
  | 'ADMIN_AD_APPROVE'
  | 'ADMIN_AD_REJECT'
  | 'PAYMENT_CHECKOUT_CREATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'AD_CREATED'
  | 'AD_ACTIVATED'
  | 'SUSPICIOUS_ACTIVITY';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Log a security or admin action for audit trail
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        user_id: entry.userId || null,
        email: entry.email || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        metadata: entry.metadata || {},
        severity: entry.severity || 'info',
      },
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('[audit-log] Failed to create audit log:', error);
  }
}

/**
 * Extract IP address from Express request
 */
export function getClientIp(req: any): string {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection.remoteAddress ||
    'unknown'
  );
}

/**
 * Get recent failed login attempts for an email
 */
export async function getRecentFailedLogins(email: string, windowMinutes: number = 15): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: {
      action: 'LOGIN_FAILED',
      email: email.toLowerCase(),
      created_at: { gte: since },
    },
  });
  return count;
}

/**
 * Check for suspicious patterns (e.g., rapid requests from same IP)
 */
export async function checkSuspiciousActivity(ipAddress: string, windowMinutes: number = 5): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: {
      ip_address: ipAddress,
      created_at: { gte: since },
      action: { in: ['LOGIN_FAILED', 'REGISTER'] },
    },
  });
  
  // More than 10 failed attempts from same IP in 5 minutes = suspicious
  return count > 10;
}
