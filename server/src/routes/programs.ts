import { Router } from 'express';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import { isTeamHiddenFromViewer } from '../lib/privacyUtils.js';
import { GAME_SUMMARY_SELECT } from '../lib/serializeGame.js';
import { serializeTeam, buildTeamSerializeSelect } from '../lib/serializeTeam.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const programsRouter = Router();
registerIdValidation(programsRouter);

const LEVEL_ORDER = ['varsity', 'jv', 'freshman', 'middle_school', 'unified', 'other'];
function levelRank(level: string | null): number {
  if (!level) return LEVEL_ORDER.length; // nulls last
  const i = LEVEL_ORDER.indexOf(level);
  return i === -1 ? LEVEL_ORDER.length : i;
}

programsRouter.get(
  '/:id/screen-summary',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const programId = String(req.params.id);
    const viewerId = req.user?.id ?? null;

    const program = await prisma.sportProgram.findUnique({
      where: { id: programId },
      include: {
        organization: { select: { id: true, name: true } },
        teams: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
          take: 25,
          select: {
            ...buildTeamSerializeSelect({ includeCounts: true }),
            status: true,
          },
        },
      },
    });
    if (!program) return sendError(res, 404, 'Program not found');

    // All active level teams — used for the union follower stats (below).
    const allTeamIds = program.teams.map(t => t.id);

    // Per-team privacy gate: drop level teams the viewer isn't allowed to see
    // (private teams they don't follow / aren't a member of / aren't an org
    // admin for). Mirrors GET /teams/:id/screen-summary. A fully-hidden
    // program still returns 200 with levels: [] — the program is not private.
    const hiddenFlags = await Promise.all(
      program.teams.map(t => isTeamHiddenFromViewer(t.id, viewerId))
    );
    const visibleTeams = program.teams.filter((_, i) => !hiddenFlags[i]);
    const visibleTeamIds = visibleTeams.map(t => t.id);

    // Follower stats stay over ALL active level teams: follow state is not
    // private information, and the union semantics must be viewer-stable.
    const [followerRows, viewerFollow, games] = await Promise.all([
      allTeamIds.length
        ? prisma.teamFollow.groupBy({ by: ['user_id'], where: { team_id: { in: allTeamIds } } })
        : Promise.resolve([] as { user_id: string }[]),
      viewerId && allTeamIds.length
        ? prisma.teamFollow.findFirst({
            where: { user_id: viewerId, team_id: { in: allTeamIds } },
            select: { team_id: true },
          })
        : Promise.resolve(null),
      visibleTeamIds.length
        ? prisma.game.findMany({
            where: {
              approval_status: 'approved',
              opponent_approval_status: { in: ['not_required', 'approved'] },
              OR: [
                { home_team_id: { in: visibleTeamIds } },
                { away_team_id: { in: visibleTeamIds } },
              ],
            },
            orderBy: { date: 'desc' },
            take: 100,
            select: GAME_SUMMARY_SELECT,
          })
        : Promise.resolve([] as any[]),
    ]);

    const gamesByTeam = new Map<string, any[]>();
    for (const g of games) {
      for (const tid of [g.home_team_id, g.away_team_id]) {
        if (!tid || !visibleTeamIds.includes(tid)) continue;
        const list = gamesByTeam.get(tid) ?? [];
        if (list.length < 20) list.push(g);
        gamesByTeam.set(tid, list);
      }
    }

    const levels = [...visibleTeams]
      .sort((a, b) => levelRank(a.level) - levelRank(b.level))
      .map(team => ({
        level: team.level ?? null,
        team: serializeTeam(team, { includeCounts: true }),
        games: (gamesByTeam.get(team.id) ?? []).map(g => ({
          ...g,
          date: g.date instanceof Date ? g.date.toISOString() : String(g.date),
        })),
      }));

    return res.json({
      program: {
        id: program.id,
        organization_id: program.organization_id,
        sport: program.sport,
        gender: program.gender,
        name: program.name,
        logo_url: program.logo_url,
        created_at: program.created_at.toISOString(),
        followers_count: followerRows.length,
        is_following: !!viewerFollow,
        organization: program.organization ?? null,
      },
      levels,
      counts: {
        // Counts reflect ONLY the visible teams — the games query above is
        // already scoped to visibleTeamIds, so games.length is post-filter.
        levels: levels.length,
        teams: visibleTeams.length,
        games: games.length,
      },
    });
  })
);
