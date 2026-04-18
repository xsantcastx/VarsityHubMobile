import { prisma } from './prisma.js';
import { invalidateMeCacheForUser } from './userCache.js';

type OAuthVerifiableUser = {
  id: string;
  email_verified?: boolean | null;
  google_id?: string | null;
  apple_id?: string | null;
};

export function isOAuthLinkedUser(user: OAuthVerifiableUser | null | undefined): boolean {
  return Boolean(user?.google_id || user?.apple_id);
}

export async function ensureOAuthUserVerified<T extends OAuthVerifiableUser | null | undefined>(
  user: T
): Promise<T> {
  if (!user || user.email_verified === true || !isOAuthLinkedUser(user)) {
    return user;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email_verified: true,
      email_verification_code: null,
      email_verification_expires: null,
    },
  });
  await invalidateMeCacheForUser(updated.id);
  return updated as unknown as T;
}
