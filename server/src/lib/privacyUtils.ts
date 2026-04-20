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
      where: { user_id: viewerId, team_id: { in: privateTeamIds }, status: 'active' },
      select: { team_id: true },
      take: Math.min(privateTeamIds.length, 50000),
    }),
    organizationIds.length > 0
      ? prisma.organizationMembership.findMany({
          where: {
            user_id: viewerId,
            organization_id: { in: organizationIds },
            role: { in: ['owner', 'manager'] },
            status: 'active',
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

/**
 * Check if a single team's private profile is hidden from the viewer.
 * Team members, followers, and org admins can still see it.
 */
export async function isTeamHiddenFromViewer(teamId: string, viewerId: string | null): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { is_private: true, status: true, organization_id: true },
  });
  if (!team || team.status !== 'active') return true;
  if (!team.is_private) return false;
  if (!viewerId) return true;

  const [follow, membership, orgMembership] = await Promise.all([
    prisma.teamFollow.findFirst({
      where: { user_id: viewerId, team_id: teamId },
      select: { team_id: true },
    }),
    prisma.teamMembership.findFirst({
      where: { user_id: viewerId, team_id: teamId, status: 'active' },
      select: { team_id: true },
    }),
    prisma.organizationMembership.findFirst({
      where: {
        user_id: viewerId,
        organization_id: team.organization_id,
        role: { in: ['owner', 'manager'] },
        status: 'active',
      },
      select: { organization_id: true },
    }),
  ]);

  return !follow && !membership && !orgMembership;
}
