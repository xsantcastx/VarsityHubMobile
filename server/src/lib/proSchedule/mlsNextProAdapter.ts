import type { ProLeague } from '@prisma/client';
import { resolveProTeamRef } from './resolveProTeamRef.js';
import type { ProFixture, ProScheduleAdapter } from './types.js';

/**
 * MLS NEXT Pro schedule adapter (league Deltatre/Forge feed).
 *
 * ESPN does not carry MLS NEXT Pro — its `usa.1` slug is top-flight MLS — so
 * the only rolling source is the league's own Forge content API. That is a
 * deliberate exception to the "no league-site source" note in adapters.ts, made
 * on the product owner's call; the feed's terms of service are the operative
 * constraint. Schedule facts themselves are not copyrightable (Feist).
 *
 * The feed references clubs and venues by id, so each run also pulls the club
 * and venue dictionaries and joins them in memory. It carries NO coordinates —
 * that is fine for a home game, because resolveFixture falls back to the seeded
 * home-team venue. MLS NEXT Pro plays at home stadiums (no neutral-site slate),
 * so `venue_is_neutral` stays false and the home-venue fallback always applies.
 *
 * Only Regular-season fixtures are ingested; playoffs/invitational/cup are
 * separate competitions and out of scope until seeded.
 */

const FORGE_BASE = 'https://forge-dapi.mnp-prd.deltatre.digital/v2/content/en-us';
const MLS_NEXT_PRO: ProLeague = 'mls_next_pro';

type ForgeItem = { fields?: Record<string, unknown> };
type ForgePage = { items?: ForgeItem[]; pagination?: { nextUrl?: string | null } };

async function fetchAll(endpoint: string): Promise<ForgeItem[]> {
  const out: ForgeItem[] = [];
  let url: string | null = `${FORGE_BASE}/${endpoint}?$top=50`;
  // Bounded: the feed caps at 100 items/collection, and matches paginate in
  // 25s — a hard ceiling stops a malformed nextUrl from looping forever.
  let guard = 0;
  while (url && guard < 200) {
    guard += 1;
    const res: Response = await fetch(url, {
      headers: { 'User-Agent': 'VarsityHub/1.0 (pro-schedule ingest)', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`[mlsNextPro] ${res.status} for ${endpoint} (${url})`);
    const page = (await res.json()) as ForgePage;
    if (Array.isArray(page.items)) out.push(...page.items);
    url = page.pagination?.nextUrl ?? null;
  }
  return out;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** venue sportecId -> "Name, street, city, ST zip" for display (coords come from the seed). */
function buildVenueMap(
  venues: ForgeItem[]
): Map<string, { name: string | null; address: string | null }> {
  const map = new Map<string, { name: string | null; address: string | null }>();
  for (const v of venues) {
    const f = v.fields ?? {};
    const id = str(f.sportecId);
    if (!id) continue;
    const name = str(f.name);
    const addr =
      [str(f.streetAddress), str(f.city), str(f.state), str(f.zipCode)]
        .filter(Boolean)
        .join(', ') || null;
    map.set(id, { name, address: addr });
  }
  return map;
}

/** club sportecId -> club display name (fed to resolveProTeamRef → seeded ref). */
function buildClubMap(clubs: ForgeItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of clubs) {
    const f = c.fields ?? {};
    const id = str(f.sportecId);
    const name = str(f.name);
    if (id && name) map.set(id, name);
  }
  return map;
}

export function parseMatches(
  matches: ForgeItem[],
  clubs: Map<string, string>,
  venues: Map<string, { name: string | null; address: string | null }>,
  from: Date,
  to: Date
): ProFixture[] {
  const out: ProFixture[] = [];
  for (const m of matches) {
    const f = m.fields ?? {};
    if (str(f.matchType) !== 'Regular') continue;
    const dt = str(f.matchDateTime);
    if (!dt) continue;
    const startsAt = new Date(dt);
    if (Number.isNaN(startsAt.getTime())) continue;
    if (startsAt < from || startsAt > to) continue;

    const id = str(f.sportecId) ?? str(f.optaId != null ? String(f.optaId) : null);
    if (!id) continue;

    const homeName = clubs.get(str(f.homeClubSportecId) ?? '') ?? null;
    const awayName = clubs.get(str(f.awayClubSportecId) ?? '') ?? null;
    // resolveProTeamRef returns null for a club not in the seed; resolveFixture
    // then quarantines the fixture (UNKNOWN_*) rather than inventing a team.
    const homeRef = resolveProTeamRef(MLS_NEXT_PRO, homeName);
    const awayRef = resolveProTeamRef(MLS_NEXT_PRO, awayName);

    const venue = venues.get(str(f.venueSportecId) ?? '') ?? { name: null, address: null };

    out.push({
      external_ref: `${MLS_NEXT_PRO}:${id}`,
      league: MLS_NEXT_PRO,
      starts_at: startsAt,
      home_team_ref: homeRef,
      away_team_ref: awayRef,
      title: null, // resolveFixture derives "Away at Home" from seeded short names
      venue_name: venue.name,
      venue_address: venue.address,
      venue_lat: null,
      venue_lng: null,
      // Always a home game — no neutral-site slate — so the seeded home-venue
      // coordinates are correct and the home-venue fallback must stay enabled.
      venue_is_neutral: false,
      status: 'scheduled',
    });
  }
  return out;
}

export function mlsNextProAdapter(): ProScheduleAdapter {
  return {
    name: 'mls-next-pro',
    leagues: [MLS_NEXT_PRO],
    async fetchFixtures(league: ProLeague, from: Date, to: Date): Promise<ProFixture[]> {
      if (league !== MLS_NEXT_PRO) return [];
      const [matches, clubs, venues] = await Promise.all([
        fetchAll('matches'),
        fetchAll('clubs'),
        fetchAll('venues'),
      ]);
      return parseMatches(matches, buildClubMap(clubs), buildVenueMap(venues), from, to);
    },
  };
}
