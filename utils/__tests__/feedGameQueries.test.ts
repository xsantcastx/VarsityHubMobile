import {
  buildFeedGameQueries,
  mergeFeedGames,
  FEED_PAST_WINDOW_MS,
  FEED_LIVE_LOOKBACK_MS,
} from '@/utils/feedGameQueries';

describe('buildFeedGameQueries', () => {
  const now = new Date('2026-07-12T20:00:00.000Z').getTime();

  it('anchors the upcoming query at now minus the live window so in-progress games stay in the rail', () => {
    const q = buildFeedGameQueries(now);
    expect(q.upcoming.sort).toBe('date');
    expect(q.upcoming.options.dateFrom).toBe(new Date(now - FEED_LIVE_LOOKBACK_MS).toISOString());
    expect(q.upcoming.options.dateTo).toBeUndefined();
    expect(q.upcoming.options.limit).toBe(30);
  });

  it('bounds the past recap query to the last 3 days ending now, newest first', () => {
    const q = buildFeedGameQueries(now);
    expect(q.past.sort).toBe('-date');
    expect(q.past.options.dateFrom).toBe(new Date(now - FEED_PAST_WINDOW_MS).toISOString());
    expect(q.past.options.dateTo).toBe(new Date(now).toISOString());
    expect(q.past.options.limit).toBe(30);
  });

  it('makes the marquee query upcoming-only so curated events cannot be crowded out by past games', () => {
    const q = buildFeedGameQueries(now);
    expect(q.marquee.sort).toBe('date');
    expect(q.marquee.options.teamless).toBe(true);
    expect(q.marquee.options.dateFrom).toBe(new Date(now - FEED_LIVE_LOOKBACK_MS).toISOString());
    expect(q.marquee.options.limit).toBe(10);
  });
});

describe('mergeFeedGames', () => {
  const g = (id: string, date: string | null) => ({ id, date });

  it('keeps upcoming games even when the past page is full (the map-but-not-feed bug)', () => {
    const past = Array.from({ length: 30 }, (_, i) =>
      g(`past-${i}`, `2026-07-1${i % 2}T00:00:00.000Z`)
    );
    const upcoming = [g('up-1', '2026-07-25T00:00:00.000Z'), g('up-2', '2026-08-01T00:00:00.000Z')];
    const merged = mergeFeedGames(past, upcoming, []);
    expect(merged.map(x => x.id)).toEqual(expect.arrayContaining(['up-1', 'up-2']));
    expect(merged).toHaveLength(32);
  });

  it('dedupes by id across pages', () => {
    const merged = mergeFeedGames(
      [g('a', '2026-07-11T00:00:00.000Z')],
      [g('a', '2026-07-11T00:00:00.000Z'), g('b', '2026-07-25T00:00:00.000Z')],
      [g('b', '2026-07-25T00:00:00.000Z')]
    );
    expect(merged.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('sorts ascending by date with dateless games last', () => {
    const merged = mergeFeedGames(
      [g('later', '2026-08-01T00:00:00.000Z')],
      [g('none', null), g('sooner', '2026-07-13T00:00:00.000Z')],
      []
    );
    expect(merged.map(x => x.id)).toEqual(['sooner', 'later', 'none']);
  });
});
