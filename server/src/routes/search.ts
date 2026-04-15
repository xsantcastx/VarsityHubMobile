import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiters.js';

export const searchRouter = Router();

/**
 * GET /search?q=...
 * Unified search across users, teams, and organizations.
 * Returns results grouped by type with is_following when authenticated.
 * Auth is optional; unauthenticated requests return results with is_following: false.
 */
searchRouter.get('/', searchLimiter, authMiddleware as any, async (req: AuthedRequest, res) => {
  try {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(parseInt(String((req.query as any).limit || '10'), 10) || 10, 20));
  const currentUserId = req.user?.id ?? null;

  if (!q || q.length < 1) {
    return res.json({ users: [], teams: [], organizations: [] });
  }

  // v1.0.2 pass 8: exclude users that the requester has blocked OR who have blocked the requester.
  // Without this, blocked users could discover each other via exact-username search and infer the block.
  let blockedIds: string[] = [];
  if (currentUserId) {
    const blocks = await prisma.blockedUser.findMany({
      where: { OR: [{ blocker_id: currentUserId }, { blocked_id: currentUserId }] },
      select: { blocker_id: true, blocked_id: true },
    });
    const ids = new Set<string>();
    for (const b of blocks) {
      if (b.blocker_id !== currentUserId) ids.add(b.blocker_id);
      if (b.blocked_id !== currentUserId) ids.add(b.blocked_id);
    }
    blockedIds = Array.from(ids);
  }

  const [users, teams, organizations] = await Promise.all([
    prisma.user.findMany({
      where: {
        AND: [
          { banned: false },
          ...(blockedIds.length > 0 ? [{ id: { notIn: blockedIds } }] : []),
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { display_name: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
      },
      take: limit,
      orderBy: { username: 'asc' },
    }),
    prisma.team.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
          { league: { contains: q, mode: 'insensitive' } },
          { sport: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.organization.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { sport: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        sport: true,
        _count: { select: { memberships: true, teams: true } },
      },
    }),
  ]);

  let userFollowSet = new Set<string>();
  let teamFollowSet = new Set<string>();
  let orgFollowSet = new Set<string>();

  if (currentUserId && (users.length || teams.length || organizations.length)) {
    const [userFollows, teamFollows, orgFollows] = await Promise.all([
      users.length
        ? prisma.follows.findMany({
            where: {
              follower_id: currentUserId,
              following_id: { in: users.map((u) => u.id) },
            },
            select: { following_id: true },
          })
        : [],
      teams.length
        ? prisma.teamFollow.findMany({
            where: {
              user_id: currentUserId,
              team_id: { in: teams.map((t) => t.id) },
            },
            select: { team_id: true },
          })
        : [],
      organizations.length
        ? prisma.organizationFollow.findMany({
            where: {
              user_id: currentUserId,
              organization_id: { in: organizations.map((o) => o.id) },
            },
            select: { organization_id: true },
          })
        : [],
    ]);
    userFollowSet = new Set(userFollows.map((f) => f.following_id));
    teamFollowSet = new Set(teamFollows.map((f) => f.team_id));
    orgFollowSet = new Set(orgFollows.map((f) => f.organization_id));
  }

  // Sort users by relevance: exact match first, then startsWith, then contains
  const sortedUsers = [...users].sort((a, b) => {
    const aName = (a.username || a.display_name || '').toLowerCase();
    const bName = (b.username || b.display_name || '').toLowerCase();
    const aExact = aName === q ? 0 : aName.startsWith(q) ? 1 : 2;
    const bExact = bName === q ? 0 : bName.startsWith(q) ? 1 : 2;
    return aExact - bExact;
  });

  // Filter out system-generated usernames (UUID, CUID, random IDs) so only
  // user-created usernames are returned to the client
  const isSystemId = (s: string | null): boolean => {
    if (!s) return false;
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
    // CUID v1 (starts with c, 20+ alphanumeric)
    if (/^c[0-9a-z]{20,}$/.test(s)) return true;
    // CUID v2 / nanoid / random ID — 8+ chars, all lowercase alphanumeric, no spaces or special chars
    if (/^[0-9a-z]{8,}$/.test(s) && !/[aeiou]{2,}/i.test(s)) return true;
    return false;
  };

  const usersPayload = sortedUsers.map((u) => ({
    id: u.id,
    username: isSystemId(u.username) ? null : (u.username || null),
    display_name: isSystemId(u.display_name) ? (isSystemId(u.username) ? 'User' : u.username || 'User') : (u.display_name || u.username || 'User'),
    avatar_url: u.avatar_url,
    is_following: userFollowSet.has(u.id),
  }));

  // Sort teams by relevance: name match first
  const sortedTeams = [...teams].sort((a, b) => {
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    const aExact = aName === q ? 0 : aName.startsWith(q) ? 1 : 2;
    const bExact = bName === q ? 0 : bName.startsWith(q) ? 1 : 2;
    return aExact - bExact;
  });

  const teamsPayload = sortedTeams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    logo_url: (t as any).logo_url ?? null,
    avatar_url: (t as any).avatar_url ?? null,
    sport: (t as any).sport ?? null,
    members: (t as any)._count?.memberships ?? 0,
    is_following: teamFollowSet.has(t.id),
  }));

  const organizationsPayload = organizations.map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    sport: o.sport,
    members: o._count?.memberships ?? 0,
    teams_count: o._count?.teams ?? 0,
    is_following: orgFollowSet.has(o.id),
  }));

  return res.json({
    users: usersPayload,
    teams: teamsPayload,
    organizations: organizationsPayload,
  });
  } catch (err) {
    console.error('[search] GET / error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
