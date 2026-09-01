import { eventCardSchema, validateEventCards, type EventCard } from '../eventCard';

// Mirrors the server's /event-discovery serialized items
// (server/src/__tests__/event-discovery-contract.test.ts shape).
const SERVER_GAME_ITEM = {
  id: 'game-1',
  source_type: 'game',
  event_id: 'event-linked',
  game_id: 'game-1',
  title: 'Varsity Final',
  date: '2026-08-31T20:00:00.000Z',
  location: 'Main Field',
  latitude: 40,
  longitude: -73,
  sport: 'football',
  status: null,
  banner_url: null,
  pro_home_color: null,
  pro_away_color: null,
  pro_league: null,
  venue_photo: null,
  map_visibility: {
    visible: true,
    reason_code: null,
    surface_window: { from: '2026-08-31T12:00:00.000Z', to: '2026-09-05T12:00:00.000Z' },
  },
  feed_priority: 2,
  live_window: { state: 'live' },
  posting_capabilities: { window_state: 'live', geofence_radius_km: 3 },
};

const SERVER_EVENT_ITEM = {
  id: 'event-only',
  source_type: 'event',
  event_id: 'event-only',
  game_id: null,
  title: 'NCAA Fixture',
  date: '2026-09-01T00:00:00.000Z',
  location: 'Arena',
  latitude: 41,
  longitude: -74,
  sport: 'basketball',
  status: 'published',
  banner_url: null,
  pro_home_color: '#123456',
  pro_away_color: null,
  pro_league: 'ncaamb',
  venue_photo: null,
  map_visibility: {
    visible: true,
    reason_code: null,
    surface_window: { from: '2026-08-31T12:00:00.000Z', to: '2026-09-05T12:00:00.000Z' },
  },
  feed_priority: 3,
  live_window: null,
  posting_capabilities: { window_state: 'closed', geofence_radius_km: 3 },
};

describe('eventCardSchema', () => {
  it('accepts real server-shaped game and event items (client<->server contract)', () => {
    expect(eventCardSchema.safeParse(SERVER_GAME_ITEM).success).toBe(true);
    expect(eventCardSchema.safeParse(SERVER_EVENT_ITEM).success).toBe(true);
  });

  it('requires id and a valid source_type', () => {
    expect(eventCardSchema.safeParse({ ...SERVER_GAME_ITEM, id: undefined }).success).toBe(false);
    expect(eventCardSchema.safeParse({ ...SERVER_GAME_ITEM, source_type: 'post' }).success).toBe(
      false
    );
  });

  it('tolerates unknown extra fields and nullable optionals (lenient)', () => {
    const withExtra = { ...SERVER_EVENT_ITEM, brand_new_server_field: 'x', location: null };
    const parsed = eventCardSchema.safeParse(withExtra);
    expect(parsed.success).toBe(true);
  });
});

describe('validateEventCards', () => {
  it('returns the items from a well-formed wrapper', () => {
    const cards = validateEventCards('/event-discovery?surface=map', {
      items: [SERVER_GAME_ITEM, SERVER_EVENT_ITEM],
      surface: 'map',
    });
    expect(cards.map((c: EventCard) => c.id)).toEqual(['game-1', 'event-only']);
  });

  it('accepts a bare array payload too', () => {
    const cards = validateEventCards('/x', [SERVER_GAME_ITEM]);
    expect(cards).toHaveLength(1);
  });

  it('drops only the malformed item and keeps the valid ones (per-item resilience)', () => {
    const cards = validateEventCards('/x', {
      items: [SERVER_GAME_ITEM, { source_type: 'game' /* no id */ }, SERVER_EVENT_ITEM],
    });
    expect(cards.map(c => c.id)).toEqual(['game-1', 'event-only']);
  });

  it('returns [] (never throws) on a malformed wrapper', () => {
    expect(validateEventCards('/x', null)).toEqual([]);
    expect(validateEventCards('/x', { items: 'not-an-array' })).toEqual([]);
    expect(validateEventCards('/x', 42)).toEqual([]);
  });
});
