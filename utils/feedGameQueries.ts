/**
 * Feed game query planning.
 *
 * The feed used to issue ONE ascending query starting 3 days in the past
 * (limit 30). Once the recent past holds more than a page of games (seeded
 * pro slates guarantee this), page one never reaches today — upcoming games
 * exist on the map but never in the feed. Splitting upcoming and past into
 * separate queries gives each section its own budget.
 */

/** How far back the Past Events recap looks. */
export const FEED_PAST_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Upcoming query look-back. Must cover the feed's 2h "live" window
 * (LIVE_WINDOW_MS in app/feed.tsx) so an in-progress game still arrives with
 * the upcoming page rather than only in the past recap.
 */
export const FEED_LIVE_LOOKBACK_MS = 2 * 60 * 60 * 1000;

type GameListOptions = {
  limit: number;
  dateFrom: string;
  dateTo?: string;
  teamless?: boolean;
};

export interface FeedGameQueryPlan {
  /** Live + future games, soonest first. Pagination cursor continues this query. */
  upcoming: { sort: 'date'; options: GameListOptions };
  /** Recent-past recap, newest first so a dense slate keeps yesterday, not 3 days ago. */
  past: { sort: '-date'; options: GameListOptions };
  /** Curated teamless events (marquee) — upcoming only, immune to past-game crowding. */
  marquee: { sort: 'date'; options: GameListOptions };
}

export function buildFeedGameQueries(nowMs: number): FeedGameQueryPlan {
  const liveFrom = new Date(nowMs - FEED_LIVE_LOOKBACK_MS).toISOString();
  const nowIso = new Date(nowMs).toISOString();
  return {
    upcoming: { sort: 'date', options: { limit: 30, dateFrom: liveFrom } },
    past: {
      sort: '-date',
      options: {
        limit: 30,
        dateFrom: new Date(nowMs - FEED_PAST_WINDOW_MS).toISOString(),
        dateTo: nowIso,
      },
    },
    marquee: { sort: 'date', options: { limit: 10, dateFrom: liveFrom, teamless: true } },
  };
}

/**
 * Merge the pages into one list: dedupe by id, ascending by date, dateless
 * last. The feed's own upcoming/past sectioning re-buckets the result.
 */
export function mergeFeedGames<T extends { id: string | number; date?: string | null }>(
  ...pages: T[][]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const page of pages) {
    for (const game of page) {
      const key = String(game.id);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(game);
    }
  }
  merged.sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : NaN;
    const bt = b.date ? new Date(b.date).getTime() : NaN;
    if (!Number.isFinite(at)) return 1;
    if (!Number.isFinite(bt)) return -1;
    return at - bt;
  });
  return merged;
}
