import type { ProLeague } from '@prisma/client';
import { geocodeVenue, type GeocodeFn } from './geocodeVenue.js';
import type { ProFixture, ProScheduleAdapter } from './types.js';
import { resolveWweVenueFallback } from './wweVenueFallbacks.js';

/**
 * WWE schedule adapter (TheSportsDB league 4444).
 *
 * WWE is a touring promotion: no home/away teams, a different venue every show.
 * Fixtures are emitted teamless (the ingester's attachTouringPromotion pins them
 * to the seeded WWE promotion) with a geocoded venue, since the feed has no
 * coordinates. A venue that can't be geocoded is left coord-less and quarantined
 * downstream — accurate by refusal.
 *
 * Free TheSportsDB key ('3') returns only the next event; a Patreon key returns
 * the full slate. Same adapter either way — set PRO_SCHEDULE_TSDB_KEY.
 */

const TSDB_WWE_LEAGUE_ID = '4444';

type TsdbWweEvent = {
  idEvent: string;
  strEvent?: string;
  dateEvent?: string;
  strTimestamp?: string | null;
  strVenue?: string | null;
  strCity?: string | null;
  strCountry?: string | null;
  strStatus?: string | null;
};

/** A parsed fixture before geocoding (venue known, coords still null). */
export type WwePreGeocode = ProFixture & {
  _venueQuery: string | null;
  _venueName: string | null;
  _venueCity: string | null;
  _venueCountry: string | null;
};

type WweAdapter = ProScheduleAdapter & {
  /** Test-only pure parser (no network, no geocode). */
  __parseEvents?: (raw: unknown, from: Date, to: Date) => WwePreGeocode[];
};

function venueQuery(e: TsdbWweEvent): string | null {
  const parts = [e.strVenue, e.strCity, e.strCountry].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function parseWweEvents(raw: unknown, from: Date, to: Date): WwePreGeocode[] {
  const events = (raw as { events?: TsdbWweEvent[] })?.events;
  if (!Array.isArray(events)) return [];

  const out: WwePreGeocode[] = [];
  for (const e of events) {
    const startsAt = e.strTimestamp
      ? new Date(e.strTimestamp)
      : new Date(`${e.dateEvent ?? ''}T00:00:00Z`);
    if (Number.isNaN(startsAt.getTime())) continue;
    if (startsAt < from || startsAt > to) continue;

    const status: ProFixture['status'] = (e.strStatus ?? '').toLowerCase().includes('cancel')
      ? 'cancelled'
      : (e.strStatus ?? '').toLowerCase().includes('postpon')
        ? 'postponed'
        : 'scheduled';

    out.push({
      external_ref: `wwe:${e.idEvent}`,
      league: 'wwe',
      starts_at: startsAt,
      home_team_ref: null, // teamless — attachTouringPromotion pins the WWE promotion
      away_team_ref: null,
      title: e.strEvent?.trim() || 'WWE Event',
      venue_name: e.strVenue ?? null,
      venue_lat: null,
      venue_lng: null,
      status,
      _venueQuery: venueQuery(e),
      _venueName: e.strVenue ?? null,
      _venueCity: e.strCity ?? null,
      _venueCountry: e.strCountry ?? null,
    });
  }
  return out;
}

export function wweAdapter(
  apiKey: string = process.env.PRO_SCHEDULE_TSDB_KEY || '3',
  geocode: GeocodeFn = geocodeVenue
): WweAdapter {
  return {
    name: 'thesportsdb:wwe',
    leagues: ['wwe'] as const,
    __parseEvents: parseWweEvents,
    async fetchFixtures(league: ProLeague, from: Date, to: Date): Promise<ProFixture[]> {
      if (league !== 'wwe') return [];
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsnextleague.php?id=${TSDB_WWE_LEAGUE_ID}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[wwe] ${res.status} for ${url}`);
      const parsed = parseWweEvents(await res.json(), from, to);

      const fixtures: ProFixture[] = [];
      for (const p of parsed) {
        const { _venueQuery, _venueName, _venueCity, _venueCountry, ...fixture } = p;
        let coords = null;
        if (_venueQuery) {
          coords = await geocode(_venueQuery);
        }
        if (!coords) {
          coords = resolveWweVenueFallback({
            venueName: _venueName,
            city: _venueCity,
            country: _venueCountry,
          });
        }
        if (coords) {
          fixture.venue_lat = coords.lat;
          fixture.venue_lng = coords.lng;
        }
        fixtures.push(fixture);
      }
      return fixtures;
    },
  };
}
