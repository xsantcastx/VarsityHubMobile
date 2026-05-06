import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getExcludedPrivateAuthorIds, getExcludedPrivateTeamIds } from '../lib/privacyUtils.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { captureMessage } from '../lib/sentry.js';

export const searchRouter = Router();

/**
 * GET /search?q=...
 * Unified search across users, teams, organizations, games, and events.
 * Returns results grouped by type with is_following when authenticated.
 * Auth is optional; unauthenticated requests return results with is_following: false.
 */
searchRouter.get(
  '/',
  searchLimiter,
  authMiddleware as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = String((req.query as any).q || '')
      .trim()
      .toLowerCase();
    const limit = Math.max(
      1,
      Math.min(parseInt(String((req.query as any).limit || '10'), 10) || 10, 20)
    );
    const currentUserId = req.user?.id ?? null;

    if (!q || q.length < 1) {
      return res.json({ users: [], teams: [], organizations: [], games: [], events: [] });
    }
    // Cap query length to bound the cost of `contains` scans across users,
    // teams, and organizations. A 10k-char q would force three full-table
    // ILIKE walks per request. 200 chars is well above any legitimate
    // username/team/org name length and matches the longest indexed name
    // columns in schema.prisma. Reject rather than truncate so the client
    // doesn't silently get partial-prefix results.
    if (q.length > 200) {
      return res.status(400).json({
        error: 'QUERY_TOO_LONG',
        message: 'Search query must be 200 characters or fewer.',
      });
    }

    // v1.0.2 pass 8: exclude users that the requester has blocked OR who have blocked the requester.
    // Without this, blocked users could discover each other via exact-username search and infer the block.
    //
    // BLOCK_LIST_HARD_LIMIT is the absolute ceiling. We fetch take=LIMIT+1 to
    // detect overflow — if the user has more than LIMIT block relationships,
    // the previous behavior silently truncated and let the un-fetched blocked
    // users reappear in search results (defeating the privacy intent). On
    // overflow we fail-closed (503) and capture an error: search dropping
    // for one pathological user is preferable to blocked users leaking
    // through everyone else's results.
    const BLOCK_LIST_HARD_LIMIT = 10_000;
    let blockedIds: string[] = [];
    if (currentUserId) {
      const blocks = await prisma.blockedUser.findMany({
        where: { OR: [{ blocker_id: currentUserId }, { blocked_id: currentUserId }] },
        select: { blocker_id: true, blocked_id: true },
        take: BLOCK_LIST_HARD_LIMIT + 1,
      });
      if (blocks.length > BLOCK_LIST_HARD_LIMIT) {
        captureMessage('Search blocked-list exceeded hard limit — failing closed', 'error', {
          context: 'search_blocked_list_overflow',
          userId: currentUserId,
          limit: BLOCK_LIST_HARD_LIMIT,
        });
        return res.status(503).json({
          error: 'SEARCH_TEMPORARILY_UNAVAILABLE',
          message: 'Search is temporarily unavailable for this account. Please contact support.',
        });
      }
      const ids = new Set<string>();
      for (const b of blocks) {
        if (b.blocker_id !== currentUserId) ids.add(b.blocker_id);
        if (b.blocked_id !== currentUserId) ids.add(b.blocked_id);
      }
      blockedIds = Array.from(ids);
    }

    // Privacy: exclude private profiles the viewer doesn't already follow.
    // Returns [] when there are no private users or when the viewer follows
    // every private user that matched.
    const privateExcludeIds = await getExcludedPrivateAuthorIds(currentUserId);
    const isAdmin = currentUserId ? await getIsAdmin(req as any) : false;
    const privateTeamExcludeIds = isAdmin ? [] : await getExcludedPrivateTeamIds(currentUserId);

    // COPPA: hide 13–17 minors from public search. Adults (DOB >= 18 years
    // ago) and users with unknown DOB pass through, matching the existing
    // `isMinor` fail-open behavior. The 18-year cutoff is computed in JS so
    // Prisma can compare against the indexed `date_of_birth` column directly.
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

    const userExcludeIds = Array.from(new Set([...blockedIds, ...privateExcludeIds]))
      .filter(id => id !== currentUserId);

    const todayUtcStart = new Date();
    todayUtcStart.setUTCHours(0, 0, 0, 0);

    const [users, teams, organizations, games, events] = await Promise.all([
      prisma.user.findMany({
        where: {
          AND: [
            { banned: false },
            ...(userExcludeIds.length > 0 ? [{ id: { notIn: userExcludeIds } }] : []),
            {
              OR: [
                { date_of_birth: null },
                { date_of_birth: { lte: eighteenYearsAgo } },
              ],
            } as any,
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
          status: 'active',
          // Hide teams whose org is unapproved or archived — same boundary
          // as the org filter below so a team can't be discovered through a
          // back door when its org isn't yet reviewed.
          organization: { admin_approved: true, status: 'active' },
          ...(privateTeamExcludeIds.length > 0 ? { id: { notIn: privateTeamExcludeIds } } : {}),
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
        select: {
          id: true,
          name: true,
          sport: true,
          logo_url: true,
          avatar_url: true,
          _count: { select: { memberships: true } },
        },
      }),
      prisma.organization.findMany({
        where: {
          // Public search is for admin-approved, active orgs only. Pending
          // and rejected orgs stay invisible until a super-admin reviews.
          admin_approved: true,
          status: 'active',
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
      prisma.game.findMany({
        where: {
          approval_status: 'approved',
          date: { gte: todayUtcStart },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { location: { contains: q, mode: 'insensitive' } },
            { home_team: { contains: q, mode: 'insensitive' } },
            { away_team: { contains: q, mode: 'insensitive' } },
            { away_team_name: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ date: 'asc' }, { created_at: 'desc' }],
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          home_team: true,
          away_team: true,
          away_team_name: true,
          event_type: true,
          banner_url: true,
          cover_image_url: true,
        },
      }),
      prisma.event.findMany({
        where: {
          approval_status: 'approved',
          status: 'approved',
          date: { gte: todayUtcStart },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { location: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { event_type: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ date: 'asc' }, { created_at: 'desc' }],
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          event_type: true,
          banner_url: true,
          game_id: true,
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
                following_id: { in: users.map(u => u.id) },
              },
              select: { following_id: true },
            })
          : [],
        teams.length
          ? prisma.teamFollow.findMany({
              where: {
                user_id: currentUserId,
                team_id: { in: teams.map(t => t.id) },
              },
              select: { team_id: true },
            })
          : [],
        organizations.length
          ? prisma.organizationFollow.findMany({
              where: {
                user_id: currentUserId,
                organization_id: { in: organizations.map(o => o.id) },
              },
              select: { organization_id: true },
            })
          : [],
      ]);
      userFollowSet = new Set(userFollows.map(f => f.following_id));
      teamFollowSet = new Set(teamFollows.map(f => f.team_id));
      orgFollowSet = new Set(orgFollows.map(f => f.organization_id));
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

    const usersPayload = sortedUsers.map(u => ({
      id: u.id,
      username: isSystemId(u.username) ? null : u.username || null,
      display_name: isSystemId(u.display_name)
        ? isSystemId(u.username)
          ? 'User'
          : u.username || 'User'
        : u.display_name || u.username || 'User',
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

    const teamsPayload = sortedTeams.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      logo_url: (t as any).logo_url ?? null,
      avatar_url: (t as any).avatar_url ?? null,
      sport: (t as any).sport ?? null,
      members: (t as any)._count?.memberships ?? 0,
      is_following: teamFollowSet.has(t.id),
      is_private: (t as any).is_private ?? false,
    }));

    const organizationsPayload = organizations.map(o => ({
      id: o.id,
      name: o.name,
      description: o.description,
      sport: o.sport,
      members: o._count?.memberships ?? 0,
      teams_count: o._count?.teams ?? 0,
      is_following: orgFollowSet.has(o.id),
    }));

    const gamesPayload = games.map((game) => ({
      id: game.id,
      title: game.title,
      date: game.date instanceof Date ? game.date.toISOString() : game.date,
      location: game.location,
      home_team: game.home_team,
      away_team: game.away_team || game.away_team_name,
      event_type: game.event_type,
      banner_url: game.banner_url || game.cover_image_url,
    }));

    const eventsPayload = events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date instanceof Date ? event.date.toISOString() : event.date,
      location: event.location,
      event_type: event.event_type,
      banner_url: event.banner_url,
      game_id: event.game_id,
    }));

    return res.json({
      users: usersPayload,
      teams: teamsPayload,
      organizations: organizationsPayload,
      games: gamesPayload,
      events: eventsPayload,
    });
  })
);
