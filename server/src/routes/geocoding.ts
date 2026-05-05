import axios from 'axios';
import dotenv from 'dotenv';
import { Router } from 'express';
import { z } from 'zod';
import { clearGeocodeCache, geocodeAllEvents, geocodeAllGames, geocodeEvent, getCacheStats } from '../lib/geocoding.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  geocodingAutocompleteLimiter,
  geocodingLocationLimiter,
} from '../middleware/rateLimiters.js';

dotenv.config();

export const geocodingRouter = Router();

const geocodeSchema = z.object({
  location: z.string().min(2, 'Location must be at least 2 characters'),
});

geocodingRouter.post('/location', requireAuth, geocodingLocationLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { location } = geocodeSchema.parse(req.body);
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Geocoding error: GOOGLE_MAPS_API_KEY is not set.');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: location,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK' || !response.data.results[0]) {
      console.warn(`Geocoding for "${location}" failed with status: ${response.data.status}`);
      return res.status(404).json({ error: 'Location not found' });
    }

    const { lat, lng } = response.data.results[0].geometry.location;
    const formatted_address = response.data.results[0].formatted_address;

    return res.json({
      latitude: lat,
      longitude: lng,
      formatted_address,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Geocoding request failed:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
}));

const autocompleteSchema = z.object({
  input: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  sessiontoken: z.string().optional(),
  zip: z.string().max(20).optional(),
});

geocodingRouter.get('/autocomplete', requireAuth, geocodingAutocompleteLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { input, limit = 6, sessiontoken, zip } = autocompleteSchema.parse(req.query);
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Autocomplete error: GOOGLE_MAPS_API_KEY is not set.');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // If a zip code is provided, geocode it first to bias results to that area
    let locationBias: { lat: number; lng: number } | null = null;
    if (zip) {
      try {
        const geoRes = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { address: zip, key: apiKey },
        });
        if (geoRes.data.status === 'OK' && geoRes.data.results[0]) {
          const { lat, lng } = geoRes.data.results[0].geometry.location;
          locationBias = { lat, lng };
        }
      } catch {
        // Non-critical — proceed without bias
      }
    }

    const params: Record<string, string> = {
      input,
      key: apiKey,
      ...(sessiontoken ? { sessiontoken } : {}),
    };

    // Bias autocomplete results to ~50km around the user's zip
    if (locationBias) {
      params.location = `${locationBias.lat},${locationBias.lng}`;
      params.radius = '50000';
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params,
    });

    if (response.data.status === 'ZERO_RESULTS') {
      return res.json({ suggestions: [] });
    }

    if (response.data.status !== 'OK') {
      console.warn(`Autocomplete for "${input}" failed with status: ${response.data.status}`);
      return res.status(500).json({ error: 'Failed to fetch place suggestions' });
    }

    const suggestions = response.data.predictions.map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
      structured_formatting: p.structured_formatting,
    }));

    return res.json({ suggestions: suggestions.slice(0, limit) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Autocomplete request failed:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
}));

/**
 * POST /geocoding/event/:eventId
 * Geocode a specific event (admin only)
 * 
 * Optional body: { location?: string }
 * Returns: Updated event
 */
geocodingRouter.post('/event/:eventId', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { eventId } = req.params;
    const { location } = req.body;

    const result = await geocodeEvent(eventId, location);

    if (!result) {
      return res.status(404).json({ error: 'Could not geocode event' });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error geocoding event:', error);
    return res.status(500).json({ error: 'Failed to geocode event' });
  }
}));

/**
 * POST /geocoding/batch/games
 * Batch geocode all games missing coordinates (admin only)
 * 
 * Optional body: { limit?: number }
 * Returns: { count: number }
 */
geocodingRouter.post('/batch/games', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { limit: rawLimit = 100 } = req.body;
    const limit = Math.min(Math.max(1, parseInt(rawLimit) || 100), 500);

    const count = await geocodeAllGames(limit);

    return res.json({ count, message: `Successfully geocoded ${count} games` });
  } catch (error) {
    console.error('Error batch geocoding games:', error);
    return res.status(500).json({ error: 'Failed to batch geocode games' });
  }
}));

/**
 * POST /geocoding/batch/events
 * Batch geocode all events missing coordinates (admin only)
 * 
 * Optional body: { limit?: number }
 * Returns: { count: number }
 */
geocodingRouter.post('/batch/events', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { limit: rawEvtLimit = 100 } = req.body;
    const limit = Math.min(Math.max(1, parseInt(rawEvtLimit) || 100), 500);

    const count = await geocodeAllEvents(limit);

    return res.json({ count, message: `Successfully geocoded ${count} events` });
  } catch (error) {
    console.error('Error batch geocoding events:', error);
    return res.status(500).json({ error: 'Failed to batch geocode events' });
  }
}));

/**
 * GET /geocoding/cache/stats
 * Get geocoding cache statistics (admin only)
 * 
 * Returns: { size: number, entries: Array }
 */
geocodingRouter.get('/cache/stats', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const stats = getCacheStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return res.status(500).json({ error: 'Failed to get cache stats' });
  }
}));

/**
 * DELETE /geocoding/cache
 * Clear the geocoding cache (admin only)
 * 
 * Returns: { success: true }
 */
geocodingRouter.delete('/cache', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    clearGeocodeCache();
    return res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
}));

export default geocodingRouter;
