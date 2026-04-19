import { prisma } from './prisma.js';

// Cache private user IDs for 60s to avoid querying all users on every feed request
let _privateIdsCache: { ids: string[]; expires: number } | null = null;
const PRIVATE_IDS_CACHE_TTL = 60_000;

/** Invalidate the private-IDs cache (call when a user toggles profile_private). */
export function invalidatePrivateIdsCache(): void {
  _privateIdsCache = null;
}

/**
 * Returns IDs of private-profile users whose content should be hidden from the viewer.
 * Excludes the viewer themselves and users the viewer already follows.
 */
export async function getExcludedPrivateAuthorIds(viewerId: string | null): Promise<string[]> {
  let privateUsers: { id: string }[];
  if (_privateIdsCache && Date.now() < _privateIdsCache.expires) {
    privateUsers = _privateIdsCache.ids.map(id => ({ id }));
  } else {
    // v1.0.2 pass 12: bound the scan. 50k private-profile users is ~10x today's peak and
    // the result is cached for 60s, so cold-start cost stays constant regardless of growth.
    privateUsers = await prisma.user.findMany({
      where: {
        preferences: { path: ['profile_private'], equals: true },
      },
      select: { id: true },
      take: 50000,
    });
    _privateIdsCache = { ids: privateUsers.map(u => u.id), expires: Date.now() + PRIVATE_IDS_CACHE_TTL };
  }

  if (privateUsers.length === 0) return [];

  const privateIds = privateUsers.map((u) => u.id);

  if (!viewerId) return privateIds;

  const followed = await prisma.follows.findMany({
    where: {
      follower_id: viewerId,
      following_id: { in: privateIds },
      status: 'accepted',
    },
    select: { following_id: true },
    take: Math.min(privateIds.length, 50000),
  });

  const allowedSet = new Set(followed.map((f) => f.following_id));
  allowedSet.add(viewerId); // Never exclude own posts

  return privateIds.filter((id) => !allowedSet.has(id));
}

/**
 * Check if a single user's private profile is hidden from the viewer.
 */
/**
 * Returns IDs of users the viewer has blocked or been blocked by (bidirectional).
 * Used to filter posts and comments from blocked users out of feeds.
 */
export async function getBlockedUserIds(viewerId: string | null): Promise<string[]> {
  if (!viewerId) return [];

  // v1.0.2 pass 12: bound the scan. A single user's bidirectional block set is tiny in
  // practice; 10k is orders of magnitude beyond real use and keeps the query bounded.
  const blocks = await prisma.blockedUser.findMany({
    where: {
      OR: [
        { blocker_id: viewerId },
        { blocked_id: viewerId },
      ],
    },
    select: { blocker_id: true, blocked_id: true },
    take: 10000,
  });

  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.blocker_id !== viewerId) ids.add(b.blocker_id);
    if (b.blocked_id !== viewerId) ids.add(b.blocked_id);
  }
  return Array.from(ids);
}

export async function isAuthorHiddenFromViewer(authorId: string, viewerId: string | null): Promise<boolean> {
  if (viewerId === authorId) return false;

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { preferences: true },
  });

  const prefs = (author?.preferences || {}) as any;
  if (prefs?.profile_private !== true) return false;

  if (!viewerId) return true;

  const rel = await prisma.follows.findFirst({
    where: {
      follower_id: viewerId,
      following_id: authorId,
      status: 'accepted',
    },
    select: { follower_id: true },
  });

  return !rel;
}
