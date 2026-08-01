import type { ProLeague } from '@prisma/client';
import { resolveProTeamRef } from './resolveProTeamRef.js';
import type { ProFixture, ProScheduleAdapter } from './types.js';

/**
 * ESPN public scoreboard adapter.
 *
 * Covers the four league sports ESPN serves (NFL/NBA/WNBA/MLB) via one
 * date-range call per league. WWE is a touring promotion ESPN does not carry —
 * it is intentionally excluded and needs its own source.
 *
 * ESPN provides no venue coordinates, so fixtures carry a null lat/lng and
 * resolveFixture falls back to the home team's seeded stadium. A neutral-site
 * game (venue != home stadium) with no coords is quarantined by resolveFixture
 * (NO_VENUE_COORDS) rather than pinned to the wrong city — accurate by refusal.
 */

const ESPN_PATH: Partial<Record<ProLeague, string>> = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  wnba: 'basketball/wnba',
  mlb: 'baseball/mlb',
};

export const ESPN_LEAGUES = Object.keys(ESPN_PATH) as ProLeague[];

type EspnCompetitor = { homeAway: 'home' | 'away'; team?: { displayName?: string } };
type EspnEvent = {
  id: string;
  date: string;
  competitions?: Array<{
    venue?: { fullName?: string };
    status?: { type?: { name?: string } };
    competitors?: EspnCompetitor[];
  }>;
};

type EspnAdapter = ProScheduleAdapter & {
  /** Test-only pure parser so tests never hit the network. */
  __parseScoreboard?: (league: ProLeague, raw: unknown, from: Date, to: Date) => ProFixture[];
};

/** ESPN status type name → our fixture status. Future-window games are scheduled. */
function mapStatus(name?: string): ProFixture['status'] {
  const n = (name ?? '').toUpperCase();
  if (n.includes('CANCEL')) return 'cancelled';
  if (n.includes('POSTPON')) return 'postponed';
  return 'scheduled';
}

/** UTC yyyymmdd for ESPN's `dates=START-END` range param. */
function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseScoreboard(league: ProLeague, raw: unknown, from: Date, to: Date): ProFixture[] {
  const events = (raw as { events?: EspnEvent[] })?.events;
  if (!Array.isArray(events)) return [];

  const out: ProFixture[] = [];
  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const startsAt = new Date(e.date);
    if (Number.isNaN(startsAt.getTime())) continue;
    if (startsAt < from || startsAt > to) continue;

    const home = comp.competitors?.find((c) => c.homeAway === 'home')?.team?.displayName ?? null;
    const away = comp.competitors?.find((c) => c.homeAway === 'away')?.team?.displayName ?? null;

    out.push({
      external_ref: `${league}:${e.id}`,
      league,
      starts_at: startsAt,
      home_team_ref: resolveProTeamRef(league, home),
      away_team_ref: resolveProTeamRef(league, away),
      title: null, // resolveFixture derives "Away at Home" from short names
      venue_name: comp.venue?.fullName ?? null,
      venue_lat: null, // ESPN carries none; resolveFixture falls back to the home stadium
      venue_lng: null,
      status: mapStatus(comp.status?.type?.name),
    });
  }
  return out;
}

export function espnAdapter(): EspnAdapter {
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
      return parseScoreboard(league, await res.json(), from, to);
    },
  };
}
