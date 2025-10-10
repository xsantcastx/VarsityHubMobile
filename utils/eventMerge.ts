/**
 * Event Merge Detection Utilities
 * 
 * Detects duplicate/similar events that should be merged
 * Based on: same date/time ±15 min, same venue geofence (<150m)
 */

interface EventLocation {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

interface MergeableEvent {
  id: string;
  title?: string;
  date?: string;
  location?: EventLocation;
  team_id?: string;
  opponent_team_id?: string;
}

interface MergeSuggestion {
  primaryEvent: MergeableEvent;
  duplicateEvent: MergeableEvent;
  matchScore: number; // 0-100 confidence
  reasons: string[];
}

/**
 * Calculates distance between two coordinates in meters
 * Using Haversine formula
 */
export function calculateDistance(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Checks if two timestamps are within 15 minutes of each other
 */
export function areTimesNearlyIdentical(
  date1?: string | null,
  date2?: string | null,
  thresholdMinutes: number = 15
): boolean {
  if (!date1 || !date2) return false;

  const time1 = new Date(date1).getTime();
  const time2 = new Date(date2).getTime();

  if (isNaN(time1) || isNaN(time2)) return false;

  const diffMs = Math.abs(time1 - time2);
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes <= thresholdMinutes;
}

/**
 * Checks if two locations are within 150 meters (geofence)
 */
export function areLocationsNearby(
  loc1?: EventLocation | null,
  loc2?: EventLocation | null,
  thresholdMeters: number = 150
): boolean {
  if (!loc1 || !loc2) return false;

  const distance = calculateDistance(
    loc1.latitude,
    loc1.longitude,
    loc2.latitude,
    loc2.longitude
  );

  if (distance === null) {
    // Fallback to address comparison if no coordinates
    if (loc1.address && loc2.address) {
      const addr1 = loc1.address.toLowerCase().trim();
      const addr2 = loc2.address.toLowerCase().trim();
      return addr1 === addr2;
    }
    return false;
  }

  return distance <= thresholdMeters;
}

/**
 * Checks if two events involve the same teams (home vs away)
 */
export function haveSameTeams(event1: MergeableEvent, event2: MergeableEvent): boolean {
  const team1_a = event1.team_id;
  const team1_b = event1.opponent_team_id;
  const team2_a = event2.team_id;
  const team2_b = event2.opponent_team_id;

  if (!team1_a || !team2_a) return false;

  // Check if teams match in either order (home/away reversal)
  const matchDirect = team1_a === team2_a && team1_b === team2_b;
  const matchReversed = team1_a === team2_b && team1_b === team2_a;

  return matchDirect || matchReversed;
}

/**
 * Detects if two events are likely duplicates that should be merged
 */
export function shouldMergeEvents(
  event1: MergeableEvent,
  event2: MergeableEvent
): MergeSuggestion | null {
  if (event1.id === event2.id) return null;

  const reasons: string[] = [];
  let matchScore = 0;

  // Check time proximity (±15 minutes)
  const timesMatch = areTimesNearlyIdentical(event1.date, event2.date, 15);
  if (timesMatch) {
    matchScore += 40;
    reasons.push('Same date/time (±15 min)');
  } else {
    return null; // Time must match for merge consideration
  }

  // Check location proximity (<150m)
  const locationsMatch = areLocationsNearby(event1.location, event2.location, 150);
  if (locationsMatch) {
    matchScore += 40;
    reasons.push('Same venue (<150m)');
  } else {
    return null; // Location must match
  }

  // Check if same teams are playing
  const teamsMatch = haveSameTeams(event1, event2);
  if (teamsMatch) {
    matchScore += 20;
    reasons.push('Same teams playing');
  }

  // Only suggest merge if score is high enough
  if (matchScore >= 80) {
    return {
      primaryEvent: event1,
      duplicateEvent: event2,
      matchScore,
      reasons,
    };
  }

  return null;
}

/**
 * Finds all potential merge suggestions from a list of events
 */
export function findMergeSuggestions(events: MergeableEvent[]): MergeSuggestion[] {
  const suggestions: MergeSuggestion[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];
      const pairKey = [event1.id, event2.id].sort().join('-');

      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const suggestion = shouldMergeEvents(event1, event2);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }

  // Sort by match score (highest first)
  return suggestions.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Formats a merge suggestion for display
 */
export function formatMergeSuggestion(suggestion: MergeSuggestion): string {
  const { primaryEvent, duplicateEvent, matchScore, reasons } = suggestion;

  const primaryTitle = primaryEvent.title || 'Event';
  const duplicateTitle = duplicateEvent.title || 'Event';

  return `Potential duplicate detected (${matchScore}% match):\n"${primaryTitle}" and "${duplicateTitle}"\n\nReasons: ${reasons.join(', ')}`;
}
