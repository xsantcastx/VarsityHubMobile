/**
 * Best-effort venue geocoding for touring events (WWE), where every show is at a
 * different arena and the feed carries no coordinates.
 *
 * Uses the app's Google Maps geocoder first (same provider as user-created map
 * events), then OpenStreetMap Nominatim as a no-key fallback. Results are cached
 * per process so a repeated venue in one run costs one request. On any failure
 * it returns null — the caller leaves coords null and resolveFixture quarantines
 * that event rather than guessing a location. Never throws.
 */

import { geocodeLocation } from '../geocoding.js';

export type LatLng = { lat: number; lng: number };
export type GeocodeFn = (query: string) => Promise<LatLng | null>;

const cache = new Map<string, LatLng | null>();

export async function geocodeVenue(query: string): Promise<LatLng | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const google = await geocodeLocation(query);
    if (google) {
      const result: LatLng = { lat: google.latitude, lng: google.longitude };
      cache.set(key, result);
      return result;
    }

    const url =
      'https://nominatim.openstreetmap.org/search?' +
      new URLSearchParams({ q: query, format: 'json', limit: '1' }).toString();
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VarsityHub/1.0 (pro-schedule ingest)' },
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = rows[0];
    if (!first?.lat || !first?.lon) {
      cache.set(key, null);
      return null;
    }
    const result: LatLng = { lat: Number(first.lat), lng: Number(first.lon) };
    const ok = Number.isFinite(result.lat) && Number.isFinite(result.lng);
    cache.set(key, ok ? result : null);
    return ok ? result : null;
  } catch {
    cache.set(key, null);
    return null;
  }
}
