import type { ProLeague } from '@prisma/client';
import { LIVE_WINDOW_HOURS_BY_LEAGUE, type ProFixture } from './types.js';

/**
 * Pure fixture -> Event-shape resolution.
 *
 * Split out from the DB write so the interesting decisions (which venue wins,
 * how a title is derived, what a cancellation means) are testable without a
 * database, and so a provider change cannot quietly alter them.
 */

export type ProTeamVenue = {
  id: string;
  external_ref: string;
  name: string;
  short_name: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  timezone: string | null;
};

export type ResolvedFixture = {
  pro_external_ref: string;
  title: string;
  date: Date;
  timezone: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  pro_home_team_id: string | null;
  pro_away_team_id: string | null;
  live_window_hours_after_start: number;
  status: 'approved' | 'cancelled';
};

export type ResolveFailure =
  | { code: 'UNKNOWN_HOME_TEAM'; ref: string }
  | { code: 'UNKNOWN_AWAY_TEAM'; ref: string }
  | { code: 'NO_VENUE_COORDS' }
  | { code: 'NO_TITLE' };

export type ResolveResult =
  | { ok: true; value: ResolvedFixture }
  | { ok: false; error: ResolveFailure };

/** "Boston Celtics at Los Angeles Lakers" reads worse than the short form. */
function deriveTitle(home: ProTeamVenue | null, away: ProTeamVenue | null): string | null {
  if (home && away) return `${away.short_name} at ${home.short_name}`;
  if (home) return home.name;
  if (away) return away.name;
  return null;
}

function joinLocation(name: string | null, address: string | null): string | null {
  if (name && address) return `${name}, ${address}`;
  return name ?? address ?? null;
}

export function resolveFixture(
  fixture: ProFixture,
  teamsByRef: ReadonlyMap<string, ProTeamVenue>
): ResolveResult {
  // An unknown team ref means our seed is stale. Inventing a ProTeam here would
  // put an unreviewed franchise name into the trademark surface with no human
  // in the loop, so this fails loudly instead.
  const home = fixture.home_team_ref ? (teamsByRef.get(fixture.home_team_ref) ?? null) : null;
  if (fixture.home_team_ref && !home) {
    return { ok: false, error: { code: 'UNKNOWN_HOME_TEAM', ref: fixture.home_team_ref } };
  }

  const away = fixture.away_team_ref ? (teamsByRef.get(fixture.away_team_ref) ?? null) : null;
  if (fixture.away_team_ref && !away) {
    return { ok: false, error: { code: 'UNKNOWN_AWAY_TEAM', ref: fixture.away_team_ref } };
  }

  const title = fixture.title?.trim() || deriveTitle(home, away);
  if (!title) return { ok: false, error: { code: 'NO_TITLE' } };

  // Provider venue wins over the home team's stadium. Neutral-site games,
  // international series, and relocations all arrive this way, and pinning
  // those to the home venue would silently block every fan at the real one.
  const hasFixtureCoords =
    typeof fixture.venue_lat === 'number' && typeof fixture.venue_lng === 'number';

  const latitude = hasFixtureCoords ? fixture.venue_lat! : (home?.venue_lat ?? null);
  const longitude = hasFixtureCoords ? fixture.venue_lng! : (home?.venue_lng ?? null);

  const venueName = hasFixtureCoords
    ? (fixture.venue_name ?? null)
    : (fixture.venue_name ?? home?.venue_name ?? null);
  const venueAddress = hasFixtureCoords
    ? (fixture.venue_address ?? null)
    : (fixture.venue_address ?? home?.venue_address ?? null);

  // Without coordinates the geofence can never pass, so the event page would be
  // permanently unpostable. Better to skip and report than to publish a page
  // that silently rejects everyone who shows up.
  if (latitude === null || longitude === null) {
    return { ok: false, error: { code: 'NO_VENUE_COORDS' } };
  }

  return {
    ok: true,
    value: {
      pro_external_ref: fixture.external_ref,
      title,
      date: fixture.starts_at,
      timezone: fixture.timezone ?? home?.timezone ?? null,
      location: joinLocation(venueName, venueAddress),
      latitude,
      longitude,
      pro_home_team_id: home?.id ?? null,
      pro_away_team_id: away?.id ?? null,
      live_window_hours_after_start: liveWindowFor(fixture.league),
      // Postponed keeps the page live — the date simply moves, and fans who
      // already posted keep their unlock. Only an outright cancellation closes
      // it, and even then the row is updated rather than deleted so existing
      // posts survive.
      status: fixture.status === 'cancelled' ? 'cancelled' : 'approved',
    },
  };
}

export function liveWindowFor(league: ProLeague): number {
  return LIVE_WINDOW_HOURS_BY_LEAGUE[league];
}
