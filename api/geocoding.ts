import { getConfig } from '@/config/env';
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

  // Prefer client-side Google fallback first when key is available to avoid noisy backend failures
  const mapsKey = getConfig().mapsKey;
  const fetchGoogleSuggestions = async (): Promise<PlaceSuggestion[]> => {
    if (!mapsKey) return [];
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(trimmed)}&types=geocode&components=country:us&key=${encodeURIComponent(mapsKey)}`;
      const res = await fetch(url);
      const data: any = await res.json();
      const predictions: any[] = Array.isArray(data?.predictions) ? data.predictions : [];
      return predictions.map((p) => ({
        description: p.description,
        place_id: p.place_id,
        structured_formatting: {
          main_text: p.structured_formatting?.main_text,
          secondary_text: p.structured_formatting?.secondary_text,
        },
      }));
    } catch (_e2) {
      return [];
    }
  };

  // Try Google first (if key present) to avoid surfacing backend errors to the user
  const googleFirst = await fetchGoogleSuggestions();
  if (googleFirst.length > 0) {
    suggestionCache.set(normalized, { timestamp: Date.now(), suggestions: googleFirst });
    return googleFirst.slice(0, limit);
  }

  // Backend autocomplete remains as a secondary source
  try {
    const res: any = await httpGet(`/geocoding/autocomplete?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
    const suggestions: PlaceSuggestion[] = Array.isArray(res?.suggestions) ? res.suggestions : [];
    if (suggestions.length > 0) {
      suggestionCache.set(normalized, { timestamp: Date.now(), suggestions });
      return suggestions.slice(0, limit);
    }
  } catch (_e) {
    // Fall back to Google if backend fails or returns an error
    const googleSuggestions = await fetchGoogleSuggestions();
    if (googleSuggestions.length > 0) {
      suggestionCache.set(normalized, { timestamp: Date.now(), suggestions: googleSuggestions });
      return googleSuggestions.slice(0, limit);
    }
  }

  return [];
}
