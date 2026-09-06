import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWweEvents, wweAdapter } from '../lib/proSchedule/wweAdapter.js';
import { ESPN_LEAGUES, espnAdapter } from '../lib/proSchedule/espnAdapter.js';
import { compositeAdapter } from '../lib/proSchedule/compositeAdapter.js';

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/tsdb-wwe-sample.json', import.meta.url)), 'utf8')
);

describe('parseWweEvents', () => {
  it('emits a teamless fixture with a venue query and no coords yet', () => {
    const fx = parseWweEvents(sample, new Date('2000-01-01'), new Date('2100-01-01'));
    expect(fx.length).toBe(sample.events.length);
    const g = fx[0];
    expect(g.league).toBe('wwe');
    expect(g.external_ref).toMatch(/^wwe:\d+$/);
    expect(g.home_team_ref).toBeNull();
    expect(g.away_team_ref).toBeNull();
    expect(g.title).toBeTruthy();
    expect(g.venue_lat).toBeNull();
    expect(g._venueQuery).toContain(sample.events[0].strVenue);
  });

  it('filters to the [from, to] window', () => {
    const none = parseWweEvents(sample, new Date('2000-01-01'), new Date('2000-01-02'));
    expect(none.length).toBe(0);
  });
});

describe('wweAdapter geocoding (injected)', () => {
  it('fills venue coords from the injected geocoder', async () => {
    const stubGeocode = async () => ({ lat: 44.9737, lng: -93.2577 }); // U.S. Bank Stadium
    // Serve the captured sample without network by stubbing fetch.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({ ok: true, json: async () => sample }) as any) as typeof fetch;
    try {
      const fx = await wweAdapter('3', stubGeocode).fetchFixtures(
        'wwe',
        new Date('2000-01-01'),
        new Date('2100-01-01')
      );
      expect(fx[0].venue_lat).toBeCloseTo(44.9737, 3);
      expect(fx[0].venue_lng).toBeCloseTo(-93.2577, 3);
      expect('_venueQuery' in fx[0]).toBe(false); // internal field stripped
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('compositeAdapter', () => {
  it('routes each league to the sub-adapter that serves it', () => {
    const c = compositeAdapter([espnAdapter(), wweAdapter()]);
    expect([...c.leagues].sort()).toEqual([...ESPN_LEAGUES, 'wwe'].sort());
  });
});
