import { describe, expect, it } from '@jest/globals';
import {
  attachTouringPromotion,
  resolveFixture,
  TOURING_LEAGUES,
  type ProTeamVenue,
} from '../lib/proSchedule/resolveFixture.js';
import { LIVE_WINDOW_HOURS_BY_LEAGUE, type ProFixture } from '../lib/proSchedule/types.js';

const lakers: ProTeamVenue = {
  id: 'pt_lakers',
  external_ref: 'nba:los-angeles-lakers',
  name: 'Los Angeles Lakers',
  short_name: 'Lakers',
  venue_name: 'Crypto.com Arena',
  venue_address: '1111 S Figueroa St, Los Angeles, CA 90015',
  venue_lat: 34.043,
  venue_lng: -118.2673,
  timezone: 'America/Los_Angeles',
};

const celtics: ProTeamVenue = {
  id: 'pt_celtics',
  external_ref: 'nba:boston-celtics',
  name: 'Boston Celtics',
  short_name: 'Celtics',
  venue_name: 'TD Garden',
  venue_address: '100 Legends Way, Boston, MA 02114',
  venue_lat: 42.3662,
  venue_lng: -71.0621,
  timezone: 'America/New_York',
};

const wwe: ProTeamVenue = {
  id: 'pt_wwe',
  external_ref: 'wwe:wwe',
  name: 'WWE',
  short_name: 'WWE',
  venue_name: null,
  venue_address: null,
  venue_lat: null,
  venue_lng: null,
  timezone: null,
};

const teams = new Map<string, ProTeamVenue>([
  [lakers.external_ref, lakers],
  [celtics.external_ref, celtics],
  [wwe.external_ref, wwe],
]);

function fixture(over: Partial<ProFixture> = {}): ProFixture {
  return {
    external_ref: 'nba:0022600123',
    league: 'nba',
    starts_at: new Date('2026-11-12T03:30:00.000Z'),
    home_team_ref: lakers.external_ref,
    away_team_ref: celtics.external_ref,
    status: 'scheduled',
    ...over,
  };
}

describe('resolveFixture', () => {
  describe('two-team fixtures', () => {
    it('derives the title from short names in away-at-home order', () => {
      const r = resolveFixture(fixture(), teams);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.title).toBe('Celtics at Lakers');
    });

    it('pins to the home venue when the provider supplies none', () => {
      const r = resolveFixture(fixture(), teams);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.latitude).toBe(34.043);
        expect(r.value.longitude).toBe(-118.2673);
        expect(r.value.location).toContain('Crypto.com Arena');
        expect(r.value.timezone).toBe('America/Los_Angeles');
      }
    });

    it('maps both team ids', () => {
      const r = resolveFixture(fixture(), teams);
      if (r.ok) {
        expect(r.value.pro_home_team_id).toBe('pt_lakers');
        expect(r.value.pro_away_team_id).toBe('pt_celtics');
      }
    });

    it('honours an explicit provider title over the derived one', () => {
      const r = resolveFixture(fixture({ title: 'NBA Christmas Day Showcase' }), teams);
      if (r.ok) expect(r.value.title).toBe('NBA Christmas Day Showcase');
    });
  });

  describe('neutral-site and relocated games', () => {
    // The case that makes provider venue outrank home venue: pinning a London
    // game to the home stadium would block every fan actually at the game.
    it('prefers the provider venue when it supplies coordinates', () => {
      const r = resolveFixture(
        fixture({
          venue_name: 'O2 Arena',
          venue_address: 'Peninsula Square, London SE10 0DX',
          venue_lat: 51.503,
          venue_lng: 0.0032,
          timezone: 'Europe/London',
        }),
        teams
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.latitude).toBe(51.503);
        expect(r.value.longitude).toBe(0.0032);
        expect(r.value.location).toContain('O2 Arena');
        expect(r.value.timezone).toBe('Europe/London');
      }
    });

    it('does not leak the home venue name onto a provider-located fixture', () => {
      const r = resolveFixture(
        fixture({ venue_lat: 51.503, venue_lng: 0.0032, venue_name: null }),
        teams
      );
      // Null, not the home arena: once the provider located the fixture, the
      // home venue is not a valid fallback for any of its fields.
      if (r.ok) expect(r.value.location).toBeNull();
    });
  });

  describe('touring promotions (WWE)', () => {
    it('accepts a fixture with no teams when it carries its own venue', () => {
      const r = resolveFixture(
        {
          external_ref: 'wwe:raw-2026-11-16',
          league: 'wwe',
          starts_at: new Date('2026-11-17T01:00:00.000Z'),
          home_team_ref: null,
          away_team_ref: null,
          title: 'WWE Monday Night Raw',
          venue_name: 'Madison Square Garden',
          venue_lat: 40.7505,
          venue_lng: -73.9934,
          timezone: 'America/New_York',
          status: 'scheduled',
        },
        teams
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.title).toBe('WWE Monday Night Raw');
        expect(r.value.pro_home_team_id).toBeNull();
        expect(r.value.pro_away_team_id).toBeNull();
        expect(r.value.latitude).toBe(40.7505);
      }
    });

    it('rejects a teamless fixture with no venue, which could never geofence', () => {
      const r = resolveFixture(
        {
          external_ref: 'wwe:raw-unknown-venue',
          league: 'wwe',
          starts_at: new Date('2026-11-17T01:00:00.000Z'),
          home_team_ref: null,
          away_team_ref: null,
          title: 'WWE Monday Night Raw',
          status: 'scheduled',
        },
        teams
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('NO_VENUE_COORDS');
    });
  });

  describe('stale seed detection', () => {
    it('fails loudly on an unknown home team rather than inventing one', () => {
      const r = resolveFixture(fixture({ home_team_ref: 'nba:seattle-supersonics' }), teams);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('UNKNOWN_HOME_TEAM');
        if (r.error.code === 'UNKNOWN_HOME_TEAM') {
          expect(r.error.ref).toBe('nba:seattle-supersonics');
        }
      }
    });

    it('fails loudly on an unknown away team too', () => {
      const r = resolveFixture(fixture({ away_team_ref: 'nba:vancouver-grizzlies' }), teams);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('UNKNOWN_AWAY_TEAM');
    });

    it('rejects a fixture whose home team has no coordinates', () => {
      const r = resolveFixture(
        { ...fixture(), league: 'wwe', home_team_ref: wwe.external_ref, away_team_ref: null },
        teams
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('NO_VENUE_COORDS');
    });
  });

  describe('status handling', () => {
    it('keeps a postponed fixture live so existing unlocks survive the move', () => {
      const r = resolveFixture(fixture({ status: 'postponed' }), teams);
      if (r.ok) expect(r.value.status).toBe('approved');
    });

    it('marks a cancelled fixture cancelled rather than dropping it', () => {
      const r = resolveFixture(fixture({ status: 'cancelled' }), teams);
      if (r.ok) expect(r.value.status).toBe('cancelled');
    });
  });

  describe('live posting window', () => {
    it.each([
      ['nfl', 4],
      ['mlb', 4],
      ['wwe', 4],
      ['nba', 4],
      ['wnba', 4],
      ['ncaaf', 4],
      ['ncaamb', 4],
      ['ncaawb', 4],
      ['ncaabaseball', 4],
      ['ncaamhockey', 4],
    ] as const)('sets %s to +%ih after start', (league, hours) => {
      expect(LIVE_WINDOW_HOURS_BY_LEAGUE[league]).toBe(hours);
    });

    it('stamps the league window onto the resolved event', () => {
      const r = resolveFixture(fixture(), teams);
      if (r.ok) expect(r.value.live_window_hours_after_start).toBe(4);
    });
  });

  describe('touring promotions are pinned to their own page', () => {
    // Without this the WWE page queries events by team id, matches nothing,
    // and renders empty forever while the shows exist in the DB.
    const promotionRefs = new Map([['wwe' as const, wwe.external_ref]]);

    it('attaches the promotion as the home side when a show names no teams', () => {
      const show = {
        league: 'wwe' as const,
        home_team_ref: null,
        away_team_ref: null,
      };
      expect(attachTouringPromotion(show, promotionRefs).home_team_ref).toBe('wwe:wwe');
    });

    it('leaves a fixture that already names a team alone', () => {
      const show = {
        league: 'wwe' as const,
        home_team_ref: 'wwe:some-brand',
        away_team_ref: null,
      };
      expect(attachTouringPromotion(show, promotionRefs).home_team_ref).toBe('wwe:some-brand');
    });

    it('never touches a franchise league', () => {
      const game = { league: 'nba' as const, home_team_ref: null, away_team_ref: null };
      expect(attachTouringPromotion(game, new Map()).home_team_ref).toBeNull();
    });

    it('treats only WWE as touring', () => {
      expect([...TOURING_LEAGUES]).toEqual(['wwe']);
    });

    it('resolves to the promotion id once attached, so the page query matches', () => {
      const attached = attachTouringPromotion(
        {
          external_ref: 'wwe:raw-2026-11-16',
          league: 'wwe' as const,
          starts_at: new Date('2026-11-17T01:00:00.000Z'),
          home_team_ref: null,
          away_team_ref: null,
          title: 'WWE Monday Night Raw',
          venue_lat: 40.7505,
          venue_lng: -73.9934,
          status: 'scheduled' as const,
        },
        promotionRefs
      );
      const r = resolveFixture(attached, teams);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.pro_home_team_id).toBe('pt_wwe');
    });
  });

  describe('idempotency key', () => {
    it('carries the provider ref through unchanged, so re-ingest updates in place', () => {
      const r = resolveFixture(fixture(), teams);
      if (r.ok) expect(r.value.pro_external_ref).toBe('nba:0022600123');
    });

    it('is deterministic — the same fixture resolves identically twice', () => {
      const f = fixture();
      const a = resolveFixture(f, teams);
      const b = resolveFixture(f, teams);
      expect(a).toEqual(b);
    });
  });
});
