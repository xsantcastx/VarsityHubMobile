/**
 * Geofencing utilities for location-based event posting
 * 
 * BUSINESS RULE: Users can only upload content to an event page when physically AT the game location.
 * This maintains authenticity and prevents users from different states from trolling games.
 * 
 * GRACE PERIOD: Once a user successfully posts from within the geofence, they get a 48-hour
 * grace period (tracked via EventPostAccess) to create additional content without live location checks.
 * After 48 hours from the event, no new posts are allowed.
 */

import { prisma } from './prisma.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;
const GEOFENCE_RADIUS_MILES = 0.5; // ~800 meters - at or very near venue
const POSTING_WINDOW_HOURS_BEFORE = 24;
const GRACE_PERIOD_HOURS_AFTER = 48;
const STORY_RADIUS_KM = 30; // ~18.6 miles for story proximity

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
 * Default: 0.5 miles (roughly 800 meters) - should be at or very near the venue
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  eventLat: number,
  eventLon: number,
  radiusMiles: number = GEOFENCE_RADIUS_MILES
): boolean {
  const distance = calculateDistance(userLat, userLon, eventLat, eventLon, 'miles');
  return distance <= radiusMiles;
}

/**
 * Check if posting window is still open for an event
 * Posting opens 24 hours before event and closes 48 hours after
 */
export function isPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const eventTime = new Date(eventDate);
  const windowOpenTime = new Date(eventTime.getTime() - POSTING_WINDOW_HOURS_BEFORE * 60 * 60 * 1000);
  const windowCloseTime = new Date(eventTime.getTime() + GRACE_PERIOD_HOURS_AFTER * 60 * 60 * 1000);
  
  return now >= windowOpenTime && now < windowCloseTime;
}

/**
 * Check if user has valid EventPostAccess for this event
 * Used to allow posts without live location verification if they previously posted while at venue
 */
export async function hasValidEventPostAccess(
  eventId: string,
  userId: string
): Promise<boolean> {
  const access = await prisma.eventPostAccess.findUnique({
    where: {
      event_id_user_id: {
        event_id: eventId,
        user_id: userId,
      },
    },
  });

  if (!access) {
    return false;
  }

  const now = new Date();
  return now < access.expires_at;
}

/**
 * Create or update an EventPostAccess record for a user at an event
 * This is called when a user successfully posts from within the geofence
 */
export async function grantEventPostAccess(
  eventId: string,
  userId: string,
  eventDate: Date
): Promise<void> {
  const expiresAt = new Date(eventDate.getTime() + GRACE_PERIOD_HOURS_AFTER * 60 * 60 * 1000);

  // Upsert: create or update the record
  await prisma.eventPostAccess.upsert({
    where: {
      event_id_user_id: {
        event_id: eventId,
        user_id: userId,
      },
    },
    create: {
      event_id: eventId,
      user_id: userId,
      expires_at: expiresAt,
    },
    update: {
      expires_at: expiresAt,
    },
  });
}

/**
 * Check if user has an RSVP for the event and the event has started
 * If true and within the 48-hour window, allow as a bypass
 */
async function hasRsvpBypass(eventId: string, userId: string, eventDate: Date): Promise<boolean> {
  const now = new Date();
  const eventTime = new Date(eventDate);
  const windowCloseTime = new Date(eventTime.getTime() + GRACE_PERIOD_HOURS_AFTER * 60 * 60 * 1000);

  if (now < eventTime || now >= windowCloseTime) return false;

  const rsvp = await prisma.eventRsvp.findUnique({
    where: {
      event_id_user_id: {
        event_id: eventId,
        user_id: userId,
      },
    },
  });
  return !!rsvp;
}

/**
 * Verify user can post to an event based on location, time, and prior participation
 * 
 * Returns result object with:
 * - allowed: boolean - whether post is permitted
 * - reason?: string - why post was rejected (if applicable)
 * - distance?: number - distance from venue in miles
 * - usedCachedAccess?: boolean - whether they used the 48h grace period instead of live location
 */
export async function verifyEventPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null
): Promise<{
  allowed: boolean;
  reason?: string;
  distance?: number;
  usedCachedAccess?: boolean;
}> {
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
    },
  });

  if (!event) {
    return { allowed: false, reason: 'Event not found' };
  }

  // Check if posting window is still open (24 h before through 48 h after)
  if (!isPostingWindowOpen(event.date)) {
    const eventTime = new Date(event.date);
    const windowOpenTime = new Date(eventTime.getTime() - POSTING_WINDOW_HOURS_BEFORE * 60 * 60 * 1000);
    const windowCloseTime = new Date(eventTime.getTime() + GRACE_PERIOD_HOURS_AFTER * 60 * 60 * 1000);

    if (new Date() < windowOpenTime) {
      return {
        allowed: false,
        reason: `Posting opens 24 hours before the game at ${windowOpenTime.toLocaleString()}`,
      };
    } else {
      return {
        allowed: false,
        reason: `Posting window closed. You can post up to 48 hours after the event (until ${windowCloseTime.toLocaleString()}).`,
      };
    }
  }

  // Check if event has location coordinates
  if (!event.latitude || !event.longitude) {
    // If event doesn't have coordinates, allow posting (legacy support)
    console.warn(`Event ${eventId} missing coordinates - allowing post without geofence`);
    return { allowed: true };
  }

  // Check if user has valid EventPostAccess (48-hour grace period)
  const hasAccess = await hasValidEventPostAccess(eventId, userId);
  if (hasAccess) {
    return { allowed: true, usedCachedAccess: true };
  }

  // Determine if this is a subsequent post for this event
  const priorPostsCount = await prisma.post.count({ where: { event_id: eventId, author_id: userId } });

  // RSVP-based bypass is allowed for subsequent posts only, once event has started
  if (priorPostsCount > 0) {
    const rsvpBypass = await hasRsvpBypass(eventId, userId, event.date);
    if (rsvpBypass) {
      return { allowed: true, usedCachedAccess: true };
    }
  }

  // User doesn't have cached access; require live location verification
  if (userLat === null || userLon === null) {
    return {
      allowed: false,
      reason: 'Location access required. You must be at the game venue to post.',
    };
  }

  // Check if user is within geofence
  const distance = calculateDistance(userLat, userLon, event.latitude, event.longitude, 'miles');
  const isWithin = isWithinGeofence(userLat, userLon, event.latitude, event.longitude);

  if (!isWithin) {
    return {
      allowed: false,
      reason: `You must be at ${event.location || 'the game venue'} to post. You are ${distance.toFixed(2)} miles away.`,
      distance,
    };
  }

  return { allowed: true, distance };
}

/**
 * Verify user can create a story for a game/event
 * Stories are only allowed on the day of the event (or 24h before if event time is at night)
 * 
 * If stories also require physical presence, this will check geofence and EventPostAccess
 * For now, only time enforcement is required by product rules
 */
export async function verifyStoryCreationPermission(
  gameId: string,
  userId: string,
  userLat: number | null = null,
  userLon: number | null = null,
  requirePhysicalPresence: boolean = false
): Promise<{
  allowed: boolean;
  reason?: string;
  distance?: number;
  usedCachedAccess?: boolean;
}> {
  // Find the game
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      title: true,
      date: true,
      latitude: true,
      longitude: true,
      location: true,
    },
  });

  if (!game) {
    return { allowed: false, reason: 'Game not found' };
  }

  // Enforce calendar day of the event and proximity within 30km
  const now = new Date();
  const eventDate = new Date(game.date);
  const dayStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59, 999);

  if (now < dayStart || now > dayEnd) {
    return {
      allowed: false,
      reason: `Stories can be posted only on the day of the event (${dayStart.toDateString()}).`,
    };
  }

  if (!game.latitude || !game.longitude) {
    console.warn(`Game ${gameId} missing coordinates - allowing story without proximity check`);
    return { allowed: true };
  }

  if (userLat === null || userLon === null) {
    return {
      allowed: false,
      reason: 'Location required. Stories need your current location to confirm proximity.',
    };
  }

  const distanceKm = calculateDistance(userLat, userLon, game.latitude, game.longitude, 'km');
  if (distanceKm > STORY_RADIUS_KM) {
    return {
      allowed: false,
      reason: `You must be within ${STORY_RADIUS_KM} km of the venue to post stories. You are ${distanceKm.toFixed(2)} km away.`,
      distance: distanceKm,
    };
  }

  return { allowed: true };
}
