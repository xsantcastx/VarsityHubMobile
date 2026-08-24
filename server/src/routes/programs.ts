import { Router } from 'express';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import { hasDirectTeamAccess, isTeamHiddenFromViewer } from '../lib/privacyUtils.js';
import { GAME_SUMMARY_SELECT } from '../lib/serializeGame.js';
import { getTeamScheduleFeed } from '../lib/teamScheduleFeed.js';
import { serializeTeam, buildTeamSerializeSelect } from '../lib/serializeTeam.js';
import { captureMessage } from '../lib/sentry.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { followLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerIdValidation } from '../middleware/validateParams.js';

// Level-teams query cap for GET /:id/screen-summary — see the truncation
// signal right after the query below.
const SCREEN_SUMMARY_TEAM_CAP = 25;

export const programsRouter = Router();
registerIdValidation(programsRouter);

const LEVEL_ORDER = ['varsity', 'jv', 'freshman', 'middle_school', 'unified', 'other'];
function levelRank(level: string | null): number {
  if (!level) return LEVEL_ORDER.length; // nulls last
  const i = LEVEL_ORDER.indexOf(level);
  return i === -1 ? LEVEL_ORDER.length : i;
}

// Optional-auth (no requireAuth): program-page is a GUEST_BROWSE_ROUTE_SEGMENT
// and the canonical public surface for a sport program, mirroring the
// guest-accessible GET /teams/:id/screen-summary. viewerId is null for guests
// (or a lapsed token); per-team privacy is enforced via isTeamHiddenFromViewer
// below, so a guest sees only public level teams.
//
// intent: mirrors the same guest-accessible-without-admin_approved-gate
// posture as GET /teams/:id/screen-summary (see that route's comment) —
// inherited, not introduced by the Sport-Program work. Flagged in the
// 2026-08-23 Trust Boundary Review; not changed pending confirmation of
// whether the org-owner pre-approval preview flow this exemption protects
// actually exists in the client.
programsRouter.get(
  '/:id/screen-summary',
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
          take: SCREEN_SUMMARY_TEAM_CAP,
          select: {
            ...buildTeamSerializeSelect({ includeCounts: true }),
            status: true,
          },
        },
      },
    });
    if (!program) return sendError(res, 404, 'Program not found');

    // Signal (don't change behavior) when the level-teams query hits its cap:
    // the 26th+ active team is silently dropped from both `levels` and
    // `counts` below. Mirrors the truncation signal in
    // server/src/lib/programFollowFanout.ts.
    if (program.teams.length === SCREEN_SUMMARY_TEAM_CAP) {
      const message = `[program-screen-summary] team list truncated at ${SCREEN_SUMMARY_TEAM_CAP} for program ${programId}`;
      console.warn(message);
      captureMessage(message, 'warning', { programId, cap: SCREEN_SUMMARY_TEAM_CAP });
    }

    // Per-team privacy gate: drop level teams the viewer isn't allowed to see
    // (private teams they don't follow / aren't a member of / aren't an org
    // admin for). Mirrors GET /teams/:id/screen-summary. A fully-hidden
    // program still returns 200 with levels: [] — the program is not private.
    const hiddenFlags = await Promise.all(
      program.teams.map(t => isTeamHiddenFromViewer(t.id, viewerId))
    );
    const visibleTeams = program.teams.filter((_, i) => !hiddenFlags[i]);
    const visibleTeamIds = visibleTeams.map(t => t.id);

    // Follower stats are intent-based: a ProgramFollow row IS "follows the
    // program." Not a union over level-team TeamFollow rows.
    const [followersCount, viewerFollow, games] = await Promise.all([
      prisma.programFollow.count({ where: { program_id: programId } }),
      viewerId
        ? prisma.programFollow.findUnique({
            where: { user_id_program_id: { user_id: viewerId, program_id: programId } },
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

    const levels = await Promise.all(
      [...visibleTeams]
        .sort((a, b) => levelRank(a.level) - levelRank(b.level))
        .map(async team => ({
          level: team.level ?? null,
          team: serializeTeam(team, { includeCounts: true }),
          games: (gamesByTeam.get(team.id) ?? []).map(g => ({
            ...g,
            date: g.date instanceof Date ? g.date.toISOString() : String(g.date),
          })),
          // Merged per-sub-team schedule (games+events) the picker renders.
          schedule: await getTeamScheduleFeed([team.id], viewerId),
        }))
    );

    return res.json({
      program: {
        id: program.id,
        organization_id: program.organization_id,
        sport: program.sport,
        name: program.name,
        logo_url: program.logo_url,
        created_at: program.created_at.toISOString(),
        followers_count: followersCount,
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

// Follow every current active level team in a program (fan-out write).
// No TEAM_FOLLOWED notifications here, deliberately — unlike POST
// /teams/:id/follow, fanning this out per level team would send N
// notifications to the same staff for one user action.
programsRouter.post(
  '/:id/follow',
  requireAuth as any,
  followLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const programId = String(req.params.id);
    const program = await prisma.sportProgram.findUnique({
      where: { id: programId },
      select: {
        id: true,
        teams: {
          where: { status: 'active' },
          select: { id: true, is_private: true, organization_id: true },
          take: 25,
        },
      },
    });
    if (!program) return sendError(res, 404, 'Program not found');

    // Write the intent ledger row first — this is the new source of truth
    // for "does this user follow the program." Upsert keeps it idempotent
    // under the (user_id, program_id) composite PK.
    await prisma.programFollow.upsert({
      where: { user_id_program_id: { user_id: req.user.id, program_id: programId } },
      create: { user_id: req.user.id, program_id: programId },
      update: {},
    });
    // Following a program must not silently grant follow-based access to a
    // private level team the viewer couldn't otherwise see — that defeats
    // is_private the same way an unguarded POST /teams/:id/follow would (see
    // hasDirectTeamAccess, privacyUtils.ts, and the CRITICAL fix in this same
    // PR). Only fan out to teams that are public, or private teams the viewer
    // already has direct access to (staff membership / org owner-manager).
    // The ProgramFollow intent row above is unaffected — the user still
    // "follows the program," they just don't get a free pass into a private
    // level team's roster.
    const followableTeamIds: string[] = [];
    for (const team of program.teams) {
      if (!team.is_private) {
        followableTeamIds.push(team.id);
        continue;
      }
      if (await hasDirectTeamAccess(team.id, req.user.id, team.organization_id)) {
        followableTeamIds.push(team.id);
      }
    }
    // Fan out over the followable level teams. createMany + skipDuplicates
    // keeps this idempotent under the (user_id, team_id) composite PK without
    // a P2002 round-trip. Each row is stamped via_program_id so DELETE can
    // later target only the rows this program created — NOTE: skipDuplicates
    // means a PRE-EXISTING direct follow (via_program_id null) of a level
    // team is left alone, not overwritten with the program stamp. That's
    // deliberate: it's what keeps unfollow lossless (see DELETE below), not a
    // bug to "fix".
    if (followableTeamIds.length) {
      await prisma.teamFollow.createMany({
        data: followableTeamIds.map(team_id => ({
          team_id,
          user_id: req.user!.id,
          via_program_id: programId,
        })),
        skipDuplicates: true,
      });
    }
    return res.json({ ok: true, followed_team_ids: followableTeamIds });
  })
);

programsRouter.delete(
  '/:id/follow',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const programId = String(req.params.id);
    const program = await prisma.sportProgram.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) return sendError(res, 404, 'Program not found');
    const userId = req.user.id;
    // Lossless unfollow: only clear the ProgramFollow ledger row and the
    // TeamFollow rows THIS program stamped (via_program_id === programId).
    // A pre-existing direct follow of a level team (via_program_id null)
    // is untouched — matching on via_program_id instead of team_id is what
    // makes this lossless, unlike the old team_id-in-list approach.
    const [, removed] = await prisma.$transaction([
      prisma.programFollow.deleteMany({ where: { user_id: userId, program_id: programId } }),
      prisma.teamFollow.deleteMany({
        where: { user_id: userId, via_program_id: programId },
      }),
    ]);
    return res.json({ ok: true, unfollowed: removed.count });
  })
);
