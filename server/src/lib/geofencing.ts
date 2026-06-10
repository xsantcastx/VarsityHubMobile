/**
 * Geofencing utilities for location-based event posting
 *
 * BUSINESS RULES:
 * - Story Posts: open on game day and stay open until +48h, within 3km of venue
 * - Regular Posts: open 2 days before event start, stay live through the event,
 *   then remain open until +48h only for users who already posted to that same
 *   event while it was live, within 3km of venue
 * - Sample events/games (IDs starting with "sample-") bypass all geofencing checks
 *
 * This maintains authenticity and prevents users from different states from trolling games.
 */

import { prisma } from './prisma.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;
const REGULAR_POST_OPEN_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;
const REGULAR_POST_LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const REGULAR_POST_GRACE_WINDOW_MS = 48 * 60 * 60 * 1000;

export type PostingPermissionErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'NO_EVENT_LOCATION'
  | 'POSTING_WINDOW_CLOSED'
  | 'TOO_FAR_FROM_VENUE'
  | 'LOCATION_REQUIRED'
  | 'LOCATION_SPOOF_SUSPECTED';

export type PostingPermissionResult = {
  allowed: boolean;
  code?: PostingPermissionErrorCode;
  reason?: string;
  distance?: number;
};

export type PostPostingWindowState = 'before_open' | 'live' | 'grace' | 'closed';

const postingEventSelect = {
  id: true,
  title: true,
  date: true,
  latitude: true,
  longitude: true,
  location: true,
  game_id: true,
} as const;

type PostingEvent = Awaited<ReturnType<typeof loadPostingEvent>>;

const formatWindowDateTime = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @param unit 'km' or 'miles'
 * @returns Distance in specified unit
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'km' | 'miles' = 'miles'
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const radius = unit === 'km' ? EARTH_RADIUS_KM : EARTH_RADIUS_MILES;
  return radius * c;
}

/**
 * Check if a user is within the geofence of an event location
 * @param radiusKm Radius in kilometers (default: 0.5 miles for legacy compatibility)
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  eventLat: number,
  eventLon: number,
  radiusKm: number = 0.8 // Default: 0.8km (roughly 0.5 miles) for backwards compatibility
): boolean {
  const distance = calculateDistance(userLat, userLon, eventLat, eventLon, 'km');
  return distance <= radiusKm;
}

/**
 * Check if posting window is open for stories.
 * Stories open on the UTC day of the event and stay open for 48 hours after
 * the event start so recaps and late uploads remain possible after the game.
 */
export function isStoryPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const eventStartDayUtc = new Date(`${eventDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const windowEnd = new Date(eventDate.getTime() + 48 * 60 * 60 * 1000);
  return now >= eventStartDayUtc && now <= windowEnd;
}

/**
 * Check if posting window is open for regular posts
 * Posts: opens 2 days before event start. After the live window, posting remains open until
 * +48h only for users who already posted to that event while it was live.
 */
export function isPostPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const state = getPostPostingWindowState(eventDate, now);
  return state !== 'before_open' && state !== 'closed';
}

export function getPostPostingWindowBounds(eventDate: Date) {
  const eventTime = new Date(eventDate);
  const windowStart = new Date(eventTime.getTime() - REGULAR_POST_OPEN_BEFORE_MS);
  const liveCutoff = new Date(eventTime.getTime() + REGULAR_POST_LIVE_WINDOW_MS);
  const windowEnd = new Date(eventTime.getTime() + REGULAR_POST_GRACE_WINDOW_MS);

  return {
    eventTime,
    windowStart,
    liveCutoff,
    windowEnd,
  };
}

export function getPostPostingWindowState(
  eventDate: Date,
  now: Date = new Date()
): PostPostingWindowState {
  const { windowStart, liveCutoff, windowEnd } = getPostPostingWindowBounds(eventDate);
  if (now < windowStart) return 'before_open';
  if (now <= liveCutoff) return 'live';
  if (now <= windowEnd) return 'grace';
  return 'closed';
}

/**
 * Check if posting window is open for an event (legacy - kept for backwards compatibility)
 * @deprecated Use isStoryPostingWindowOpen or isPostPostingWindowOpen instead
 */
export function isPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const eventTime = new Date(eventDate);
  const windowOpenTime = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000);
  return now >= windowOpenTime;
}

async function loadPostingEvent(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: postingEventSelect,
  });
}

async function resolveVenueCoordinates(event: PostingEvent) {
  let venueLat = typeof event?.latitude === 'number' ? event.latitude : null;
  let venueLon = typeof event?.longitude === 'number' ? event.longitude : null;
  if (venueLat == null || venueLon == null) {
    const game = event?.game_id
      ? await prisma.game.findUnique({
          where: { id: event.game_id },
          select: { latitude: true, longitude: true, venue_lat: true, venue_lng: true },
        })
      : null;
    venueLat = venueLat ?? game?.latitude ?? game?.venue_lat ?? null;
    venueLon = venueLon ?? game?.longitude ?? game?.venue_lng ?? null;
  }
  return { venueLat, venueLon };
}

/**
 * Verify user can post a story to an event based on location and time
 * Stories: event day through +48h, 3km radius
 * @returns { allowed: boolean; reason?: string; distance?: number }
 */
// v1.0.2 pass 9: server-side anti-spoof for client-supplied geofence coords. We can't fully
// trust GPS from the client (rooted device, mock locations, modified app binary), so we add
// a coarse IP-geo cross-check. If client coords differ from IP region by >250 miles, reject.
// Won't stop a determined attacker with VPN at the venue's region, but raises the bar for
// trivial spoofing.
async function verifyClientCoordsVsIp(
  userLat: number,
  userLon: number,
  ipAddress: string | null
): Promise<{ ok: boolean; reason?: string }> {
  // v1.0.2 pass 10: ops escape hatch. If ipapi.co rate-limits or has an outage, set
  // DISABLE_GEOFENCE_IP_CHECK=1 in Railway env to skip the cross-check and let stories through.
  if (
    process.env.DISABLE_GEOFENCE_IP_CHECK === '1' ||
    process.env.DISABLE_GEOFENCE_IP_CHECK === 'true'
  ) {
    return { ok: true };
  }
  if (
    !ipAddress ||
    ipAddress === '::1' ||
    ipAddress === '127.0.0.1' ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('192.168.')
  ) {
    // Local/private IP — skip check (dev / VPN through corporate net are common false positives)
    return { ok: true };
  }
  try {
    // ipapi.co is free for ~1k req/day; fall through silently if it fails so we don't break the feature
    const resp = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return { ok: true };
    const data: any = await resp.json();
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number')
      return { ok: true };
    const distMi = calculateDistance(userLat, userLon, data.latitude, data.longitude, 'miles');
    if (distMi > 250) {
      return {
        ok: false,
        reason: `Reported location is ${Math.round(distMi)}mi from your network location. If you're using a VPN, please disable it.`,
      };
    }
    return { ok: true };
  } catch {
    // Network failure or rate limit — don't block legitimate users; let geofence proceed
    return { ok: true };
  }
}

export async function verifyStoryPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null,
  ipAddress?: string | null
): Promise<PostingPermissionResult> {
  const event = await loadPostingEvent(eventId);

  if (!event) {
    return { allowed: false, code: 'EVENT_NOT_FOUND', reason: 'Event not found' };
  }

  // Check if story posting window is open (event day through +48h)
  if (!isStoryPostingWindowOpen(event.date)) {
    const gameDay = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const windowEnd = new Date(event.date.getTime() + 48 * 60 * 60 * 1000);
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Stories can be posted from game day (${gameDay}) until ${formatWindowDateTime(windowEnd)}.`,
    };
  }

  const { venueLat, venueLon } = await resolveVenueCoordinates(event);
  if (venueLat == null || venueLon == null) {
    console.warn(`Event ${eventId} and game missing coordinates - blocking story upload`);
    return {
      allowed: false,
      code: 'NO_EVENT_LOCATION',
      reason:
        'This event has no venue coordinates, so story uploads are disabled until the location is configured.',
    };
  }

  // Check if user provided their location
  if (userLat === null || userLon === null) {
    return {
      allowed: false,
      code: 'LOCATION_REQUIRED',
      reason: 'Location access required. You must be at the game venue to post a story.',
    };
  }

  // Check if user is within 3km geofence (using resolved venue coords)
  const distance = calculateDistance(userLat, userLon, venueLat!, venueLon!, 'km');
  const isWithin = isWithinGeofence(userLat, userLon, venueLat!, venueLon!, 3.0); // 3km for stories

  if (!isWithin) {
    return {
      allowed: false,
      code: 'TOO_FAR_FROM_VENUE',
      reason: 'You must be within 3 km of the venue to post a story.',
      distance,
    };
  }

  // v1.0.2 pass 9: anti-spoof — IP cross-check. If client says "I'm at venue X" but their
  // network IP is in a different region, reject. Best-effort; never blocks on API failure.
  if (ipAddress) {
    const ipCheck = await verifyClientCoordsVsIp(userLat, userLon, ipAddress);
    if (!ipCheck.ok) {
      return {
        allowed: false,
        code: 'LOCATION_SPOOF_SUSPECTED',
        reason: ipCheck.reason || 'Reported location does not match your network location.',
      };
    }
  }

  return { allowed: true, distance };
}

/**
 * Verify user can post to an event based on location and time
 * Posts: open 2 days before event start, stay open through the live window, then allow
 * a +48h grace period only for users who already posted to that event while it was live.
 * @returns { allowed: boolean; reason?: string; distance?: number }
 */
export async function verifyEventPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null
): Promise<PostingPermissionResult> {
  const event = await loadPostingEvent(eventId);

  if (!event) {
    return { allowed: false, code: 'EVENT_NOT_FOUND', reason: 'Event not found' };
  }

  const { windowStart, liveCutoff, windowEnd } = getPostPostingWindowBounds(event.date);
  const postingWindowState = getPostPostingWindowState(event.date);

  if (postingWindowState === 'before_open' || postingWindowState === 'closed') {
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Posting opens ${formatWindowDateTime(windowStart)} and closes ${formatWindowDateTime(windowEnd)}.`,
    };
  }

  if (postingWindowState === 'grace') {
    const priorLivePost = event.game_id
      ? await prisma.post.findFirst({
          where: {
            author_id: userId,
            game_id: event.game_id,
            deleted_at: null,
            created_at: {
              gte: new Date(event.date),
              lte: liveCutoff,
            },
          },
          select: { id: true },
        })
      : null;

    if (!priorLivePost) {
      return {
        allowed: false,
        code: 'POSTING_WINDOW_CLOSED',
        reason: `Post-event uploads stay open until ${formatWindowDateTime(windowEnd)}, but only if you already posted to this event while it was live.`,
      };
    }
  }

  const { venueLat, venueLon } = await resolveVenueCoordinates(event);
  if (venueLat == null || venueLon == null) {
    console.warn(`Event ${eventId} and game missing coordinates - blocking post upload`);
    return {
      allowed: false,
      code: 'NO_EVENT_LOCATION',
      reason:
        'This event has no venue coordinates, so posting is disabled until the location is configured.',
    };
  }

  // Check if user provided their location
  if (userLat === null || userLon === null) {
    return {
      allowed: false,
      code: 'LOCATION_REQUIRED',
      reason: 'Location access required. You must be at the game venue to post.',
    };
  }

  // Check if user is within 3km geofence (using resolved venue coords)
  const distance = calculateDistance(userLat, userLon, venueLat, venueLon, 'km');
  const isWithin = isWithinGeofence(userLat, userLon, venueLat, venueLon, 3.0); // 3km for posts

  if (!isWithin) {
    return {
      allowed: false,
      code: 'TOO_FAR_FROM_VENUE',
      reason: 'You must be within 3 km of the venue to post.',
      distance,
    };
  }

  return { allowed: true, distance };
}
