/**
 * Unit Tests for Geofencing Utilities
 * 
 * Tests for geofencing.ts (distance calculations and geofencing)
 */

import { describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import {
  calculateDistance,
  getEventPostWindowBounds,
  isPostPostingWindowOpen,
  isPostingWindowOpen,
  isWithinGeofence,
  requiresPriorLiveEventContribution,
  verifyEventPostingPermission,
} from '../lib/geofencing.js';

describe('Geofencing Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance in miles by default', () => {
      // NYC to Philadelphia (approximately 80-95 miles depending on route)
      const nycLat = 40.7128;
      const nycLon = -74.0060;
      const phillyLat = 39.9526;
      const phillyLon = -75.1652;
      
      const distance = calculateDistance(nycLat, nycLon, phillyLat, phillyLon);
      
      // Allow wider range for different calculation methods
      expect(distance).toBeGreaterThan(75);
      expect(distance).toBeLessThan(100);
    });

    it('should calculate distance in kilometers when specified', () => {
      // NYC to Philadelphia
      const nycLat = 40.7128;
      const nycLon = -74.0060;
      const phillyLat = 39.9526;
      const phillyLon = -75.1652;
      
      const distanceKm = calculateDistance(nycLat, nycLon, phillyLat, phillyLon, 'km');
      const distanceMiles = calculateDistance(nycLat, nycLon, phillyLat, phillyLon, 'miles');
      
      // 1 mile ≈ 1.609 km
      expect(distanceKm).toBeGreaterThan(distanceMiles * 1.5);
      expect(distanceKm).toBeLessThan(distanceMiles * 1.7);
    });

    it('should return 0 for same point', () => {
      const lat = 40.7128;
      const lon = -74.0060;
      
      const distance = calculateDistance(lat, lon, lat, lon);
      
      expect(distance).toBe(0);
    });

    it('should handle very small distances', () => {
      // Two points very close together (about 0.1 miles)
      const lat1 = 40.7128;
      const lon1 = -74.0060;
      const lat2 = 40.7130;
      const lon2 = -74.0060;
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1);
    });
  });

  describe('isWithinGeofence', () => {
    it('should return true when user is within default radius (0.5 miles)', () => {
      // User at venue (same location)
      const userLat = 40.7128;
      const userLon = -74.0060;
      const eventLat = 40.7128;
      const eventLon = -74.0060;
      
      const within = isWithinGeofence(userLat, userLon, eventLat, eventLon);
      
      expect(within).toBe(true);
    });

    it('should return false when user is outside default radius', () => {
      // User far away (NYC to Philadelphia is ~95 miles)
      const userLat = 39.9526; // Philadelphia
      const userLon = -75.1652;
      const eventLat = 40.7128; // NYC
      const eventLon = -74.0060;
      
      const within = isWithinGeofence(userLat, userLon, eventLat, eventLon);
      
      expect(within).toBe(false);
    });

    it('should respect custom radius', () => {
      // User about 0.3 miles away (within 2 mile radius)
      const userLat = 40.7150;
      const userLon = -74.0060;
      const eventLat = 40.7128;
      const eventLon = -74.0060;
      
      const within = isWithinGeofence(userLat, userLon, eventLat, eventLon, 2);
      
      expect(within).toBe(true);
    });

    it('should return true when exactly at radius boundary (same location)', () => {
      // User at exact same location as event
      const userLat = 40.7128;
      const userLon = -74.0060;
      const eventLat = 40.7128;
      const eventLon = -74.0060;
      
      const within = isWithinGeofence(userLat, userLon, eventLat, eventLon, 0.5);
      
      expect(within).toBe(true);
    });
  });

  describe('isPostingWindowOpen', () => {
    // Logic: windowOpenTime = eventTime - 24 hours
    // Returns: now >= windowOpenTime
    // So if event is 25 hours away: windowOpenTime = now + 1h, now >= now+1h = false
    // If event is 23 hours away: windowOpenTime = now - 1h, now >= now-1h = true
    
    it('should return false when event is more than 24 hours away', () => {
      const now = new Date();
      const eventDate = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      // Window opens exactly 24 hours before, so 25 hours before is still closed
      expect(isOpen).toBe(false);
    });

    it('should return true when event is less than 24 hours away', () => {
      const now = new Date();
      const eventDate = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours from now
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      // Window opened 12 hours ago (24h - 12h = 12h before now), so posting is open
      expect(isOpen).toBe(true);
    });

    it('should return true when event is in the past', () => {
      const now = new Date();
      const eventDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      // Past events: windowOpenTime was in the past, so now >= past = true
      expect(isOpen).toBe(true);
    });
  });

  describe('regular event posting rules', () => {
    it('keeps the regular post window open until 2 days after event start', () => {
      const now = new Date();
      const eventDate = new Date(now.getTime() - (36 * 60 * 60 * 1000)); // 36 hours ago

      const { windowStart, windowEnd } = getEventPostWindowBounds(eventDate);

      expect(windowStart.getTime()).toBe(eventDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      expect(windowEnd.getTime()).toBe(eventDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      expect(isPostPostingWindowOpen(eventDate)).toBe(true);
    });

    it('requires prior live contribution only after the live game window ends', () => {
      const eventDate = new Date('2026-04-10T18:00:00.000Z');
      const duringLiveWindow = new Date('2026-04-10T19:00:00.000Z');
      const afterLiveWindow = new Date('2026-04-10T21:30:00.000Z');

      expect(requiresPriorLiveEventContribution(eventDate, duringLiveWindow)).toBe(false);
      expect(requiresPriorLiveEventContribution(eventDate, afterLiveWindow)).toBe(true);
    });

    it('allows post-event uploads for prior live contributors without a current location check', async () => {
      const eventDate = new Date('2026-04-10T18:00:00.000Z');
      const now = new Date('2026-04-10T21:30:00.000Z');
      const eventSpy = jest.spyOn(prisma.event, 'findUnique').mockResolvedValue({
        id: 'event-1',
        title: 'Championship',
        date: eventDate,
        latitude: 41,
        longitude: -72,
        location: 'Gym',
        game_id: 'game-1',
      } as any);
      const postSpy = jest.spyOn(prisma.post, 'findFirst').mockResolvedValue({ id: 'post-1' } as any);

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null, now);

      expect(result.allowed).toBe(true);
      expect(postSpy).toHaveBeenCalled();
      eventSpy.mockRestore();
      postSpy.mockRestore();
    });

    it('blocks post-event uploads for users who did not post while the event was live', async () => {
      const eventDate = new Date('2026-04-10T18:00:00.000Z');
      const now = new Date('2026-04-10T21:30:00.000Z');
      const eventSpy = jest.spyOn(prisma.event, 'findUnique').mockResolvedValue({
        id: 'event-1',
        title: 'Championship',
        date: eventDate,
        latitude: 41,
        longitude: -72,
        location: 'Gym',
        game_id: 'game-1',
      } as any);
      const postSpy = jest.spyOn(prisma.post, 'findFirst').mockResolvedValue(null);

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null, now);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(result.reason).toContain('already posted from this event while it was live');
      eventSpy.mockRestore();
      postSpy.mockRestore();
    });
  });
});
