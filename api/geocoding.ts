import { httpGet, httpPost } from './http';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

export interface PlaceSuggestion {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

type CacheEntry = { value: GeocodingResult; timestamp: number };
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const geocodeCache = new Map<string, CacheEntry>();
const suggestionCache = new Map<string, { timestamp: number; suggestions: PlaceSuggestion[] }>();
const SUGGESTION_TTL_MS = 60 * 1000; // 1 minute

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

export async function autocompleteLocations(query: string, limit: number = 6): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const normalized = trimmed.toLowerCase();
  const cached = suggestionCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < SUGGESTION_TTL_MS) {
    return cached.suggestions.slice(0, limit);
  }

  try {
    const res: any = await httpGet(`/geocoding/autocomplete?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
    const suggestions: PlaceSuggestion[] = Array.isArray(res?.suggestions) ? res.suggestions : [];
    suggestionCache.set(normalized, { timestamp: Date.now(), suggestions });
    return suggestions.slice(0, limit);
  } catch (error: any) {
    // If endpoint doesn't exist, return empty array
    if (error?.message?.includes('Cannot GET') || error?.status === 404) {
      if (__DEV__) console.log('[geocoding] Autocomplete endpoint not available, returning empty results');
      return [];
    }
    throw error;
  }
}
