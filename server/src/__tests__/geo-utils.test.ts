/**
 * Unit Tests for Geographic Utilities
 *
 * Tests for geoUtils.ts (Haversine distance calculations)
 */

import { describe, expect, it } from '@jest/globals';
import { haversineDistance } from '../lib/geoUtils.js';

describe('Geographic Utilities', () => {
  describe('haversineDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // New York City to Los Angeles (approximately 2,445 miles)
      const nycLat = 40.7128;
      const nycLon = -74.006;
      const laLat = 34.0522;
      const laLon = -118.2437;

      const distance = haversineDistance(nycLat, nycLon, laLat, laLon);

      // Allow 5% margin of error
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });

    it('should return 0 for same point', () => {
      const lat = 40.7128;
      const lon = -74.006;

      const distance = haversineDistance(lat, lon, lat, lon);

      expect(distance).toBe(0);
    });

    it('should calculate short distances correctly', () => {
      // Two points about 1 mile apart in NYC
      const point1Lat = 40.7128;
      const point1Lon = -74.006;
      const point2Lat = 40.72;
      const point2Lon = -74.006;

      const distance = haversineDistance(point1Lat, point1Lon, point2Lat, point2Lon);

      // Should be approximately 0.5-1 mile
      expect(distance).toBeGreaterThan(0.4);
      expect(distance).toBeLessThan(1.1);
    });

    it('should round to 1 decimal place', () => {
      const lat1 = 40.7128;
      const lon1 = -74.006;
      const lat2 = 40.713;
      const lon2 = -74.0062;

      const distance = haversineDistance(lat1, lon1, lat2, lon2);

      // Check that it's rounded to 1 decimal
      const decimalPlaces = (distance.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });

    it('should handle negative coordinates (southern/western hemisphere)', () => {
      // Sydney, Australia to Melbourne, Australia (approximately 440 miles)
      const sydneyLat = -33.8688;
      const sydneyLon = 151.2093;
      const melbourneLat = -37.8136;
      const melbourneLon = 144.9631;

      const distance = haversineDistance(sydneyLat, sydneyLon, melbourneLat, melbourneLon);

      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(500);
    });

    it('should handle coordinates at equator', () => {
      // Two points on equator, 1 degree apart (approximately 69 miles)
      const lat1 = 0;
      const lon1 = 0;
      const lat2 = 0;
      const lon2 = 1;

      const distance = haversineDistance(lat1, lon1, lat2, lon2);

      expect(distance).toBeGreaterThan(60);
      expect(distance).toBeLessThan(75);
    });
  });
});
