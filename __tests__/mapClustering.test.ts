/**
 * Pins the fix for the "7 events, 1 visible pin" map bug: markers sharing a
 * coordinate must group into ONE cluster, and spread-out markers must stay
 * individual. Regression guard for components/EventMap.tsx clustering.
 */
import { describe, expect, it } from '@jest/globals';
import {
  clusterByCoordinate,
  clusterByRegion,
  clusterCentroid,
  clusterSpanDegrees,
  DEFAULT_CLUSTER_PRECISION,
} from '@/utils/mapClustering';

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

  it('accepts lat/lng of exactly 0 (Gulf of Guinea is a valid point, not "missing")', () => {
    const clusters = clusterByCoordinate([at('null-island', 0, 0)]);
    expect(clusters).toHaveLength(1);
  });

  it('default precision is 4 decimals', () => {
    expect(DEFAULT_CLUSTER_PRECISION).toBe(4);
  });
});

describe('clusterByRegion (zoom-aware)', () => {
  // Continental-USA viewport (what the national default opens on).
  const national = { latitudeDelta: 50, longitudeDelta: 50 };
  // A city-block viewport.
  const zoomedIn = { latitudeDelta: 0.02, longitudeDelta: 0.02 };

  it('merges spread-out cities into one cluster when zoomed out nationally', () => {
    // NYC / Boston / Philly are >100mi apart but tiny against a 50° viewport,
    // so at national zoom they collapse into a single Northeast cluster.
    const clusters = clusterByRegion(
      [
        at('nyc', 40.7128, -74.006),
        at('boston', 42.3601, -71.0589),
        at('philly', 39.9526, -75.1652),
      ],
      national
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });

  it('splits those same cities into separate pins when zoomed in', () => {
    const clusters = clusterByRegion(
      [
        at('nyc', 40.7128, -74.006),
        at('boston', 42.3601, -71.0589),
        at('philly', 39.9526, -75.1652),
      ],
      zoomedIn
    );
    expect(clusters).toHaveLength(3);
  });

  it('always merges markers at an identical coordinate, at any zoom (venue case)', () => {
    const fest = Array.from({ length: 5 }, (_, i) => at(`day-${i + 1}`, 40.7128, -74.006));
    expect(clusterByRegion(fest, national)[0]).toHaveLength(5);
    expect(clusterByRegion(fest, zoomedIn)[0]).toHaveLength(5);
  });

  it('falls back to exact-coordinate grouping for a missing/degenerate region', () => {
    const markers = [at('a', 40.7128, -74.006), at('b', 42.3601, -71.0589)];
    expect(clusterByRegion(markers, null)).toHaveLength(2);
    expect(clusterByRegion(markers, { latitudeDelta: 0, longitudeDelta: 0 })).toHaveLength(2);
  });
});

describe('clusterCentroid / clusterSpanDegrees', () => {
  it('centroid is the average point of the group', () => {
    const c = clusterCentroid([at('a', 40, -74), at('b', 42, -76)]);
    expect(c).toEqual({ latitude: 41, longitude: -75 });
  });

  it('centroid is null for a coordinate-less group', () => {
    expect(clusterCentroid([{ id: 'x', latitude: null, longitude: null }])).toBeNull();
  });

  it('span is ~0 for co-located markers and large for spread ones', () => {
    expect(clusterSpanDegrees([at('a', 40.7128, -74.006), at('b', 40.7128, -74.006)])).toBe(0);
    expect(clusterSpanDegrees([at('a', 40, -74), at('b', 43, -71)])).toBeCloseTo(3, 5);
  });
});
