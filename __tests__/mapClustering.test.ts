/**
 * Pins the fix for the "7 events, 1 visible pin" map bug: markers sharing a
 * coordinate must group into ONE cluster, and spread-out markers must stay
 * individual. Regression guard for components/EventMap.tsx clustering.
 */
import { describe, expect, it } from '@jest/globals';
import { clusterByCoordinate, DEFAULT_CLUSTER_PRECISION } from '@/utils/mapClustering';

const at = (id: string, latitude: number, longitude: number) => ({ id, latitude, longitude });

describe('clusterByCoordinate', () => {
  it('collapses many events at the same venue into one cluster (the reported bug)', () => {
    // A 7-day festival at one NYC venue — every day the same coordinate.
    const events = Array.from({ length: 7 }, (_, i) => at(`day-${i + 1}`, 40.7128, -74.006));
    const clusters = clusterByCoordinate(events);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(7);
    // The cluster preserves every event so the picker can list all 7.
    expect(clusters[0].map(e => e.id)).toEqual([
      'day-1',
      'day-2',
      'day-3',
      'day-4',
      'day-5',
      'day-6',
      'day-7',
    ]);
  });

  it('keeps genuinely separate events as individual pins', () => {
    const clusters = clusterByCoordinate([
      at('nyc', 40.7128, -74.006),
      at('boston', 42.3601, -71.0589),
      at('philly', 39.9526, -75.1652),
    ]);
    expect(clusters).toHaveLength(3);
    expect(clusters.every(g => g.length === 1)).toBe(true);
  });

  it('groups near-identical points (within ~11m at precision 4) but splits far ones', () => {
    const clusters = clusterByCoordinate([
      at('a', 40.7128, -74.006),
      at('b', 40.71281, -74.00601), // ~1m away → same cluster
      at('c', 40.72, -74.006), // ~800m away → its own pin
    ]);
    const sizes = clusters.map(g => g.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it('drops markers missing coordinates (cannot be placed)', () => {
    const clusters = clusterByCoordinate([
      at('has-coords', 40.7128, -74.006),
      { id: 'no-lat', latitude: null, longitude: -74.006 },
      { id: 'no-lng', latitude: 40.7128, longitude: undefined as any },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0][0].id).toBe('has-coords');
  });

  it('drops non-finite and out-of-range coordinates before they reach native maps', () => {
    const clusters = clusterByCoordinate([
      at('valid', 40.7128, -74.006),
      at('nan-lat', Number.NaN, -74.006),
      at('inf-lng', 40.7128, Number.POSITIVE_INFINITY),
      at('lat-out-of-range', 91, -74.006),
      at('lng-out-of-range', 40.7128, -181),
      { id: 'string-lat', latitude: '40.7128' as any, longitude: -74.006 },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toEqual([expect.objectContaining({ id: 'valid' })]);
  });

  it('accepts lat/lng of exactly 0 (Gulf of Guinea is a valid point, not "missing")', () => {
    const clusters = clusterByCoordinate([at('null-island', 0, 0)]);
    expect(clusters).toHaveLength(1);
  });

  it('default precision is 4 decimals', () => {
    expect(DEFAULT_CLUSTER_PRECISION).toBe(4);
  });
});
