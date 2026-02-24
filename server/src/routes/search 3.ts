import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';

export const searchRouter = Router();

/**
 * GET /search?q=...
 * Unified search across users, teams, and organizations.
 * Returns results grouped by type with is_following when authenticated.
 * Auth is optional; unauthenticated requests return results with is_following: false.
 */
searchRouter.get('/', authMiddleware as any, async (req: AuthedRequest, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const limit = Math.min(parseInt(String((req.query as any).limit || '10'), 10) || 10, 20);
  const currentUserId = req.user?.id ?? null;

  if (!q || q.length < 1) {
    return res.json({ users: [], teams: [], organizations: [] });
  }

  const [users, teams, organizations] = await Promise.all([
    prisma.user.findMany({
      where: {
        AND: [
          { banned: false },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { display_name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
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
      orderBy: { display_name: 'asc' },
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

  const usersPayload = users.map((u) => ({
    id: u.id,
    username: u.username || u.display_name || 'user',
    display_name: u.display_name || u.username || 'User',
    avatar_url: u.avatar_url,
    is_following: userFollowSet.has(u.id),
  }));

  const teamsPayload = teams.map((t) => ({
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
});
