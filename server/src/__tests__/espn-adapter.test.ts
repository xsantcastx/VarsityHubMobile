import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { espnAdapter, ESPN_LEAGUES } from '../lib/proSchedule/espnAdapter.js';
import { resolveProTeamRef } from '../lib/proSchedule/resolveProTeamRef.js';

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
    const parsed = adapter.__parseScoreboard!('wnba', bad, new Date('2000-01-01'), new Date('2100-01-01'));
    expect(parsed[0].home_team_ref).toBe('wnba:atlanta-dream');
    expect(parsed[0].away_team_ref).toBeNull();
  });
});

describe('espnAdapter coverage', () => {
  it('serves the four ESPN league sports, not WWE', () => {
    expect(ESPN_LEAGUES.sort()).toEqual(['mlb', 'nba', 'nfl', 'wnba']);
    expect(ESPN_LEAGUES).not.toContain('wwe');
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
