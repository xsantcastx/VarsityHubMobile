import type { LatLng } from './geocodeVenue.js';
import { WWE_FIXTURES_2026 } from './wweSchedule2026.js';

type FallbackInput = {
  venueName?: string | null;
  city?: string | null;
  country?: string | null;
};

const MANUAL_FALLBACKS: Array<FallbackInput & LatLng> = [
  // verify: SummerSlam sample fixture venue
  { venueName: 'U.S. Bank Stadium', city: 'Minneapolis', country: 'United States', lat: 44.9737, lng: -93.2577 },
];

const byVenueAndCity = new Map<string, LatLng>();
const byVenue = new Map<string, LatLng>();

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCity(value: string | null | undefined): string {
  const raw = normalizeToken(value);
  // TheSportsDB often emits "City, State" for US venues; key by city only.
  return raw.split(',')[0]?.trim() ?? raw;
}

function venueCityKey(venueName: string, city: string): string {
  return `${normalizeToken(venueName)}|${normalizeCity(city)}`;
}

function venueKey(venueName: string): string {
  return normalizeToken(venueName);
}

function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const first = address.split(',')[0]?.trim();
  return first || null;
}

function putFallback(venueName: string | null | undefined, city: string | null | undefined, coords: LatLng) {
  const v = venueName?.trim();
  if (!v) return;
  const vKey = venueKey(v);
  if (vKey) byVenue.set(vKey, coords);

  const c = city?.trim();
  if (c) {
    const vcKey = venueCityKey(v, c);
    byVenueAndCity.set(vcKey, coords);
  }
}

// Seed from the curated WWE schedule that already carries verified venue coords.
for (const fixture of WWE_FIXTURES_2026) {
  if (typeof fixture.venue_lat !== 'number' || typeof fixture.venue_lng !== 'number') continue;
  putFallback(fixture.venue_name, extractCityFromAddress(fixture.venue_address), {
    lat: fixture.venue_lat,
    lng: fixture.venue_lng,
  });
}

// Manual rows cover known venues not present in the current curated range.
for (const row of MANUAL_FALLBACKS) {
  putFallback(row.venueName, row.city, { lat: row.lat, lng: row.lng });
}

export function resolveWweVenueFallback(input: FallbackInput): LatLng | null {
  const venue = input.venueName?.trim();
  if (!venue) return null;

  const city = input.city?.trim() || input.country?.trim() || null;
  if (city) {
    const exact = byVenueAndCity.get(venueCityKey(venue, city));
    if (exact) return exact;
  }

  return byVenue.get(venueKey(venue)) ?? null;
}

export function resolveWweVenueFallbackFromLocation(location: string | null | undefined): LatLng | null {
  if (!location) return null;
  const parts = location.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const venueName = parts[0] || null;
  const city = parts[1] || null;
  return resolveWweVenueFallback({ venueName, city });
}
