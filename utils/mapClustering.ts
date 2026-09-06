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

type IdentifiedCoordinate = Coordinated & { id: string; type?: string };
export function mapMarkerKey(group: IdentifiedCoordinate[]): string {
  const lead = group[0];
  return group.length > 1
    ? `cluster:${lead.latitude!.toFixed(DEFAULT_CLUSTER_PRECISION)},${lead.longitude!.toFixed(DEFAULT_CLUSTER_PRECISION)}`
    : `${lead.type ?? 'event'}:${lead.id}`;
}

/** Preserve native sibling order when an API refresh merely reorders records. */
export function stableMapGroups<T extends IdentifiedCoordinate>(markers: T[]): T[][] {
  return clusterByCoordinate(markers)
    .map(group => [...group].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`)))
    .sort((a, b) => mapMarkerKey(a).localeCompare(mapMarkerKey(b)));
}

export function isValidMapCoordinate(marker: Coordinated): marker is Coordinated & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof marker.latitude === 'number' &&
    typeof marker.longitude === 'number' &&
    Number.isFinite(marker.latitude) &&
    Number.isFinite(marker.longitude) &&
    marker.latitude >= -90 &&
    marker.latitude <= 90 &&
    marker.longitude >= -180 &&
    marker.longitude <= 180
  );
}

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
    if (!isValidMapCoordinate(m)) continue;
    const key = `${m.latitude.toFixed(precision)},${m.longitude.toFixed(precision)}`;
    const existing = groups.get(key);
    if (existing) existing.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.values());
}
