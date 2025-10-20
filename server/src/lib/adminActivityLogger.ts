import { prisma } from './prisma.js';

/**
 * Log an admin activity to the audit trail
 * @param admin_id - ID of the admin user
 * @param admin_email - Email of the admin user
 * @param action - Action performed (e.g., "Ban User", "Delete Team")
 * @param target_type - Type of resource affected (e.g., "user", "team", "ad")
 * @param target_id - ID of the affected resource
 * @param description - Human-readable description
 * @param metadata - Optional additional context
 */
export async function logAdminActivity(
  admin_id: string,
  admin_email: string,
  action: string,
  target_type: string,
  target_id: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: {
        admin_id,
        admin_email,
        action,
        target_type,
        target_id,
        description,
        metadata: metadata || null
      }
    });
  } catch (error) {
    // Don't throw - logging failures shouldn't break admin operations
    console.error('[AdminActivityLog] Failed to log activity:', error);
  }
}

/**
 * Log admin activity from an authenticated request
 * Convenience wrapper that extracts admin info from request
 */
export async function logAdminActivityFromReq(
  req: any,
  action: string,
  target_type: string,
  target_id: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!req.user?.id) {
    console.error('[AdminActivityLog] No user ID in request');
    return;
  }

  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true }
    });

    if (!admin) {
      console.error('[AdminActivityLog] Admin user not found');
      return;
    }

    await logAdminActivity(
      admin.id,
      admin.email || 'unknown',
      action,
      target_type,
      target_id,
      description,
      metadata
    );
  } catch (error) {
    console.error('[AdminActivityLog] Failed to log activity from request:', error);
  }
}
