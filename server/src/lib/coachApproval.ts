import { prisma } from './prisma.js';
import { createInAppNotification, sendPushNotification } from './notifications.js';
import { invalidateAuthCache } from '../middleware/auth.js';

type CoachApprovalDb = Pick<typeof prisma, 'user'>;

function getPreferenceObject(preferences: unknown): Record<string, any> {
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? ({ ...(preferences as Record<string, any>) } as Record<string, any>)
    : {};
}

export async function markCoachApprovalPending(
  userId: string,
  updates: { organization_id?: string; organization_name?: string },
  db: CoachApprovalDb = prisma
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = getPreferenceObject(user?.preferences);
  if (prefs.role !== 'coach') return;

  await db.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        ...updates,
        approval_status: 'PENDING',
        approval_reason: null,
        approval_reviewed_at: null,
      },
    },
  });
  invalidateAuthCache(userId);
}

async function getOrganizationContext(organizationId: string, organizationName?: string) {
  if (organizationName) {
    return { organizationId, organizationName };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    const error: any = new Error('Organization not found');
    error.status = 404;
    error.payload = { error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found' };
    throw error;
  }

  return { organizationId: org.id, organizationName: org.name };
}

export async function approveCoachForOrganization(input: {
  userId: string;
  organizationId: string;
  actorId?: string;
  organizationName?: string;
  forceCoachRole?: boolean;
}) {
  const { userId, actorId, forceCoachRole = false } = input;
  const { organizationId, organizationName } = await getOrganizationContext(
    input.organizationId,
    input.organizationName
  );

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      banned: true,
      preferences: true,
    },
  });
  if (!user) {
    const error: any = new Error('User not found');
    error.status = 404;
    error.payload = { error: 'USER_NOT_FOUND', message: 'User not found' };
    throw error;
  }

  const prefs = getPreferenceObject(user.preferences);
  const currentRole = typeof prefs.role === 'string' ? prefs.role : 'fan';
  if (!forceCoachRole && currentRole !== 'coach') {
    return user;
  }

  await prisma.$transaction(async tx => {
    const pendingJoinRequest = await tx.organizationJoinRequest.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: userId,
        } as any,
      },
    });

    if (pendingJoinRequest?.status === 'pending') {
      await tx.organizationJoinRequest.update({
        where: { id: pendingJoinRequest.id },
        data: {
          status: 'approved',
          reviewed_at: new Date(),
          reviewed_by: actorId ?? null,
        },
      });
    }

    await tx.organizationMembership.upsert({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: userId,
        } as any,
      },
      update: {
        status: 'active',
      },
      create: {
        organization_id: organizationId,
        user_id: userId,
        role: 'member',
        status: 'active',
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...prefs,
          role: forceCoachRole ? 'coach' : currentRole,
          organization_id: organizationId,
          organization_name: organizationName,
          approval_status: 'APPROVED',
          approval_reason: null,
          approval_reviewed_at: new Date().toISOString(),
        },
      },
    });
  });

  invalidateAuthCache(userId);

  if (actorId) {
    await createInAppNotification({
      userId,
      actorId,
      type: 'COACH_APPROVED',
      meta: {
        organization_id: organizationId,
        organization_name: organizationName,
      },
    }).catch(() => {});

    await sendPushNotification(
      userId,
      'Coach account approved',
      organizationName
        ? `Your coach access for ${organizationName} is now active.`
        : 'Your coach access is now active.',
      {
        type: 'coach_approved',
        organization_id: organizationId,
        organization_name: organizationName,
        screen: 'organization',
      }
    ).catch(() => {});
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      banned: true,
      preferences: true,
    },
  });
}

export async function rejectCoachForOrganization(input: {
  userId: string;
  reason?: string;
  organizationId?: string | null;
  actorId?: string;
  organizationName?: string | null;
}) {
  const { userId, reason, actorId } = input;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      banned: true,
      preferences: true,
    },
  });
  if (!user) {
    const error: any = new Error('User not found');
    error.status = 404;
    error.payload = { error: 'USER_NOT_FOUND', message: 'User not found' };
    throw error;
  }

  const prefs = getPreferenceObject(user.preferences);
  const currentRole = typeof prefs.role === 'string' ? prefs.role : 'fan';
  if (currentRole !== 'coach') {
    return user;
  }

  let organizationId =
    typeof input.organizationId === 'string' && input.organizationId.trim()
      ? input.organizationId.trim()
      : typeof prefs.organization_id === 'string' && prefs.organization_id.trim()
        ? prefs.organization_id.trim()
        : null;
  let organizationName =
    typeof input.organizationName === 'string' && input.organizationName.trim()
      ? input.organizationName.trim()
      : typeof prefs.organization_name === 'string'
        ? prefs.organization_name
        : null;

  if (organizationId && !organizationName) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    organizationName = org?.name ?? null;
  }

  await prisma.$transaction(async tx => {
    if (organizationId) {
      const pendingJoinRequest = await tx.organizationJoinRequest.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: organizationId,
            user_id: userId,
          } as any,
        },
      });

      if (pendingJoinRequest?.status === 'pending') {
        await tx.organizationJoinRequest.update({
          where: { id: pendingJoinRequest.id },
          data: {
            status:
              pendingJoinRequest.status === 'pending' ? 'rejected' : pendingJoinRequest.status,
            reviewed_at: new Date(),
            reviewed_by: actorId ?? null,
            message: reason || pendingJoinRequest.message,
          },
        });
      }

      await tx.organizationMembership.updateMany({
        where: {
          organization_id: organizationId,
          user_id: userId,
          NOT: { status: 'archived' },
        },
        data: {
          status: 'archived',
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...prefs,
          organization_id: organizationId,
          organization_name: organizationName,
          approval_status: 'REJECTED',
          approval_reason: reason || null,
          approval_reviewed_at: new Date().toISOString(),
        },
      },
    });
  });

  invalidateAuthCache(userId);

  if (actorId) {
    await createInAppNotification({
      userId,
      actorId,
      type: 'COACH_REJECTED',
      meta: {
        organization_id: organizationId,
        organization_name: organizationName,
        reason: reason || null,
      },
    }).catch(() => {});

    await sendPushNotification(
      userId,
      'Coach application update',
      reason || 'Your coach application was not approved.',
      {
        type: 'coach_rejected',
        organization_id: organizationId,
        organization_name: organizationName,
        reason: reason || null,
        screen: 'profile',
      }
    ).catch(() => {});
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      banned: true,
      preferences: true,
    },
  });
}
