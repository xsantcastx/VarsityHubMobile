import {
  dedupeFeedEntities,
  filterProEventsAlreadyRepresentedByGames,
  getFeedEntityKey,
  getFeedItemSport,
  normalizeFeedEvents,
  normalizeGamesPage,
  type GameItem,
} from '@/utils/feedNormalization';

describe('normalizeGamesPage', () => {
  it('accepts array responses and object envelopes', () => {
    const row = { id: 'game-1' } as GameItem;

    expect(normalizeGamesPage([row])).toEqual({ games: [row], cursor: null });
    expect(normalizeGamesPage({ games: [row], nextCursor: 'next' })).toEqual({
      games: [row],
      cursor: 'next',
    });
    expect(normalizeGamesPage({ items: [row] })).toEqual({ games: [row], cursor: null });
  });

  it('guards malformed page data', () => {
    expect(normalizeGamesPage(null)).toEqual({ games: [], cursor: null });
    expect(normalizeGamesPage({ games: 'bad', nextCursor: '' })).toEqual({
      games: [],
      cursor: null,
    });
  });
});

describe('normalizeFeedEvents', () => {
  it('maps event API rows into feed game items', () => {
    const result = normalizeFeedEvents(
      [
        {
          id: 'event-1',
          title: 'Knicks vs Nets',
          date: '2026-07-01T20:00:00.000Z',
          location: 'Madison Square Garden',
          sport: 'Basketball',
          game: { cover_image_url: 'https://cdn.example.com/cover.jpg' },
        },
      ],
      'nba'
    );

    expect(result[0]).toMatchObject({
      id: 'event-1',
      event_id: 'event-1',
      source_type: 'event',
      cover_image_url: 'https://cdn.example.com/cover.jpg',
      pro_league: 'nba',
      sport: 'basketball',
      home_score: null,
      away_score: null,
      winner: null,
    });
  });

  it('drops rows without string ids', () => {
    expect(normalizeFeedEvents([{ id: 123 }, null, { id: 'ok' }])).toHaveLength(1);
  });
});

describe('dedupeFeedEntities', () => {
  it('keys events by event_id and games by id', () => {
    expect(getFeedEntityKey({ id: 'game-1' })).toBe('entity:game-1');
    expect(getFeedEntityKey({ id: 'row-1', event_id: 'event-1' })).toBe('event:event-1');
  });

  it('keeps the richer event-backed duplicate for the same event', () => {
    const gameBacked = { id: 'game-1', event_id: 'event-1', source_type: 'game' } as GameItem;
    const eventBacked = {
      id: 'event-row',
      event_id: 'event-1',
      source_type: 'event',
      banner_url: 'https://cdn.example.com/banner.jpg',
    } as GameItem;

    expect(dedupeFeedEntities([gameBacked, eventBacked])).toEqual([eventBacked]);
  });
});

describe('getFeedItemSport', () => {
  it('normalizes direct sport values first', () => {
    expect(getFeedItemSport({ id: 'game-1', sport: 'basketball' })).toBe('basketball');
  });

  it('falls back to nested team sport shapes', () => {
    expect(getFeedItemSport({ id: 'game-1', home_team: { sport: 'Baseball' } } as any)).toBe(
      'baseball'
    );
  });
});

describe('filterProEventsAlreadyRepresentedByGames', () => {
  it('removes pro event rows that match an existing game by matchup, venue, and time bucket', () => {
    const games = [
      {
        id: 'game-1',
        title: 'New York Knicks vs Brooklyn Nets',
        date: '2026-07-01T20:05:00.000Z',
        location: 'Madison Square Garden, New York',
      },
    ];
    const events = [
      {
        id: 'event-1',
        title: 'Knicks at Nets',
        date: '2026-07-01T20:20:00.000Z',
        location: 'Madison Square Garden',
      },
      {
        id: 'event-2',
        title: 'Liberty vs Aces',
        date: '2026-07-01T20:20:00.000Z',
        location: 'Barclays Center',
      },
    ];

    expect(filterProEventsAlreadyRepresentedByGames(games, events).map(event => event.id)).toEqual([
      'event-2',
    ]);
  });

  it('keeps events that cannot produce a stable matchup signature', () => {
    expect(
      filterProEventsAlreadyRepresentedByGames(
        [{ id: 'game-1', title: 'Team A vs Team B', date: 'bad', location: 'Arena' }],
        [{ id: 'event-1', title: 'Showcase', date: 'bad', location: '' }]
      )
    ).toHaveLength(1);
  });
});
