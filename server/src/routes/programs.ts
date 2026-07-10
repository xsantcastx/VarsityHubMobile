import { Router } from 'express';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
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

    const teamIds = program.teams.map(t => t.id);

    // Read-time union: distinct followers across the program's level teams.
    const [followerRows, viewerFollow, games] = await Promise.all([
      teamIds.length
        ? prisma.teamFollow.groupBy({ by: ['user_id'], where: { team_id: { in: teamIds } } })
        : Promise.resolve([] as { user_id: string }[]),
      viewerId && teamIds.length
        ? prisma.teamFollow.findFirst({
            where: { user_id: viewerId, team_id: { in: teamIds } },
            select: { team_id: true },
          })
        : Promise.resolve(null),
      teamIds.length
        ? prisma.game.findMany({
            where: {
              approval_status: 'approved',
              opponent_approval_status: { in: ['not_required', 'approved'] },
              OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
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
        if (!tid || !teamIds.includes(tid)) continue;
        const list = gamesByTeam.get(tid) ?? [];
        if (list.length < 20) list.push(g);
        gamesByTeam.set(tid, list);
      }
    }

    const levels = [...program.teams]
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
        levels: levels.length,
        teams: program.teams.length,
        games: games.length,
      },
    });
  })
);
