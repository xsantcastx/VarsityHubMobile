import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { espnAdapter, ESPN_LEAGUES } from '../lib/proSchedule/espnAdapter.js';
import { resolveProTeamRef } from '../lib/proSchedule/resolveProTeamRef.js';
import { resolveFixture } from '../lib/proSchedule/resolveFixture.js';

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/espn-wnba-sample.json', import.meta.url)), 'utf8')
);

const adapter = espnAdapter();
const parse = (from: Date, to: Date) => adapter.__parseScoreboard!('wnba', sample, from, to);

describe('espnAdapter parser', () => {
  it('maps a scoreboard game to a normalized fixture with resolved team refs', () => {
    const all = parse(new Date('2000-01-01'), new Date('2100-01-01'));
    expect(all.length).toBe(sample.events.length);
    const g = all[0];
    expect(g.league).toBe('wnba');
    expect(g.external_ref).toMatch(/^wnba:\d+$/);
    expect(g.home_team_ref).toMatch(/^wnba:/);
    expect(g.away_team_ref).toMatch(/^wnba:/);
    expect(g.starts_at).toBeInstanceOf(Date);
    expect(g.venue_lat).toBeNull(); // ESPN has none — resolveFixture falls back to the home stadium
  });

  it('filters to the [from, to] window', () => {
    const all = parse(new Date('2000-01-01'), new Date('2100-01-01'));
    const none = parse(new Date('2000-01-01'), new Date('2000-01-02'));
    expect(all.length).toBeGreaterThan(0);
    expect(none.length).toBe(0);
  });

  it('leaves an unmapped team ref null so ingest quarantines it', () => {
    const bad = {
      events: [
        {
          id: '999',
          date: '2026-07-31T23:30Z',
          competitions: [
            {
              venue: { fullName: 'Nowhere Arena' },
              status: { type: { name: 'STATUS_SCHEDULED' } },
              competitors: [
                { homeAway: 'home', team: { displayName: 'Atlanta Dream' } },
                { homeAway: 'away', team: { displayName: 'Springfield Isotopes' } },
              ],
            },
          ],
        },
      ],
    };
    const parsed = adapter.__parseScoreboard!(
      'wnba',
      bad,
      new Date('2000-01-01'),
      new Date('2100-01-01')
    );
    expect(parsed[0].home_team_ref).toBe('wnba:atlanta-dream');
    expect(parsed[0].away_team_ref).toBeNull();
  });
});

describe('neutral-site detection', () => {
  const neutralSample = {
    events: [
      {
        id: '555',
        date: '2026-09-13T14:30Z',
        competitions: [
          {
            venue: {
              fullName: 'Wembley Stadium',
              address: { city: 'London', country: 'England' },
            },
            status: { type: { name: 'STATUS_SCHEDULED' } },
            competitors: [
              // Home team is real, but the game is at Wembley, not their stadium.
              { homeAway: 'home', team: { displayName: 'Atlanta Dream' } },
              { homeAway: 'away', team: { displayName: 'Seattle Storm' } },
            ],
          },
        ],
      },
    ],
  };

  it('flags a game away from the home stadium as neutral and sets a geocode query', () => {
    const [g] = adapter.__parseScoreboard!(
      'wnba',
      neutralSample,
      new Date('2000-01-01'),
      new Date('2100-01-01')
    );
    expect(g.venue_is_neutral).toBe(true);
    expect(g._geocodeQuery).toContain('Wembley Stadium');
    expect(g._geocodeQuery).toContain('London');
  });

  it('does NOT flag a normal home game as neutral', () => {
    // The WNBA sample's games are at home venues.
    const home = adapter.__parseScoreboard!(
      'wnba',
      sample,
      new Date('2000-01-01'),
      new Date('2100-01-01')
    );
    expect(home.every(g => g.venue_is_neutral === false)).toBe(true);
    expect(home.every(g => g._geocodeQuery === null)).toBe(true);
  });
});

describe('resolveFixture neutral-site safety', () => {
  const home = {
    id: 'wnba:atlanta-dream',
    external_ref: 'wnba:atlanta-dream',
    name: 'Atlanta Dream',
    short_name: 'Dream',
    venue_name: 'Gateway Center Arena',
    venue_address: null,
    venue_lat: 33.65,
    venue_lng: -84.45,
    timezone: null,
  };
  const byRef = new Map([[home.external_ref, home]]);

  it('quarantines a neutral game that has no coords instead of pinning it to the home stadium', () => {
    // A London game with no geocoded coords must NOT inherit Atlanta's geofence.
    const r = resolveFixture(
      {
        external_ref: 'wnba:x',
        league: 'wnba',
        starts_at: new Date('2026-09-13T14:30Z'),
        home_team_ref: 'wnba:atlanta-dream',
        away_team_ref: null,
        venue_name: 'Wembley Stadium',
        venue_is_neutral: true,
        venue_lat: null,
        venue_lng: null,
        status: 'scheduled',
      },
      byRef
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_VENUE_COORDS');
  });

  it('still uses the home stadium for an ordinary home game (neutral flag false)', () => {
    const r = resolveFixture(
      {
        external_ref: 'wnba:y',
        league: 'wnba',
        starts_at: new Date('2026-09-13T14:30Z'),
        home_team_ref: 'wnba:atlanta-dream',
        away_team_ref: null,
        venue_name: null,
        venue_is_neutral: false,
        venue_lat: null,
        venue_lng: null,
        status: 'scheduled',
      },
      byRef
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.latitude).toBeCloseTo(33.65, 2);
      expect(r.value.longitude).toBeCloseTo(-84.45, 2);
    }
  });
});

describe('espnAdapter coverage', () => {
  it('serves the four ESPN league sports, not WWE', () => {
    expect(ESPN_LEAGUES.sort()).toEqual(['mlb', 'nba', 'nfl', 'wnba']);
    expect(ESPN_LEAGUES).not.toContain('wwe');
  });

  it('does not filter out NFL preseason games', () => {
    const preseason = {
      events: [
        {
          id: 'p1',
          date: '2026-08-13T00:00:00Z',
          competitions: [
            {
              season: { type: { name: 'PRESEASON' }, displayName: 'Preseason' },
              status: { type: { name: 'STATUS_SCHEDULED' } },
              venue: { fullName: 'Arrowhead Stadium' },
              competitors: [
                { homeAway: 'home', team: { displayName: 'Kansas City Chiefs' } },
                { homeAway: 'away', team: { displayName: 'Chicago Bears' } },
              ],
            },
          ],
        },
      ],
    };
    const parsed = adapter.__parseScoreboard!(
      'nfl',
      preseason,
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-31T23:59:59Z')
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].home_team_ref).toBe('nfl:kansas-city-chiefs');
    expect(parsed[0].away_team_ref).toBe('nfl:chicago-bears');
  });
});

describe('resolveProTeamRef', () => {
  it('resolves current teams and rejects unknowns', () => {
    expect(resolveProTeamRef('wnba', 'Seattle Storm')).toBe('wnba:seattle-storm');
    expect(resolveProTeamRef('nfl', 'Kansas City Chiefs')).toBe('nfl:kansas-city-chiefs');
    expect(resolveProTeamRef('nfl', 'Oakland Raiders')).toBe('nfl:las-vegas-raiders'); // alias
    expect(resolveProTeamRef('mlb', 'Springfield Isotopes')).toBeNull();
  });
});
