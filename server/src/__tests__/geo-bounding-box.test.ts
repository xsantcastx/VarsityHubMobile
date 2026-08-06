import { describe, it, expect } from '@jest/globals';
import { geoBoundingBox, haversineDistance } from '../lib/geoUtils.js';

// Houston (Daikin Park, a real WWE venue in prod) as the viewer's location.
const HOU = { lat: 29.7572, lon: -95.3552 };

describe('geoBoundingBox', () => {
  it('contains a point that is within the radius', () => {
    // A point ~20mi away must fall inside the 50mi box.
    const near = { lat: HOU.lat + 0.28, lon: HOU.lon + 0.1 };
    expect(haversineDistance(HOU.lat, HOU.lon, near.lat, near.lon)).toBeLessThan(50);
    const box = geoBoundingBox(HOU.lat, HOU.lon, 50);
    expect(near.lat).toBeGreaterThanOrEqual(box.minLat);
    expect(near.lat).toBeLessThanOrEqual(box.maxLat);
    expect(near.lon).toBeGreaterThanOrEqual(box.minLng);
    expect(near.lon).toBeLessThanOrEqual(box.maxLng);
  });

  it('excludes a point far outside the radius (the bulk-import flood case)', () => {
    // New York is ~1400mi from Houston — a 50mi box must not contain it. This is
    // the regression: far-away bulk-imported events must be filtered in the DB,
    // not fetched and then dropped, so nearby events survive the take/order cap.
    const far = { lat: 40.7128, lon: -74.006 };
    const box = geoBoundingBox(HOU.lat, HOU.lon, 50);
    const inside =
      far.lat >= box.minLat &&
      far.lat <= box.maxLat &&
      far.lon >= box.minLng &&
      far.lon <= box.maxLng;
    expect(inside).toBe(false);
  });

  it('is a superset of the true circle (never excludes an in-radius point)', () => {
    const box = geoBoundingBox(HOU.lat, HOU.lon, 50);
    // Sample points on a ring just inside the radius in several directions.
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (bearing * Math.PI) / 180;
      const dLat = (45 / 69) * Math.cos(rad);
      const dLon = (45 / (69 * Math.cos((HOU.lat * Math.PI) / 180))) * Math.sin(rad);
      const p = { lat: HOU.lat + dLat, lon: HOU.lon + dLon };
      if (haversineDistance(HOU.lat, HOU.lon, p.lat, p.lon) <= 50) {
        expect(p.lat >= box.minLat && p.lat <= box.maxLat).toBe(true);
        expect(p.lon >= box.minLng && p.lon <= box.maxLng).toBe(true);
      }
    }
  });

  it('widens longitude span near the equator vs high latitude', () => {
    const equator = geoBoundingBox(0, 0, 50);
    const highLat = geoBoundingBox(60, 0, 50);
    const eqLngSpan = equator.maxLng - equator.minLng;
    const hiLngSpan = highLat.maxLng - highLat.minLng;
    expect(hiLngSpan).toBeGreaterThan(eqLngSpan);
    // Latitude span is constant regardless of latitude.
    expect(equator.maxLat - equator.minLat).toBeCloseTo(highLat.maxLat - highLat.minLat, 6);
  });
});
