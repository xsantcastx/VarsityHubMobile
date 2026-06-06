import { MembershipStatus } from '@prisma/client';
import { prisma } from './prisma.js';
import { getTeamState } from './teamState.js';

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
 * Returns IDs of private teams whose profile/listing should be hidden from the
 * viewer. Team members, team followers, and org admins are allowed through.
 */
export async function getExcludedPrivateTeamIds(viewerId: string | null): Promise<string[]> {
  const privateTeams = await prisma.team.findMany({
    where: { is_private: true, status: 'active' },
    select: { id: true, organization_id: true },
    take: 50000,
  });

  if (privateTeams.length === 0) return [];
  const privateTeamIds = privateTeams.map(team => team.id);

  if (!viewerId) return privateTeamIds;

  const organizationIds = [...new Set(privateTeams.map(team => team.organization_id).filter(Boolean))];
  const [follows, memberships, orgMemberships] = await Promise.all([
    prisma.teamFollow.findMany({
      where: { user_id: viewerId, team_id: { in: privateTeamIds } },
      select: { team_id: true },
      take: Math.min(privateTeamIds.length, 50000),
    }),
    prisma.teamMembership.findMany({
      where: { user_id: viewerId, team_id: { in: privateTeamIds }, status: MembershipStatus.active },
      select: { team_id: true },
      take: Math.min(privateTeamIds.length, 50000),
    }),
    organizationIds.length > 0
      ? prisma.organizationMembership.findMany({
          where: {
            user_id: viewerId,
            organization_id: { in: organizationIds.filter((id): id is string => typeof id === 'string' && id.length > 0) },
            role: { in: ['owner', 'manager'] },
            status: MembershipStatus.active,
          },
          select: { organization_id: true },
          take: Math.min(organizationIds.length, 50000),
        })
      : Promise.resolve([]),
  ]);

  const allowedTeamIds = new Set<string>([
    ...follows.map(row => row.team_id),
    ...memberships.map(row => row.team_id),
  ]);
  const allowedOrgIds = new Set(orgMemberships.map(row => row.organization_id));
  for (const team of privateTeams) {
    if (allowedOrgIds.has(team.organization_id)) {
      allowedTeamIds.add(team.id);
    }
  }

  return privateTeamIds.filter(teamId => !allowedTeamIds.has(teamId));
}

/**
 * Check if a single user's private profile is hidden from the viewer.
 */
/**
 * Optional per-request cache for `getBlockedUserIds` results, keyed by viewerId.
 * Pass an instance into each call for the same request so repeated lookups
 * (feed → posts → comments → upvote/bookmark/share filters) share one DB hit
 * instead of N. The values are the in-flight promise itself, so concurrent
 * callers in the same request also dedupe instead of racing.
 *
 * Use `getRequestBlockedCache(req)` below to grab/lazy-init the cache off
 * the Express request object — that gives you per-request lifetime with
 * automatic cleanup when the request ends.
 */
export type BlockedCache = Map<string, Promise<string[]>>;

// Short-lived cross-request cache for blocked-user lists. Block relationships
// change rarely (explicit user action), so a 30s TTL is safe and eliminates
// the repeated DB hit when the same user triggers multiple parallel feed slices.
const _blockedIdsCache = new Map<string, { promise: Promise<string[]>; expires: number }>();
const BLOCKED_IDS_CACHE_TTL = 30_000;

/** Invalidate a specific user's blocked-ids cache entry (call on block/unblock). */
export function invalidateBlockedIdsCache(viewerId: string): void {
  _blockedIdsCache.delete(viewerId);
}

/**
 * Returns IDs of users the viewer has blocked or been blocked by (bidirectional).
 * Used to filter posts and comments from blocked users out of feeds.
 *
 * Pass `cache` (from `getRequestBlockedCache(req)`) to share results across
 * sibling lookups in the same request. Without it, each call hits the DB.
 */
export async function getBlockedUserIds(
  viewerId: string | null,
  cache?: BlockedCache,
): Promise<string[]> {
  if (!viewerId) return [];

  // Per-request cache takes priority — already resolved for this request.
  if (cache) {
    const existing = cache.get(viewerId);
    if (existing) return existing;
  }

  // Cross-request cache: share the promise across concurrent requests for the
  // same user (e.g. two parallel feed slices hitting the bundle endpoint).
  const cached = _blockedIdsCache.get(viewerId);
  if (cached && Date.now() < cached.expires) {
    if (cache) cache.set(viewerId, cached.promise);
    return cached.promise;
  }

  // v1.0.2 pass 12: bound the scan. A single user's bidirectional block set is tiny in
  // practice; 10k is orders of magnitude beyond real use and keeps the query bounded.
  const promise = prisma.blockedUser
    .findMany({
      where: {
        OR: [
          { blocker_id: viewerId },
          { blocked_id: viewerId },
        ],
      },
      select: { blocker_id: true, blocked_id: true },
      take: 10000,
    })
    .then((blocks) => {
      const ids = new Set<string>();
      for (const b of blocks) {
        if (b.blocker_id !== viewerId) ids.add(b.blocker_id);
        if (b.blocked_id !== viewerId) ids.add(b.blocked_id);
      }
      return Array.from(ids);
    });

  _blockedIdsCache.set(viewerId, { promise, expires: Date.now() + BLOCKED_IDS_CACHE_TTL });
  if (cache) cache.set(viewerId, promise);
  return promise;
}

/**
 * Lazily attach a per-request blocked-user cache to the Express request and
 * return it. Each request gets its own Map; it's collected when the request
 * goes out of scope. No middleware needed at the app level — just call this
 * at the top of any handler that uses `getBlockedUserIds` more than once.
 */
export function getRequestBlockedCache(req: object): BlockedCache {
  // Mutate the request object to attach the cache. Express requests are
  // routinely augmented this way (e.g. req.user); using an explicit
  // namespaced key avoids collision with any other middleware.
  const slot = req as { _blockedCache?: BlockedCache };
  if (!slot._blockedCache) slot._blockedCache = new Map();
  return slot._blockedCache;
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

/**
 * Check if a single team's private profile is hidden from the viewer.
 * Team members, followers, and org admins can still see it.
 */
export async function isTeamHiddenFromViewer(teamId: string, viewerId: string | null): Promise<boolean> {
  const team = await getTeamState(teamId, prisma);
  if (!team || team.status !== 'active') return true;
  if (!team.is_private) return false;
  if (!viewerId) return true;

  const [follow, membership, orgMembership] = await Promise.all([
    prisma.teamFollow.findFirst({
      where: { user_id: viewerId, team_id: teamId },
      select: { team_id: true },
    }),
    prisma.teamMembership.findFirst({
      where: { user_id: viewerId, team_id: teamId, status: MembershipStatus.active },
      select: { team_id: true },
    }),
    team.organization_id
      ? prisma.organizationMembership.findFirst({
          where: {
            user_id: viewerId,
            organization_id: team.organization_id,
            role: { in: ['owner', 'manager'] },
            status: MembershipStatus.active,
          },
          select: { organization_id: true },
        })
      : Promise.resolve(null),
  ]);

  return !follow && !membership && !orgMembership;
}
