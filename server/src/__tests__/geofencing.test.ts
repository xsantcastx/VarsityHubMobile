/**
 * Unit Tests for Geofencing Utilities
 * 
 * Tests for geofencing.ts (distance calculations and geofencing)
 */

import { describe, expect, it, jest } from '@jest/globals';
import { calculateDistance, isWithinGeofence, isPostingWindowOpen } from '../lib/geofencing.js';

describe('Geofencing Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance in miles by default', () => {
      // NYC to Philadelphia (approximately 95 miles)
      const nycLat = 40.7128;
      const nycLon = -74.0060;
      const phillyLat = 39.9526;
      const phillyLon = -75.1652;
      
      const distance = calculateDistance(nycLat, nycLon, phillyLat, phillyLon);
      
      expect(distance).toBeGreaterThan(90);
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
    it('should return true when current time is 24+ hours before event', () => {
      const now = new Date();
      const eventDate = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      expect(isOpen).toBe(true);
    });

    it('should return false when current time is less than 24 hours before event', () => {
      // Mock current time to be exactly 12 hours before event
      const mockNow = new Date('2025-01-15T12:00:00Z');
      const eventDate = new Date('2025-01-16T00:00:00Z'); // 12 hours later
      
      // Temporarily override Date.now for this test
      const originalNow = Date.now;
      Date.now = jest.fn(() => mockNow.getTime());
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      Date.now = originalNow; // Restore
      
      expect(isOpen).toBe(false);
    });

    it('should return true when exactly 24 hours before event', () => {
      // Mock current time to be exactly 24 hours before event
      const mockNow = new Date('2025-01-15T00:00:00Z');
      const eventDate = new Date('2025-01-16T00:00:00Z'); // Exactly 24 hours later
      
      const originalNow = Date.now;
      Date.now = jest.fn(() => mockNow.getTime());
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      Date.now = originalNow; // Restore
      
      expect(isOpen).toBe(true);
    });

    it('should return true when event is in the past', () => {
      const now = new Date();
      const eventDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
      
      const isOpen = isPostingWindowOpen(eventDate);
      
      expect(isOpen).toBe(true);
    });
  });
});
