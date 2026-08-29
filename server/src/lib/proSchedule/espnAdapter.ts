import type { ProLeague } from '@prisma/client';
import { geocodeVenue, type GeocodeFn } from './geocodeVenue.js';
import { resolveProTeamRef } from './resolveProTeamRef.js';
import type { ProFixture, ProScheduleAdapter, ProviderTeam } from './types.js';
import { isNcaaLeague } from './types.js';

/**
 * ESPN public scoreboard adapter.
 *
 * Covers ESPN-backed pro and major NCAA league sports via one date-range call
 * per league. WWE is a touring promotion ESPN does not carry — it is
 * intentionally excluded and needs its own source.
 *
 * ESPN provides no venue coordinates. For a HOME game that is fine —
 * resolveFixture falls back to the home team's seeded stadium. But a
 * neutral-site/international game (venue != the home stadium) must NOT inherit
 * the home geofence, or fans in London would be geofenced to Jacksonville. The
 * adapter detects those and geocodes their venue; a venue that won't geocode is
 * left coord-less and quarantined downstream — accurate by refusal.
 */

const ESPN_PATH: Partial<Record<ProLeague, string>> = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  wnba: 'basketball/wnba',
  mlb: 'baseball/mlb',
  ncaaf: 'football/college-football',
  ncaamb: 'basketball/mens-college-basketball',
  ncaawb: 'basketball/womens-college-basketball',
  ncaabaseball: 'baseball/college-baseball',
  ncaamhockey: 'hockey/mens-college-hockey',
};

export const ESPN_LEAGUES = Object.keys(ESPN_PATH) as ProLeague[];

type EspnTeam = {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  location?: string;
  name?: string;
  color?: string;
};
type EspnCompetitor = { homeAway: 'home' | 'away'; team?: EspnTeam };
type EspnEvent = {
  id: string;
  date: string;
  competitions?: Array<{
    venue?: { fullName?: string; address?: { city?: string; state?: string; country?: string } };
    status?: { type?: { name?: string } };
    competitors?: EspnCompetitor[];
  }>;
};

/** A parsed fixture before geocoding; `_geocodeQuery` is set only for neutral-site games. */
export type EspnPreGeocode = ProFixture & { _geocodeQuery: string | null };

type EspnAdapter = ProScheduleAdapter & {
  /** Test-only pure parser (no network, no geocode). */
  __parseScoreboard?: (league: ProLeague, raw: unknown, from: Date, to: Date) => EspnPreGeocode[];
};

/** ESPN status type name → our fixture status. Future-window games are scheduled. */
function mapStatus(name?: string): ProFixture['status'] {
  const n = (name ?? '').toUpperCase();
  if (n.includes('CANCEL')) return 'cancelled';
  if (n.includes('POSTPON')) return 'postponed';
  return 'scheduled';
}

function normalizeColor(color?: string): string | null {
  if (!color) return null;
  const trimmed = color.trim().replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(trimmed) ? `#${trimmed}` : null;
}

function ncaaTeamRef(league: ProLeague, team?: EspnTeam | null): string | null {
  if (!team?.id) return null;
  return `${league}:espn-${team.id}`;
}

function providerTeam(league: ProLeague, team?: EspnTeam | null): ProviderTeam | null {
  const externalRef = ncaaTeamRef(league, team);
  if (!externalRef || !team?.displayName) return null;
  return {
    external_ref: externalRef,
    name: team.displayName,
    short_name: team.shortDisplayName || team.name || team.displayName,
    abbreviation: team.abbreviation ?? null,
    city: team.location ?? null,
    state: null,
    conference: null,
    division: null,
    venue_name: null,
    venue_address: null,
    venue_lat: null,
    venue_lng: null,
    timezone: null,
    primary_color: normalizeColor(team.color),
  };
}

/** UTC yyyymmdd for ESPN's `dates=START-END` range param. */
function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function parseScoreboard(
  league: ProLeague,
  raw: unknown,
  from: Date,
  to: Date
): EspnPreGeocode[] {
  const events = (raw as { events?: EspnEvent[] })?.events;
  if (!Array.isArray(events)) return [];

  const out: EspnPreGeocode[] = [];
  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const startsAt = new Date(e.date);
    if (Number.isNaN(startsAt.getTime())) continue;
    if (startsAt < from || startsAt > to) continue;

    const homeTeam = comp.competitors?.find(c => c.homeAway === 'home')?.team ?? null;
    const awayTeam = comp.competitors?.find(c => c.homeAway === 'away')?.team ?? null;
    const home = homeTeam?.displayName ?? null;
    const away = awayTeam?.displayName ?? null;
    const collegeLeague = isNcaaLeague(league);
    const homeRef = collegeLeague ? ncaaTeamRef(league, homeTeam) : resolveProTeamRef(league, home);
    const awayRef = collegeLeague ? ncaaTeamRef(league, awayTeam) : resolveProTeamRef(league, away);

    const venueName = comp.venue?.fullName ?? null;
    const addr = comp.venue?.address ?? {};

    // Neutral-site (international) detection. ESPN is inconsistent about the
    // country field — NFL stamps "USA" on domestic games, MLB leaves it null —
    // so the reliable signal is "country is set AND it isn't the home nation".
    // That flags only genuinely international games (London, Melbourne, Mexico
    // City…), which are exactly the ones that must not inherit the home
    // stadium's geofence. Toronto's home games read as USA-null domestic, so the
    // Blue Jays are unaffected. (A US team playing IN Canada would geocode via
    // the cache — correct coords, negligible cost.)
    const country = (addr.country ?? '').trim();
    const DOMESTIC = new Set(['usa', 'us', 'united states']);
    const isNeutral = country.length > 0 && !DOMESTIC.has(country.toLowerCase());
    const venueQuery = [venueName, addr.city, addr.state, country].filter(Boolean).join(', ');
    const geocodeQuery = collegeLeague || isNeutral ? venueQuery : null;

    out.push({
      external_ref: `${league}:${e.id}`,
      league,
      starts_at: startsAt,
      home_team_ref: homeRef,
      away_team_ref: awayRef,
      home_team: collegeLeague ? providerTeam(league, homeTeam) : null,
      away_team: collegeLeague ? providerTeam(league, awayTeam) : null,
      title: null, // resolveFixture derives "Away at Home" from short names
      venue_name: venueName,
      venue_address: venueQuery || null,
      venue_lat: null,
      venue_lng: null,
      venue_is_neutral: collegeLeague || isNeutral,
      status: mapStatus(comp.status?.type?.name),
      _geocodeQuery: geocodeQuery,
    });
  }
  return out;
}

export function espnAdapter(geocode: GeocodeFn = geocodeVenue): EspnAdapter {
  return {
    name: 'espn',
    leagues: ESPN_LEAGUES,
    __parseScoreboard: parseScoreboard,
    async fetchFixtures(league: ProLeague, from: Date, to: Date): Promise<ProFixture[]> {
      const path = ESPN_PATH[league];
      if (!path) return []; // e.g. WWE — not served by ESPN
      const url =
        `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard` +
        `?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=1000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[espn] ${res.status} for ${league} (${url})`);
      const parsed = parseScoreboard(league, await res.json(), from, to);

      const fixtures: ProFixture[] = [];
      for (const p of parsed) {
        const { _geocodeQuery, ...fixture } = p;
        if (_geocodeQuery) {
          const coords = await geocode(_geocodeQuery);
          if (coords) {
            fixture.venue_lat = coords.lat;
            fixture.venue_lng = coords.lng;
          }
          // If geocoding fails, coords stay null. For a neutral game the home
          // stadium is the wrong place, so resolveFixture will quarantine it
          // (NO_VENUE_COORDS) rather than publish a wrong geofence.
        }
        fixtures.push(fixture);
      }
      return fixtures;
    },
  };
}
