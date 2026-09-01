import { buildMapDiscoveryPath, toMapEvents, buildRecentDateButtons } from '../mapDiscovery';
import type { EventCard } from '@/api/schemas/eventCard';

describe('buildMapDiscoveryPath', () => {
  it('targets the event-discovery map surface', () => {
    const path = buildMapDiscoveryPath();
    expect(path.startsWith('/event-discovery?')).toBe(true);
    expect(path).toContain('surface=map');
  });

  it('never adds location or pro-only data gates (feed map = all event pages)', () => {
    const path = buildMapDiscoveryPath();
    // These params would scope the dataset down; the feed map must show ALL
    // public event pages nationwide, so none of them may appear.
    expect(path).not.toMatch(/[?&]lat=/);
    expect(path).not.toMatch(/[?&]lng=/);
    expect(path).not.toMatch(/[?&]radius=/);
    expect(path).not.toMatch(/pro_only/);
    expect(path).not.toMatch(/pro_league/);
    expect(path).not.toMatch(/following/);
  });

  it('carries a bounded limit', () => {
    expect(buildMapDiscoveryPath(250)).toContain('limit=250');
    expect(buildMapDiscoveryPath()).toMatch(/limit=\d+/);
  });
});

describe('toMapEvents', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');

  const items: EventCard[] = [
    {
      id: 'game-1',
      source_type: 'game',
      event_id: 'ev-1',
      game_id: 'game-1',
      title: 'Varsity Final',
      date: '2026-09-02T20:00:00.000Z',
      location: 'Main Field',
      latitude: 40,
      longitude: -73,
      sport: 'football',
    },
    {
      id: 'event-only',
      source_type: 'event',
      event_id: 'event-only',
      game_id: null,
      title: 'NCAA Fixture',
      date: '2026-09-03T00:00:00.000Z',
      location: 'Arena',
      latitude: 41,
      longitude: -74,
      sport: 'basketball',
    },
    {
      id: 'no-coords',
      source_type: 'event',
      event_id: 'no-coords',
      game_id: null,
      title: 'Somewhere Unknown',
      date: '2026-09-03T00:00:00.000Z',
      location: null,
      latitude: null,
      longitude: null,
      sport: 'soccer',
    },
  ];

  it('maps source_type to the map marker type and preserves routing id', () => {
    const events = toMapEvents(items, now);
    expect(events[0]).toMatchObject({
      id: 'game-1',
      title: 'Varsity Final',
      latitude: 40,
      longitude: -73,
      type: 'game',
      sport: 'football',
    });
    const eventOnly = events.find(e => e.id === 'event-only');
    expect(eventOnly?.type).toBe('event');
  });

  it('keeps NCAA event-only cards with coordinates as map markers', () => {
    const events = toMapEvents(
      [
        {
          id: 'ncaa-1',
          source_type: 'event',
          event_id: 'ncaa-1',
          game_id: null,
          title: 'UMass at Rutgers',
          date: '2026-09-03T22:00:00.000Z',
          location: 'SHI Stadium',
          latitude: 40.5136111,
          longitude: -74.4652778,
          sport: 'football',
          pro_league: 'ncaaf',
        },
      ],
      now
    );

    expect(events).toEqual([
      expect.objectContaining({
        id: 'ncaa-1',
        title: 'UMass at Rutgers',
        type: 'event',
        sport: 'football',
        latitude: 40.5136111,
        longitude: -74.4652778,
      }),
    ]);
  });

  it('drops items without coordinates', () => {
    const events = toMapEvents(items, now);
    expect(events.some(e => e.id === 'no-coords')).toBe(false);
  });

  it('keeps coordinate-less events when requireCoords is false (calendar dataset)', () => {
    const events = toMapEvents(items, now, { requireCoords: false });
    // The calendar summarizes ALL event pages, including ones with no location.
    expect(events.some(e => e.id === 'no-coords')).toBe(true);
    // But still future-only.
    expect(events.every(e => e.date >= now.toISOString().split('T')[0])).toBe(true);
  });

  it('drops past events so the map only shows what is still upcoming', () => {
    const withPast: EventCard[] = [
      ...items,
      {
        id: 'past-game',
        source_type: 'game',
        event_id: 'ev-past',
        game_id: 'past-game',
        title: 'Yesterday',
        date: '2026-08-30T00:00:00.000Z',
        location: 'Old Field',
        latitude: 40,
        longitude: -73,
        sport: 'football',
      },
    ];
    const events = toMapEvents(withPast, now);
    expect(events.some(e => e.id === 'past-game')).toBe(false);
  });
});

describe('buildRecentDateButtons', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');

  // Mirror the production key derivation so assertions are timezone-independent
  // (the helper keys off local midnight, then ISO-date — same as here).
  const keyForOffset = (days: number): string => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  it('ends today and shows the last 7 days', () => {
    const buttons = buildRecentDateButtons([], now, 7);
    expect(buttons).toHaveLength(7);
    expect(buttons[0].dateString).toBe(keyForOffset(-6));
    expect(buttons[6].dateString).toBe(keyForOffset(0)); // today
    expect(buttons.every(b => b.dateString <= keyForOffset(0))).toBe(true);
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i].dateString > buttons[i - 1].dateString).toBe(true);
    }
  });

  it('counts events that fall on each recent day', () => {
    // Anchor each event to a button's own day + midday so the mapping holds in
    // any timezone the runner uses.
    const buttons0 = buildRecentDateButtons([], now, 7);
    const events = [
      {
        id: 'a',
        title: 'A',
        date: `${buttons0[0].dateString}T18:00:00.000Z`,
        type: 'event' as const,
      },
      {
        id: 'b',
        title: 'B',
        date: `${buttons0[0].dateString}T20:00:00.000Z`,
        type: 'game' as const,
      },
      {
        id: 'c',
        title: 'C',
        date: `${buttons0[2].dateString}T18:00:00.000Z`,
        type: 'event' as const,
      },
    ];
    const buttons = buildRecentDateButtons(events, now, 7);
    expect(buttons[0].count).toBe(2);
    expect(buttons[2].count).toBe(1);
    expect(buttons[1].count).toBe(0);
  });
});
