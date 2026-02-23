/**
 * Geofence rejection telemetry for debugging and analytics.
 * Logs when geofence checks deny posting (e.g., user too far, outside time window).
 */
import { debugLog } from './debugLog.js';

export interface LogRejectionPayload {
  timestamp: string;
  userId: string;
  eventId?: string;
  gameId?: string;
  contentType: 'post' | 'story';
  reason: string;
  message?: string;
  max_distance_km?: number;
  distance_km?: number;
  hours_from_event?: number;
  event_lat?: number;
  event_lon?: number;
  user_lat?: number;
  user_lon?: number;
  [key: string]: unknown;
}

export function logRejection(payload: LogRejectionPayload): void {
  debugLog('[geofence] rejection:', payload.reason, payload.message ?? '');
}
