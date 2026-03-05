import { prisma } from './prisma.js';

/**
 * Returns IDs of private-profile users whose content should be hidden from the viewer.
 * Excludes the viewer themselves and users the viewer already follows.
 */
export async function getExcludedPrivateAuthorIds(viewerId: string | null): Promise<string[]> {
  const privateUsers = await prisma.user.findMany({
    where: {
      preferences: { path: ['profile_private'], equals: true },
    },
    select: { id: true },
  });

  if (privateUsers.length === 0) return [];

  const privateIds = privateUsers.map((u) => u.id);

  if (!viewerId) return privateIds;

  const followed = await prisma.follows.findMany({
    where: {
      follower_id: viewerId,
      following_id: { in: privateIds },
    },
    select: { following_id: true },
  });

  const allowedSet = new Set(followed.map((f) => f.following_id));
  allowedSet.add(viewerId); // Never exclude own posts

  return privateIds.filter((id) => !allowedSet.has(id));
}

/**
 * Check if a single user's private profile is hidden from the viewer.
 */
export async function isAuthorHiddenFromViewer(authorId: string, viewerId: string | null): Promise<boolean> {
  if (viewerId === authorId) return false;

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { preferences: true },
  });

  const prefs = (author?.preferences || {}) as any;
  if (prefs?.profile_private !== true) return false;

  if (!viewerId) return true;

  const rel = await prisma.follows.findUnique({
    where: { follower_id_following_id: { follower_id: viewerId, following_id: authorId } },
    select: { follower_id: true },
  });

  return !rel;
}
