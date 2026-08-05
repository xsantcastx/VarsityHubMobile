import type { ProLeague } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import { serializeLiveWindow } from '../lib/geofencing.js';
import { venuePhotoFor } from '../lib/proSchedule/venuePhotos.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { followLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerIdValidation } from '../middleware/validateParams.js';

/**
 * Read-only professional team pages.
 *
 * There is deliberately NO write surface here beyond follow/unfollow. ProTeam
 * rows are system-managed (seed + schedule ingester); no endpoint creates,
 * edits, claims, or joins one, and the schema has no membership or owner
 * relation to target even if one were added by mistake. That is the whole
 * design — see docs/superpowers/specs/2026-07-23-pro-sports-events-design.md.
 *
 * Guest-browsable, mirroring GET /programs/:id/screen-summary.
 */

export const proTeamsRouter = Router();
registerIdValidation(proTeamsRouter);

const EVENT_PAGE_CAP = 25;
const LIST_CAP = 60;

const LEAGUES = ['nfl', 'nba', 'wnba', 'mlb', 'wwe'] as const;

const listQuerySchema = z.object({
  league: z.enum(LEAGUES).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(LIST_CAP).optional(),
});

const PRO_TEAM_CARD_SELECT = {
  id: true,
  league: true,
  name: true,
  short_name: true,
  abbreviation: true,
  city: true,
  state: true,
  conference: true,
  division: true,
  venue_name: true,
  primary_color: true,
} as const;

/**
 * Shown on every pro surface. VarsityHub is a fan community referencing real
 * fixtures, not an official league product, and the page has to say so — it is
 * the difference between nominative fair use and implying sponsorship.
 */
function disclaimerFor(league: ProLeague): string {
  const label = league === 'wwe' ? 'WWE' : league.toUpperCase();
  return `Unofficial fan page. VarsityHub is not affiliated with or endorsed by the ${label} or any of its teams.`;
}

// GET /pro-teams — browse/filter. Guest-accessible.
proTeamsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, 'Invalid query');
    const { league, q, limit } = parsed.data;

    const teams = await prisma.proTeam.findMany({
      where: {
        active: true,
        ...(league ? { league } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { short_name: { contains: q, mode: 'insensitive' as const } },
                { city: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: PRO_TEAM_CARD_SELECT,
      orderBy: [{ league: 'asc' }, { name: 'asc' }],
      take: limit ?? LIST_CAP,
    });

    return res.json({ pro_teams: teams });
  })
);

// GET /pro-teams/:id — the page. Guest-accessible.
proTeamsRouter.get(
  '/:id/screen-summary',
  asyncHandler(async (req: AuthedRequest, res) => {
    const proTeamId = String(req.params.id);
    const viewerId = req.user?.id ?? null;

    const team = await prisma.proTeam.findUnique({
      where: { id: proTeamId },
      select: { ...PRO_TEAM_CARD_SELECT, venue_address: true, timezone: true, active: true },
    });
    if (!team || !team.active) return sendError(res, 404, 'Team not found');

    const now = new Date();
    const teamClause = {
      OR: [{ pro_home_team_id: proTeamId }, { pro_away_team_id: proTeamId }],
    };

    const [upcoming, recent, followersCount, follow] = await Promise.all([
      prisma.event.findMany({
        where: { ...teamClause, status: 'approved', date: { gte: now } },
        select: EVENT_SELECT,
        orderBy: { date: 'asc' },
        take: EVENT_PAGE_CAP,
      }),
      prisma.event.findMany({
        where: { ...teamClause, status: 'approved', date: { lt: now } },
        select: EVENT_SELECT,
        orderBy: { date: 'desc' },
        take: EVENT_PAGE_CAP,
      }),
      prisma.proTeamFollow.count({ where: { pro_team_id: proTeamId } }),
      viewerId
        ? prisma.proTeamFollow.findUnique({
            where: { user_id_pro_team_id: { user_id: viewerId, pro_team_id: proTeamId } },
            select: { user_id: true },
          })
        : Promise.resolve(null),
    ]);

    return res.json({
      pro_team: team,
      // Serialized server-side for the same reason school events are: the
      // client used to re-derive the window with a hardcoded cutoff and
      // disagreed with the server about whether posting was open.
      upcoming_events: upcoming.map(serializeProEvent),
      recent_events: recent.map(serializeProEvent),
      followers_count: followersCount,
      is_following: Boolean(follow),
      disclaimer: disclaimerFor(team.league),
    });
  })
);

const EVENT_SELECT = {
  id: true,
  title: true,
  date: true,
  timezone: true,
  location: true,
  latitude: true,
  longitude: true,
  status: true,
  live_window_hours_after_start: true,
  pro_home_team_id: true,
  pro_away_team_id: true,
  proHomeTeam: { select: { id: true, name: true, short_name: true, primary_color: true } },
  proAwayTeam: { select: { id: true, name: true, short_name: true, primary_color: true } },
} as const;

type ProEventRow = {
  date: Date;
  live_window_hours_after_start: number | null;
} & Record<string, unknown>;

function serializeProEvent(event: ProEventRow) {
  // Derived, NOT persisted: the venue photo + its required attribution, looked
  // up from the event's location (venue name is the part before the first
  // comma). Exposed as a new `venue_photo` field so only updated clients render
  // it — and they render `credit` alongside the image, satisfying CC-BY/CC-BY-SA.
  // Old clients ignore the field, so no image ever shows without its credit.
  const venue_photo = venuePhotoFor(typeof event.location === 'string' ? event.location : null);
  return {
    ...event,
    venue_photo,
    live_window: serializeLiveWindow(event.date, event.live_window_hours_after_start),
  };
}

// POST /pro-teams/:id/follow
proTeamsRouter.post(
  '/:id/follow',
  requireAuth as any,
  followLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const proTeamId = String(req.params.id);

    const team = await prisma.proTeam.findUnique({
      where: { id: proTeamId },
      select: { id: true, active: true },
    });
    if (!team || !team.active) return sendError(res, 404, 'Team not found');

    // Idempotent under the (user_id, pro_team_id) composite PK. No fan-out:
    // unlike a sport program, a pro team has no child teams to propagate to.
    await prisma.proTeamFollow.upsert({
      where: { user_id_pro_team_id: { user_id: req.user.id, pro_team_id: proTeamId } },
      create: { user_id: req.user.id, pro_team_id: proTeamId },
      update: {},
    });

    return res.json({ ok: true, is_following: true });
  })
);

// DELETE /pro-teams/:id/follow
proTeamsRouter.delete(
  '/:id/follow',
  requireAuth as any,
  followLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const proTeamId = String(req.params.id);

    // deleteMany, not delete: unfollowing something you do not follow is a
    // no-op, not a 404.
    await prisma.proTeamFollow.deleteMany({
      where: { user_id: req.user.id, pro_team_id: proTeamId },
    });

    return res.json({ ok: true, is_following: false });
  })
);
