import { prisma } from './prisma.js';
import { GAME_SUMMARY_SELECT } from './serializeGame.js';
import { isGamePubliclyVisible } from './gameApproval.js';

export type ScheduleItem =
  | {
      kind: 'game';
      id: string;
      title: string | null;
      date: string;
      location: string | null;
      home_team: string | null;
      away_team: string | null;
      home_team_id: string | null;
      away_team_id: string | null;
      event_type: string | null;
    }
  | {
      kind: 'event';
      id: string;
      title: string;
      date: string;
      location: string | null;
      event_type: string | null;
      banner_url: string | null;
    };

const toIso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : String(d));

/**
 * Pure: filter games through the canonical public-visibility rule, tag events,
 * merge, and sort date-desc. The ONE place a team's public schedule is decided.
 * Events passed in are assumed already query-filtered (approved, not cancelled,
 * standalone game_id=null) — see getTeamScheduleFeed.
 */
export function buildScheduleItems(games: any[], events: any[]): ScheduleItem[] {
  const gameItems: ScheduleItem[] = games
    .filter(g => isGamePubliclyVisible(g))
    .map(g => ({
      kind: 'game',
      id: String(g.id),
      title: g.title ?? null,
      date: toIso(g.date),
      location: g.location ?? null,
      home_team: g.home_team ?? null,
      away_team: g.away_team ?? null,
      home_team_id: g.home_team_id ?? null,
      away_team_id: g.away_team_id ?? null,
      event_type: g.event_type ?? null,
    }));
  const eventItems: ScheduleItem[] = events.map(e => ({
    kind: 'event',
    id: String(e.id),
    title: e.title,
    date: toIso(e.date),
    location: e.location ?? null,
    event_type: e.event_type ?? null,
    banner_url: e.banner_url ?? null,
  }));
  return [...gameItems, ...eventItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * The team's public schedule: approved+visible games (home OR away) merged with
 * standalone approved, non-cancelled events (game_id=null so a game-type event
 * isn't double-listed). `viewerId` is reserved for future viewer-aware rules;
 * today this is the public projection, matching the screen-summaries it feeds.
 */
export async function getTeamScheduleFeed(
  teamIds: string[],
  _viewerId: string | null,
  opts: { limit?: number } = {}
): Promise<ScheduleItem[]> {
  if (teamIds.length === 0) return [];
  const limit = opts.limit ?? 20;
  const [games, events] = await Promise.all([
    prisma.game.findMany({
      where: { OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }] },
      orderBy: { date: 'desc' },
      take: 100,
      select: { ...GAME_SUMMARY_SELECT, opponent_approval_status: true },
    }),
    prisma.event.findMany({
      where: {
        team_id: { in: teamIds },
        game_id: null,
        approval_status: 'approved',
        status: { not: 'cancelled' },
      },
      orderBy: { date: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        event_type: true,
        banner_url: true,
      },
    }),
  ]);
  return buildScheduleItems(games, events).slice(0, limit);
}
