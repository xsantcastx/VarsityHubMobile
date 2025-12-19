/**
 * Telemetry and logging for geofencing rejections
 * Tracks all post/story creation denials with detailed metrics for analysis
 */

export type RejectionReason =
  | 'OUTSIDE_DISTANCE_RADIUS'
  | 'OUTSIDE_TIME_WINDOW'
  | 'MISSING_LOCATION'
  | 'EVENT_NOT_FOUND'
  | 'NOT_POSTED_DURING_EVENT'
  | 'WRONG_CALENDAR_DAY'
  | 'GRACE_PERIOD_EXPIRED';

export interface RejectionMetric {
  timestamp: string;
  userId: string;
  eventId: string;
  contentType: 'story' | 'post';
  reason: RejectionReason;
  distance_km?: number;
  max_distance_km: number;
  hours_from_event?: number;
  user_lat?: number;
  user_lon?: number;
  event_lat?: number;
  event_lon?: number;
  message: string;
}

// In-memory metrics buffer (flush to DB or logging service periodically)
const rejectionMetrics: RejectionMetric[] = [];

/**
 * Log a content creation rejection
 */
export function logRejection(metric: RejectionMetric): void {
  rejectionMetrics.push(metric);

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[GEOFENCE REJECTION] ${metric.contentType.toUpperCase()}`);
    console.log(`  User: ${metric.userId} | Event: ${metric.eventId}`);
    console.log(`  Reason: ${metric.reason}`);
    if (metric.distance_km !== undefined) {
      console.log(`  Distance: ${metric.distance_km.toFixed(2)}km / ${metric.max_distance_km}km`);
    }
    if (metric.hours_from_event !== undefined) {
      console.log(`  Time Offset: ${metric.hours_from_event.toFixed(1)}h from event`);
    }
  }
}

/**
 * Get rejection statistics
 */
export function getMetrics(filters?: {
  userId?: string;
  eventId?: string;
  contentType?: 'story' | 'post';
  reason?: RejectionReason;
  hoursBack?: number;
}): {
  total: number;
  byReason: Record<RejectionReason, number>;
  byContentType: Record<'story' | 'post', number>;
  byUser: Record<string, number>;
  topFailures: Array<{ reason: RejectionReason; count: number }>;
} {
  let filtered = rejectionMetrics;

  if (filters?.userId) {
    filtered = filtered.filter((m) => m.userId === filters.userId);
  }
  if (filters?.eventId) {
    filtered = filtered.filter((m) => m.eventId === filters.eventId);
  }
  if (filters?.contentType) {
    filtered = filtered.filter((m) => m.contentType === filters.contentType);
  }
  if (filters?.reason) {
    filtered = filtered.filter((m) => m.reason === filters.reason);
  }
  if (filters?.hoursBack) {
    const cutoff = new Date(Date.now() - filters.hoursBack * 60 * 60 * 1000);
    filtered = filtered.filter((m) => new Date(m.timestamp) > cutoff);
  }

  const byReason: Record<RejectionReason, number> = {
    OUTSIDE_DISTANCE_RADIUS: 0,
    OUTSIDE_TIME_WINDOW: 0,
    MISSING_LOCATION: 0,
    EVENT_NOT_FOUND: 0,
    NOT_POSTED_DURING_EVENT: 0,
    WRONG_CALENDAR_DAY: 0,
    GRACE_PERIOD_EXPIRED: 0,
  };

  const byContentType = { story: 0, post: 0 };
  const byUser: Record<string, number> = {};

  for (const metric of filtered) {
    byReason[metric.reason]++;
    byContentType[metric.contentType]++;
    byUser[metric.userId] = (byUser[metric.userId] ?? 0) + 1;
  }

  const topFailures = Object.entries(byReason)
    .map(([reason, count]) => ({ reason: reason as RejectionReason, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    total: filtered.length,
    byReason,
    byContentType,
    byUser,
    topFailures,
  };
}

/**
 * Print metrics summary
 */
export function printMetricsSummary(filters?: Parameters<typeof getMetrics>[0]): void {
  const metrics = getMetrics(filters);

  console.log('\n📊 GEOFENCING REJECTION METRICS');
  console.log('='.repeat(60));

  console.log(`\nTotal Rejections: ${metrics.total}`);

  console.log('\nBy Content Type:');
  console.log(`  Stories: ${metrics.byContentType.story}`);
  console.log(`  Posts: ${metrics.byContentType.post}`);

  console.log('\nTop Rejection Reasons:');
  for (const { reason, count } of metrics.topFailures) {
    const percentage = ((count / metrics.total) * 100).toFixed(1);
    console.log(`  ${reason}: ${count} (${percentage}%)`);
  }

  if (Object.keys(metrics.byUser).length > 0) {
    console.log('\nTop Failing Users:');
    const topUsers = Object.entries(metrics.byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [userId, count] of topUsers) {
      console.log(`  ${userId}: ${count} rejections`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Clear metrics buffer
 */
export function clearMetrics(): void {
  rejectionMetrics.length = 0;
}

/**
 * Export metrics as JSON
 */
export function exportMetricsJSON(): string {
  return JSON.stringify(rejectionMetrics, null, 2);
}
