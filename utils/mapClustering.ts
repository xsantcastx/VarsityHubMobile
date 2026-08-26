/**
 * Group map markers that share (near-)identical coordinates.
 *
 * Without this, a multi-day event at one venue (or several events geocoded to
 * the same city centroid) render N `<Marker>`s on the exact same pixel and read
 * as a SINGLE pin — the "7 events, 1 visible pin" bug. Grouping lets the map
 * draw one numbered cluster pin that expands to a picker.
 *
 * Pure + framework-free so it is unit-testable and reusable. Precision is the
 * number of lat/lng decimal places treated as "the same point": 4 ≈ 11m, 3 ≈ 111m.
 */
export interface Coordinated {
  latitude?: number | null;
  longitude?: number | null;
}

export const DEFAULT_CLUSTER_PRECISION = 4;

/**
 * Returns groups of markers keyed by rounded coordinate. Markers missing a
 * latitude or longitude are dropped (they can't be placed). Each returned group
 * has length ≥ 1; groups with length > 1 are co-located and should render as a
 * single cluster pin. Input order is preserved within and across groups.
 */
export function clusterByCoordinate<T extends Coordinated>(
  markers: T[],
  precision: number = DEFAULT_CLUSTER_PRECISION
): T[][] {
  const groups = new Map<string, T[]>();
  for (const m of markers) {
    if (m.latitude == null || m.longitude == null) continue;
    const key = `${m.latitude.toFixed(precision)},${m.longitude.toFixed(precision)}`;
    const existing = groups.get(key);
    if (existing) existing.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.values());
}

/** Minimal viewport shape (mirror of react-native-maps' Region) — kept local so
 *  this util stays framework-free and node-unit-testable. */
export interface RegionLike {
  latitudeDelta: number;
  longitudeDelta: number;
}

/** How finely the viewport is divided. 10 → markers within ~1/10th of the
 *  visible span merge, which reads as "same area" at any zoom. */
export const DEFAULT_CELLS_ACROSS = 10;

/**
 * Zoom-aware spatial clustering for the national map view. Greedily groups
 * markers that sit within ~1/`cellsAcross` of the current viewport span of an
 * existing group's centroid:
 *  - Zoomed OUT (large deltas) → large threshold → a whole region collapses to
 *    a few pins (no national clutter).
 *  - Zoomed IN (small deltas) → small threshold → pins separate.
 *  - Markers at an identical coordinate always merge at any zoom, so a
 *    multi-day venue still collapses to one cluster (subsumes
 *    `clusterByCoordinate`).
 * Greedy (not a fixed grid) so two nearby points never split just because they
 * straddle a cell edge. Falls back to exact-coordinate grouping when the region
 * is missing or degenerate (e.g. before the first region settle). Pure +
 * framework-free → unit-testable; input order preserved.
 */
export function clusterByRegion<T extends Coordinated>(
  markers: T[],
  region?: RegionLike | null,
  cellsAcross: number = DEFAULT_CELLS_ACROSS
): T[][] {
  if (
    !region ||
    !Number.isFinite(region.latitudeDelta) ||
    !Number.isFinite(region.longitudeDelta) ||
    region.latitudeDelta <= 0 ||
    region.longitudeDelta <= 0 ||
    cellsAcross <= 0
  ) {
    return clusterByCoordinate(markers);
  }
  const threshLat = region.latitudeDelta / cellsAcross;
  const threshLng = region.longitudeDelta / cellsAcross;
  const groups: T[][] = [];
  const centroids: { lat: number; lng: number }[] = [];
  for (const m of markers) {
    if (m.latitude == null || m.longitude == null) continue;
    let placed = false;
    for (let i = 0; i < groups.length; i += 1) {
      const c = centroids[i];
      if (Math.abs(m.latitude - c.lat) <= threshLat && Math.abs(m.longitude - c.lng) <= threshLng) {
        groups[i].push(m);
        // Running mean so the group's "location" tracks its members.
        const n = groups[i].length;
        c.lat += (m.latitude - c.lat) / n;
        c.lng += (m.longitude - c.lng) / n;
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([m]);
      centroids.push({ lat: m.latitude, lng: m.longitude });
    }
  }
  return groups;
}

/** Centroid of a cluster — where its pin should sit. Returns null for an empty
 *  or coordinate-less group. */
export function clusterCentroid<T extends Coordinated>(
  group: T[]
): { latitude: number; longitude: number } | null {
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const m of group) {
    if (m.latitude == null || m.longitude == null) continue;
    sumLat += m.latitude;
    sumLng += m.longitude;
    n += 1;
  }
  if (n === 0) return null;
  return { latitude: sumLat / n, longitude: sumLng / n };
}

/** Largest lat/lng span (in degrees) across a group. ~0 means the markers are
 *  co-located (zooming can't separate them → show the picker instead). A larger
 *  span means the cluster is spatial and a tap should zoom in to split it. */
export function clusterSpanDegrees<T extends Coordinated>(group: T[]): number {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const m of group) {
    if (m.latitude == null || m.longitude == null) continue;
    minLat = Math.min(minLat, m.latitude);
    maxLat = Math.max(maxLat, m.latitude);
    minLng = Math.min(minLng, m.longitude);
    maxLng = Math.max(maxLng, m.longitude);
  }
  if (!Number.isFinite(minLat)) return 0;
  return Math.max(maxLat - minLat, maxLng - minLng);
}
