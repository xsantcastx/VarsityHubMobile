import { httpPost } from './http';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

type CacheEntry = { value: GeocodingResult; timestamp: number };
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const geocodeCache = new Map<string, CacheEntry>();

/**
 * Geocode a human-readable location (ZIP, address, etc.) via the backend proxy.
 * Results are cached briefly in-memory to avoid spamming the API when the user edits the input.
 */
export async function geocodeLocation(location: string): Promise<GeocodingResult | null> {
  const trimmed = location.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  const cached = geocodeCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const result = (await httpPost('/geocoding/location', { location: trimmed })) as GeocodingResult | null;
  if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
    return null;
  }

  geocodeCache.set(normalized, { value: result, timestamp: Date.now() });
  return result;
}

export function clearGeocodeCache() {
  geocodeCache.clear();
}
