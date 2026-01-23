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

import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';

// In-memory cache for geocoded locations (location string -> coordinates)
const geocodeCache = new Map<string, { lat: number; lng: number; timestamp: number }>();
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    console.warn('⚠️ GOOGLE_MAPS_API_KEY not configured. Geocoding disabled.');
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
    
    // Call Google Geocoding API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

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
          
          return coords;
        }
      }
      
      console.warn(`Geocoding failed for "${location}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding location "${location}":`, error);
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

/**
 * Clear the in-memory geocoding cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
  debugLog('🗑️ Geocoding cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: geocodeCache.size,
    entries: Array.from(geocodeCache.entries()).map(([location, data]) => ({
      location,
      coordinates: { lat: data.lat, lng: data.lng },
      age_ms: Date.now() - data.timestamp,
    })),
  };
}
