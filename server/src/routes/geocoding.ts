/**
 * Geocoding API Routes
 * 
 * Endpoints for geocoding locations and managing coordinates.
 */

import express from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { prisma } from '../lib/prisma.js';
import {
  geocodeLocation,
  geocodeGame,
  geocodeEvent,
  geocodeAllGames,
  geocodeAllEvents,
  getCacheStats,
  clearGeocodeCache,
} from '../lib/geocoding.js';

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });

    if (!user || user.email !== 'admin@varsityhub.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

/**
 * POST /geocoding/location
 * Geocode a single location string
 * 
 * Body: { location: string }
 * Returns: { latitude: number, longitude: number, formatted_address?: string } | null
 */
router.post('/location', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const { location } = req.body;

    if (!location || typeof location !== 'string') {
      return res.status(400).json({ error: 'Location string required' });
    }

    const result = await geocodeLocation(location);
    
    if (!result) {
      return res.status(404).json({ error: 'Could not geocode location' });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error geocoding location:', error);
    return res.status(500).json({ error: 'Failed to geocode location' });
  }
});

/**
 * POST /geocoding/game/:gameId
 * Geocode a specific game (admin only)
 * 
 * Optional body: { location?: string }
 * Returns: Updated game
 */
router.post('/game/:gameId', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const { gameId } = req.params;
    const { location } = req.body;

    const result = await geocodeGame(gameId, location);

    if (!result) {
      return res.status(404).json({ error: 'Could not geocode game' });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error geocoding game:', error);
    return res.status(500).json({ error: 'Failed to geocode game' });
  }
});

/**
 * POST /geocoding/event/:eventId
 * Geocode a specific event (admin only)
 * 
 * Optional body: { location?: string }
 * Returns: Updated event
 */
router.post('/event/:eventId', requireAdmin as any, async (req: AuthedRequest, res) => {
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
});

/**
 * POST /geocoding/batch/games
 * Batch geocode all games missing coordinates (admin only)
 * 
 * Optional body: { limit?: number }
 * Returns: { count: number }
 */
router.post('/batch/games', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const { limit = 100 } = req.body;

    const count = await geocodeAllGames(limit);

    return res.json({ count, message: `Successfully geocoded ${count} games` });
  } catch (error) {
    console.error('Error batch geocoding games:', error);
    return res.status(500).json({ error: 'Failed to batch geocode games' });
  }
});

/**
 * POST /geocoding/batch/events
 * Batch geocode all events missing coordinates (admin only)
 * 
 * Optional body: { limit?: number }
 * Returns: { count: number }
 */
router.post('/batch/events', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const { limit = 100 } = req.body;

    const count = await geocodeAllEvents(limit);

    return res.json({ count, message: `Successfully geocoded ${count} events` });
  } catch (error) {
    console.error('Error batch geocoding events:', error);
    return res.status(500).json({ error: 'Failed to batch geocode events' });
  }
});

/**
 * GET /geocoding/cache/stats
 * Get geocoding cache statistics (admin only)
 * 
 * Returns: { size: number, entries: Array }
 */
router.get('/cache/stats', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const stats = getCacheStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * DELETE /geocoding/cache
 * Clear the geocoding cache (admin only)
 * 
 * Returns: { success: true }
 */
router.delete('/cache', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    clearGeocodeCache();
    return res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
