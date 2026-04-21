import type { PrismaClient } from '@prisma/client';

async function cacheDelLazy(key: string): Promise<void> {
  const { cacheDel } = await import('./cache.js');
  await cacheDel(key);
}

export async function invalidateMeCacheForUser(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  await cacheDelLazy(`me:${userId}`);
}

export async function invalidateMeCacheForUsers(
  userIds: Array<string | null | undefined>,
): Promise<void> {
  await Promise.all(userIds.map((userId) => invalidateMeCacheForUser(userId)));
}

type UserUpdateArgs = Parameters<PrismaClient['user']['update']>[0];
type UserUpdateResult = Awaited<ReturnType<PrismaClient['user']['update']>>;
type UserUpdateClient = {
  user: {
    update: (args: UserUpdateArgs) => Promise<UserUpdateResult>;
  };
};

export async function updateUserAndInvalidate(
  client: UserUpdateClient,
  args: UserUpdateArgs,
): Promise<UserUpdateResult> {
  const updated = await client.user.update(args);
  const updatedId = (updated as { id?: string | null })?.id ?? null;
  const whereId =
    typeof (args as { where?: { id?: unknown } })?.where?.id === 'string'
      ? ((args as { where?: { id?: string } }).where?.id ?? null)
      : null;
  await invalidateMeCacheForUser(updatedId || whereId);
  return updated;
}
