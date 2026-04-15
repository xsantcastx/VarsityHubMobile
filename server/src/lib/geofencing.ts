/**
 * Geofencing utilities for location-based event posting
 * 
 * BUSINESS RULES:
 * - Story Posts: 24-hour window (12h before to 12h after game), within 1km of venue
 * - Regular Posts: 4-day window (2 days before to 1 day after game), within 3km of venue
 * - Sample events/games (IDs starting with "sample-") bypass all geofencing checks
 * 
 * This maintains authenticity and prevents users from different states from trolling games.
 */

import { prisma } from './prisma.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;

export type PostingPermissionErrorCode =
  | 'EVENT_NOT_FOUND'
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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
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
 * Check if posting window is open for stories
 * Stories: open from midnight UTC on event day until end of the following UTC day.
 * The extra UTC day covers US timezones (UTC-5 to UTC-8) where a game in the evening
 * extends past UTC midnight, so "end of day" locally is already the next UTC day.
 */
export function isStoryPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const eventDay = eventDate.toISOString().slice(0, 10);
  const todayDay = now.toISOString().slice(0, 10);
  if (eventDay === todayDay) return true;
  // Also allow posting on the UTC day immediately after game day (covers US evening games)
  const dayAfterEvent = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return dayAfterEvent === todayDay;
}

/**
 * Check if posting window is open for regular posts
 * Posts: opens 2 days before event, closes at end of event day (midnight UTC day after event,
 * plus 8h buffer for US timezones so Pacific-time users can post until their local midnight).
 */
export function isPostPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const eventTime = new Date(eventDate);
  const windowStart = new Date(eventTime.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days before
  // End: midnight UTC the day after event day + 8h buffer for US westernmost timezone (UTC-8)
  const endOfEventDay = new Date(Date.UTC(
    eventTime.getUTCFullYear(),
    eventTime.getUTCMonth(),
    eventTime.getUTCDate() + 1,
  ));
  const windowEnd = new Date(endOfEventDay.getTime() + 8 * 60 * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
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

/**
 * Verify user can post a story to an event based on location and time
 * Stories: 24-hour window (12h before to 12h after game), 1km radius
 * @returns { allowed: boolean; reason?: string; distance?: number }
 */
// v1.0.2 pass 9: server-side anti-spoof for client-supplied geofence coords. We can't fully
// trust GPS from the client (rooted device, mock locations, modified app binary), so we add
// a coarse IP-geo cross-check. If client coords differ from IP region by >250 miles, reject.
// Won't stop a determined attacker with VPN at the venue's region, but raises the bar for
// trivial spoofing.
async function verifyClientCoordsVsIp(userLat: number, userLon: number, ipAddress: string | null): Promise<{ ok: boolean; reason?: string }> {
  // v1.0.2 pass 10: ops escape hatch. If ipapi.co rate-limits or has an outage, set
  // DISABLE_GEOFENCE_IP_CHECK=1 in Railway env to skip the cross-check and let stories through.
  if (process.env.DISABLE_GEOFENCE_IP_CHECK === '1' || process.env.DISABLE_GEOFENCE_IP_CHECK === 'true') {
    return { ok: true };
  }
  if (!ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('10.') || ipAddress.startsWith('192.168.')) {
    // Local/private IP — skip check (dev / VPN through corporate net are common false positives)
    return { ok: true };
  }
  try {
    // ipapi.co is free for ~1k req/day; fall through silently if it fails so we don't break the feature
    const resp = await fetch(`https://ipapi.co/${ipAddress}/json/`, { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) return { ok: true };
    const data: any = await resp.json();
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') return { ok: true };
    const distMi = calculateDistance(userLat, userLon, data.latitude, data.longitude, 'miles');
    if (distMi > 250) {
      return { ok: false, reason: `Reported location is ${Math.round(distMi)}mi from your network location. If you're using a VPN, please disable it.` };
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
  ipAddress?: string | null,
): Promise<PostingPermissionResult> {
  // Get event details
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      latitude: true,
      longitude: true,
      location: true,
      game_id: true,
    },
  });

  if (!event) {
    return { allowed: false, code: 'EVENT_NOT_FOUND', reason: 'Event not found' };
  }

  // Check if story posting window is open (game-day only)
  if (!isStoryPostingWindowOpen(event.date)) {
    const gameDay = new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Stories can only be posted on game day (${gameDay}).`,
    };
  }

  // Resolve venue coordinates: event first, then fall back to game
  let venueLat = typeof event.latitude === 'number' ? event.latitude : null;
  let venueLon = typeof event.longitude === 'number' ? event.longitude : null;
  if (venueLat == null || venueLon == null) {
    const game = event.game_id
      ? await prisma.game.findUnique({
          where: { id: event.game_id },
          select: { latitude: true, longitude: true, venue_lat: true, venue_lng: true },
        })
      : null;
    venueLat = venueLat ?? game?.latitude ?? game?.venue_lat ?? null;
    venueLon = venueLon ?? game?.longitude ?? game?.venue_lng ?? null;
  }
  if (venueLat == null || venueLon == null) {
    console.warn(`Event ${eventId} and game missing coordinates - allowing story without geofence`);
    return { allowed: true };
  }

  // Check if user provided their location
  if (userLat === null || userLon === null) {
    return {
      allowed: false,
      code: 'LOCATION_REQUIRED',
      reason: 'Location access required. You must be at the game venue to post a story.',
    };
  }

  // Check if user is within 1km geofence (using resolved venue coords)
  const distance = calculateDistance(userLat, userLon, venueLat!, venueLon!, 'km');
  const isWithin = isWithinGeofence(userLat, userLon, venueLat!, venueLon!, 1.0); // 1km for stories

  if (!isWithin) {
    return {
      allowed: false,
      code: 'TOO_FAR_FROM_VENUE',
      reason: 'You must be within 1 km of the venue to post a story.',
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
 * Posts: 4-day window (2 days before to 1 day after game), 3km radius
 * @returns { allowed: boolean; reason?: string; distance?: number }
 */
export async function verifyEventPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null
): Promise<PostingPermissionResult> {
  // Get event details
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      latitude: true,
      longitude: true,
      location: true,
      game_id: true,
    },
  });

  if (!event) {
    return { allowed: false, code: 'EVENT_NOT_FOUND', reason: 'Event not found' };
  }

  // Check if posting window is open (2 days before to end of event day)
  if (!isPostPostingWindowOpen(event.date)) {
    const eventTime = new Date(event.date);
    const windowStart = new Date(eventTime.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endOfEventDay = new Date(Date.UTC(
      eventTime.getUTCFullYear(),
      eventTime.getUTCMonth(),
      eventTime.getUTCDate() + 1,
    ));
    const windowEnd = new Date(endOfEventDay.getTime() + 8 * 60 * 60 * 1000);
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Posting opens ${formatWindowDateTime(windowStart)} and closes ${formatWindowDateTime(windowEnd)}.`,
    };
  }

  // Resolve venue coordinates: event first, then fall back to game
  let venueLat = typeof event.latitude === 'number' ? event.latitude : null;
  let venueLon = typeof event.longitude === 'number' ? event.longitude : null;
  if (venueLat == null || venueLon == null) {
    const game = event.game_id
      ? await prisma.game.findUnique({
          where: { id: event.game_id },
          select: { latitude: true, longitude: true, venue_lat: true, venue_lng: true },
        })
      : null;
    venueLat = venueLat ?? game?.latitude ?? game?.venue_lat ?? null;
    venueLon = venueLon ?? game?.longitude ?? game?.venue_lng ?? null;
  }
  if (venueLat == null || venueLon == null) {
    console.warn(`Event ${eventId} and game missing coordinates - allowing post without geofence`);
    return { allowed: true };
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
