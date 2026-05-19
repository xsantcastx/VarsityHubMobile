import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { assertCanSelfDeleteUser, softDeleteUserAccount } from './accountDeletion.js';
import { getAccountDeletionConfirmationRequirements } from './accountDeletionConfirmation.js';
import { invalidateMeCacheForUser } from './userCache.js';

export const accountDeletionPayloadSchema = z.object({
  password: z.string().optional(),
  delete_confirmation: z.string().optional(),
});

export type AccountDeletionPayload = z.infer<typeof accountDeletionPayloadSchema>;

type AccountDeletionResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Canonical self-serve deletion flow shared by both `/auth/account/delete`
 * and the legacy `/users/me` route alias.
 */
export async function processSelfAccountDeletion(
  userId: string,
  payload: AccountDeletionPayload
): Promise<AccountDeletionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password_hash: true,
      google_id: true,
      apple_id: true,
      deleted_at: true,
      deletion_anonymized: true,
    },
  });
  if (!user) return { status: 404, body: { error: 'Not found' } };

  if (user.deleted_at || user.deletion_anonymized) {
    return {
      status: 200,
      body: {
        ok: true,
        already_deleted: true,
        deleted_at: user.deleted_at?.toISOString(),
      },
    };
  }

  const confirmationCheck = getAccountDeletionConfirmationRequirements(user, payload);
  if (!confirmationCheck.ok) {
    return {
      status: confirmationCheck.status,
      body: confirmationCheck.body,
    };
  }

  if (confirmationCheck.requiresPassword) {
    const suppliedPassword = String(payload.password || '');
    const ok = await bcrypt.compare(suppliedPassword, String(user.password_hash || ''));
    if (!ok) {
      return {
        status: 401,
        body: {
          error: 'INVALID_PASSWORD',
          message: 'Password does not match.',
        },
      };
    }
  }

  try {
    await assertCanSelfDeleteUser(userId);
  } catch (err) {
    if ((err as any)?.code === 'SOLE_ORG_OWNER') {
      return {
        status: 400,
        body: {
          error: 'You are the sole owner of an organization. Transfer ownership before deleting your account.',
          code: 'SOLE_ORG_OWNER',
          organization_id: (err as any).organization_id,
        },
      };
    }
    throw err;
  }

  const result = await softDeleteUserAccount(userId);
  await invalidateMeCacheForUser(userId).catch(() => {});

  return {
    status: 200,
    body: {
      ok: true,
      deleted_at: result.deletedAt.toISOString(),
      ...(result.alreadyDeleted ? { already_deleted: true } : {}),
    },
  };
}
