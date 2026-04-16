/**
 * Geocoding Service
 * 
 * Converts location strings (addresses, place names) to latitude/longitude coordinates
 * using Google Geocoding API.
 * 
 * Features:
 * - In-memory caching to reduce API calls
 * - Fallback to database storage for persistent caching
 * - Rate limiting protection
 * - Error handling with graceful degradation
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';

// In-memory cache for geocoded locations (location string -> coordinates)
// Uses LRU-style eviction to prevent unbounded memory growth
const geocodeCache = new Map<string, { lat: number; lng: number; timestamp: number }>();
// v1.0.2 audit fix: reduced from 7d to 24h so renamed venues don't stay stale for a week.
// Zip codes are stable, but freeform addresses can change as businesses move/rename.
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_CACHE_SIZE = 10000; // Max entries to prevent memory leaks

/**
 * Evict oldest entries if cache exceeds max size
 * Simple LRU: removes entries until we're at 80% capacity
 */
function evictOldEntries(): void {
  if (geocodeCache.size <= MAX_CACHE_SIZE) return;

  const targetSize = Math.floor(MAX_CACHE_SIZE * 0.8);
  const entries = Array.from(geocodeCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = entries.slice(0, geocodeCache.size - targetSize);
  for (const [key] of toRemove) {
    geocodeCache.delete(key);
  }
  debugLog(`[geocoding] Evicted ${toRemove.length} old cache entries, size now: ${geocodeCache.size}`);
}

/**
 * Clear the in-memory geocode cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number; oldestEntry: number | null } {
  let oldestTimestamp: number | null = null;
  for (const entry of geocodeCache.values()) {
    if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
  }
  return {
    size: geocodeCache.size,
    maxSize: MAX_CACHE_SIZE,
    oldestEntry: oldestTimestamp,
  };
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

/**
 * Geocode a location string to coordinates using Google Geocoding API
 * 
 * @param location - Location string (e.g., "Madison Square Garden, NYC" or "New York, NY")
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeLocation(location: string): Promise<GeocodingResult | null> {
  if (!location || location.trim().length === 0) {
    return null;
  }

  const normalizedLocation = location.trim().toLowerCase();

  // Check in-memory cache first
  const cached = geocodeCache.get(normalizedLocation);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return { latitude: cached.lat, longitude: cached.lng };
  }

  // Check if we have Google Maps API key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // v1.0.2: in production this is a hard config error, not a warning.
    // Without geocoding, map pins, event radius filtering, and ad targeting all silently break.
    if (process.env.NODE_ENV === 'production') {
      console.error('[geocoding] FATAL: GOOGLE_MAPS_API_KEY missing — maps and location features DISABLED');
    } else {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not configured. Geocoding disabled.');
    }
    return null;
  }

  try {
    // For ZIP codes, try with country code if it looks like a US/Canadian ZIP
    let query = location.trim();
    const zipPattern = /^\d{5}(-\d{4})?$/; // US ZIP: 12345 or 12345-6789
    const canadianZipPattern = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/; // Canadian: A1A 1A1
    
    if (zipPattern.test(query)) {
      // US ZIP code - try with "USA" suffix for better results
      query = `${query}, USA`;
    } else if (canadianZipPattern.test(query.replace(/\s/g, ''))) {
      // Canadian postal code - try with "Canada" suffix
      query = `${query}, Canada`;
    }
    
    // v1.0.2 audit fix: retry with exponential backoff on OVER_QUERY_LIMIT.
    // Prevents silent degradation during traffic spikes. Max 3 attempts with 250/500ms gaps.
    const fetchGeocodeWithRetry = async (u: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(u);
        const j = await r.json();
        if (j.status !== 'OVER_QUERY_LIMIT') return j;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
        console.error('[geocoding] OVER_QUERY_LIMIT after 3 retries — rate limit likely exceeded for Google Maps API key');
        return j;
      }
      return null;
    };

    // Call Google Geocoding API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const data = await fetchGeocodeWithRetry(url);
    if (!data) return null;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const coords = {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address,
      };

      // Update in-memory cache (use original location for cache key)
      geocodeCache.set(normalizedLocation, {
        lat: coords.latitude,
        lng: coords.longitude,
        timestamp: Date.now(),
      });
      evictOldEntries(); // Prevent unbounded memory growth

      return coords;
    } else {
      // If first attempt failed and we added country, try without it
      if (query !== location.trim() && (zipPattern.test(location.trim()) || canadianZipPattern.test(location.trim().replace(/\s/g, '')))) {
        const fallbackUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location.trim())}&key=${apiKey}`;
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.status === 'OK' && fallbackData.results && fallbackData.results.length > 0) {
          const result = fallbackData.results[0];
          const coords = {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            formatted_address: result.formatted_address,
          };
          
          geocodeCache.set(normalizedLocation, {
            lat: coords.latitude,
            lng: coords.longitude,
            timestamp: Date.now(),
          });
          evictOldEntries(); // Prevent unbounded memory growth

          return coords;
        }
      }
      
      // v1.0.2: surface Google's specific status (ZERO_RESULTS, OVER_QUERY_LIMIT, REQUEST_DENIED)
      // so Railway logs make the root cause obvious instead of a generic "failed".
      console.error(`[geocoding] failed for "${location}": status=${data.status} error_message=${data.error_message || 'none'}`);
      return null;
    }
  } catch (error: any) {
    console.error(`[geocoding] exception for "${location}":`, error?.message || error);
    return null;
  }
}

/**
 * Bulk geocode multiple locations with rate limiting
 * 
 * @param locations - Array of location strings
 * @param delayMs - Delay between requests (default 200ms to stay under API rate limits)
 * @returns Map of location -> coordinates
 */
export async function bulkGeocodeLocations(
  locations: string[],
  delayMs: number = 200
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  
  for (const location of locations) {
    if (!location) continue;

    const coords = await geocodeLocation(location);
    if (coords) {
      results.set(location, coords);
    }

    // Rate limiting delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Update a Game with geocoded coordinates
 * 
 * @param gameId - Game ID
 * @param location - Location string (optional, will use existing if not provided)
 * @returns Updated game or null if failed
 */
export async function geocodeGame(gameId: string, location?: string) {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, location: true, latitude: true, longitude: true },
    });

    if (!game) {
      console.error(`Game ${gameId} not found`);
      return null;
    }

    // Skip if already has coordinates
    if (game.latitude && game.longitude) {
      return game;
    }

    const locationToGeocode = location || game.location;
    if (!locationToGeocode) {
      console.warn(`Game ${gameId} has no location to geocode`);
      return null;
    }

    const coords = await geocodeLocation(locationToGeocode);
    if (!coords) {
      return null;
    }

    // Update game with coordinates
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    });

    debugLog(`✅ Geocoded game ${gameId}: ${coords.latitude}, ${coords.longitude}`);
    return updated;
  } catch (error) {
    console.error(`Error geocoding game ${gameId}:`, error);
    return null;
  }
}

/**
 * Update an Event with geocoded coordinates
 * 
 * @param eventId - Event ID
 * @param location - Location string (optional, will use existing if not provided)
 * @returns Updated event or null if failed
 */
export async function geocodeEvent(eventId: string, location?: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, location: true, latitude: true, longitude: true },
    });

    if (!event) {
      console.error(`Event ${eventId} not found`);
      return null;
    }

    // Skip if already has coordinates
    if (event.latitude && event.longitude) {
      return event;
    }

    const locationToGeocode = location || event.location;
    if (!locationToGeocode) {
      console.warn(`Event ${eventId} has no location to geocode`);
      return null;
    }

    const coords = await geocodeLocation(locationToGeocode);
    if (!coords) {
      return null;
    }

    // Update event with coordinates
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    });

    debugLog(`✅ Geocoded event ${eventId}: ${coords.latitude}, ${coords.longitude}`);
    return updated;
  } catch (error) {
    console.error(`Error geocoding event ${eventId}:`, error);
    return null;
  }
}

/**
 * Batch geocode all games that are missing coordinates
 * 
 * @param limit - Maximum number of games to process (default 100)
 * @returns Detailed results object
 */
export async function geocodeAllGames(limit: number = 100): Promise<{
  success: number;
  failed: number;
  skipped: number;
  total: number;
  errors: string[];
}> {
  try {
    // Find games without coordinates that have a location
    const games = await prisma.game.findMany({
      where: {
        location: { not: null },
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: { id: true, location: true, title: true },
      take: limit,
    });

    debugLog(`📍 Found ${games.length} games to geocode`);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const game of games) {
      if (!game.location) continue;

      try {
        const result = await geocodeGame(game.id, game.location);
        if (result) {
          debugLog(`✅ "${game.title}" → ${game.location}`);
          successCount++;
        } else {
          debugLog(`❌ Failed: "${game.title}" - ${game.location}`);
          failedCount++;
          errors.push(`Failed to geocode "${game.title}"`);
        }
      } catch (error: any) {
        debugLog(`❌ Error: "${game.title}" - ${error.message}`);
        failedCount++;
        errors.push(`Error geocoding "${game.title}": ${error.message}`);
      }

      // Rate limiting: 200ms between requests = ~300 requests/minute (under 500/min limit)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    debugLog(`✅ Successfully geocoded ${successCount}/${games.length} games`);
    
    return {
      success: successCount,
      failed: failedCount,
      skipped: 0,
      total: games.length,
      errors,
    };
  } catch (error) {
    console.error('Error in batch geocoding games:', error);
    return {
      success: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      errors: [String(error)],
    };
  }
}

/**
 * Batch geocode all events that are missing coordinates
 * 
 * @param limit - Maximum number of events to process (default 100)
 * @returns Number of events geocoded
 */
export async function geocodeAllEvents(limit: number = 100): Promise<number> {
  try {
    // Find events without coordinates that have a location
    const events = await prisma.event.findMany({
      where: {
        location: { not: null },
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: { id: true, location: true },
      take: limit,
    });

    debugLog(`📍 Found ${events.length} events to geocode`);

    let successCount = 0;
    for (const event of events) {
      if (!event.location) continue;

      const result = await geocodeEvent(event.id, event.location);
      if (result) {
        successCount++;
      }

      // Rate limiting: 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    debugLog(`✅ Successfully geocoded ${successCount}/${events.length} events`);
    return successCount;
  } catch (error) {
    console.error('Error in batch geocoding events:', error);
    return 0;
  }
}
