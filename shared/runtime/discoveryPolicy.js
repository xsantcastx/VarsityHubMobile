// Public discovery uses one horizon on feed and map. Historical browsing is
// separate and remains subject to media and viewer upload permissions.
export const DISCOVERY_UPCOMING_DAYS = 14;
export const DISCOVERY_LIVE_LOOKBACK_HOURS = 18;
export const DISCOVERY_UPCOMING_MS = DISCOVERY_UPCOMING_DAYS * 86400000;
export const DISCOVERY_LIVE_LOOKBACK_MS = DISCOVERY_LIVE_LOOKBACK_HOURS * 3600000;

export function matchesDiscoveryLevel(level, selected) {
  if (!selected) return true;
  return selected === 'other' ? !['major', 'minor', 'college'].includes(level) : level === selected;
}
