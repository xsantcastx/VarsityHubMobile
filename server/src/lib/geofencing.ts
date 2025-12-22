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

import { logRejection } from './geofence-telemetry.js';
import { prisma } from './prisma.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;
const GEOFENCE_RADIUS_MILES = 0.5; // ~800 meters - at or very near venue
const STORY_RADIUS_KM = 2; // Users must be within 2km to post stories
const POST_RADIUS_KM = 15; // Users must be within 15km to post event posts
const POSTING_WINDOW_HOURS_BEFORE = 48; // 2 days before event
const POSTING_WINDOW_HOURS_AFTER = 48; // 2 days after event (120h total: 48h before + 24h during + 48h after)

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
 * Verify user can post to an event based on location, time window, and proximity
 * 
 * BUSINESS RULE:
 * - Posts allowed in 120-hour window: 48h before event, during event day, 48h after event
 * - User must be within 15km of venue at time of posting
 * - No grace period - location checked on every post
 * 
 * Returns result object with:
 * - allowed: boolean - whether post is permitted
 * - reason?: string - why post was rejected (if applicable)
 * - distance?: number - distance from venue in km
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
    logRejection({
      timestamp: new Date().toISOString(),
      userId,
      eventId,
      contentType: 'post',
      reason: 'EVENT_NOT_FOUND',
      max_distance_km: POST_RADIUS_KM,
      message: 'Event not found',
    });
    return { allowed: false, reason: 'Event not found' };
  }

  // Check if posting window is still open (48h before through 48h after event)
  const now = new Date();
  const eventTime = new Date(event.date);
  const windowOpenTime = new Date(eventTime.getTime() - POSTING_WINDOW_HOURS_BEFORE * 60 * 60 * 1000);
  const windowCloseTime = new Date(eventTime.getTime() + POSTING_WINDOW_HOURS_AFTER * 60 * 60 * 1000);

  if (now < windowOpenTime) {
    const hoursFromEvent = (eventTime.getTime() - now.getTime()) / (60 * 60 * 1000);
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId,
      contentType: 'post',
      reason: 'OUTSIDE_TIME_WINDOW',
      max_distance_km: POST_RADIUS_KM,
      hours_from_event: hoursFromEvent,
      event_lat: event.latitude ?? undefined,
      event_lon: event.longitude ?? undefined,
      message: `Posting opens 48 hours before the game.`,
    });
    return {
      allowed: false,
      reason: `Posting opens 48 hours before the game at ${windowOpenTime.toLocaleString()}`,
    };
  }
  
  if (now >= windowCloseTime) {
    const hoursFromEvent = (eventTime.getTime() - now.getTime()) / (60 * 60 * 1000);
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId,
      contentType: 'post',
      reason: 'OUTSIDE_TIME_WINDOW',
      max_distance_km: POST_RADIUS_KM,
      hours_from_event: hoursFromEvent,
      event_lat: event.latitude ?? undefined,
      event_lon: event.longitude ?? undefined,
      message: 'Posting attempted after 48h window.',
    });
    return {
      allowed: false,
      reason: `Posting window closed. Posts are available up to 48 hours after the event (until ${windowCloseTime.toLocaleString()}).`,
    };
  }

  // AFTER EVENT RULE: If event has ended, only users who posted during the event can continue posting
  if (now > eventTime) {
    // Event has ended - check if user posted during the event
    const userPostedDuringEvent = await prisma.post.findFirst({
      where: {
        event_id: eventId,
        author_id: userId,
        created_at: {
          gte: eventTime,
          lt: new Date(eventTime.getTime() + 24 * 60 * 60 * 1000), // Within 24h after event start
        },
      },
    });

    if (!userPostedDuringEvent) {
      const hoursFromEvent = (now.getTime() - eventTime.getTime()) / (60 * 60 * 1000);
      logRejection({
        timestamp: now.toISOString(),
        userId,
        eventId,
        contentType: 'post',
        reason: 'NOT_POSTED_DURING_EVENT',
        max_distance_km: POST_RADIUS_KM,
        hours_from_event: hoursFromEvent,
        message: 'User did not post during event; post-event uploads blocked.',
      });
      return {
        allowed: false,
        reason: `You must have posted during the event to continue posting after it ends.`,
      };
    }
  }

  // Check if event has location coordinates
  if (!event.latitude || !event.longitude) {
    // If event doesn't have coordinates, allow posting (legacy support)
    console.warn(`Event ${eventId} missing coordinates - allowing post without geofence`);
    return { allowed: true };
  }

  // Location is required for every post
  if (userLat === null || userLon === null) {
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId,
      contentType: 'post',
      reason: 'MISSING_LOCATION',
      max_distance_km: POST_RADIUS_KM,
      hours_from_event: (eventTime.getTime() - now.getTime()) / (60 * 60 * 1000),
      event_lat: event.latitude ?? undefined,
      event_lon: event.longitude ?? undefined,
      message: 'Location access required for event posts.',
    });
    return {
      allowed: false,
      reason: 'Location access required. You must be within 15km of the venue to post.',
    };
  }

  // Check if user is within 15km of venue
  const distanceKm = calculateDistance(userLat, userLon, event.latitude, event.longitude, 'km');
  if (distanceKm > POST_RADIUS_KM) {
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId,
      contentType: 'post',
      reason: 'OUTSIDE_DISTANCE_RADIUS',
      distance_km: distanceKm,
      max_distance_km: POST_RADIUS_KM,
      hours_from_event: (eventTime.getTime() - now.getTime()) / (60 * 60 * 1000),
      user_lat: userLat,
      user_lon: userLon,
      event_lat: event.latitude ?? undefined,
      event_lon: event.longitude ?? undefined,
      message: `User is ${distanceKm.toFixed(2)}km away (limit ${POST_RADIUS_KM}km).`,
    });
    return {
      allowed: false,
      reason: `You must be within ${POST_RADIUS_KM}km of ${event.location || 'the game venue'} to post. You are ${distanceKm.toFixed(2)}km away.`,
      distance: distanceKm,
    };
  }

  return { allowed: true, distance: distanceKm };
}

/**
 * Verify user can create a story for a game/event
 * 
 * BUSINESS RULE:
 * - Stories allowed only on the calendar day of the event (00:00 - 23:59 local time)
 * - User must be within 2km of the venue
 * - Expires at midnight on event day
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
    logRejection({
      timestamp: new Date().toISOString(),
      userId,
      eventId: gameId,
      contentType: 'story',
      reason: 'EVENT_NOT_FOUND',
      max_distance_km: STORY_RADIUS_KM,
      message: 'Game not found',
    });
    return { allowed: false, reason: 'Game not found' };
  }

  // Enforce calendar day of the event
  const now = new Date();
  const eventDate = new Date(game.date);
  const dayStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59, 999);

  if (now < dayStart || now > dayEnd) {
    const hoursFromEvent = (eventDate.getTime() - now.getTime()) / (60 * 60 * 1000);
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId: gameId,
      contentType: 'story',
      reason: 'WRONG_CALENDAR_DAY',
      max_distance_km: STORY_RADIUS_KM,
      hours_from_event: hoursFromEvent,
      event_lat: game.latitude ?? undefined,
      event_lon: game.longitude ?? undefined,
      message: `Stories limited to event day ${dayStart.toDateString()}.`,
    });
    return {
      allowed: false,
      reason: `Stories are available only on the day of the event (${dayStart.toDateString()}).`,
    };
  }

  if (!game.latitude || !game.longitude) {
    console.warn(`Game ${gameId} missing coordinates - allowing story without proximity check`);
    return { allowed: true };
  }

  if (userLat === null || userLon === null) {
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId: gameId,
      contentType: 'story',
      reason: 'MISSING_LOCATION',
      max_distance_km: STORY_RADIUS_KM,
      hours_from_event: (eventDate.getTime() - now.getTime()) / (60 * 60 * 1000),
      event_lat: game.latitude ?? undefined,
      event_lon: game.longitude ?? undefined,
      message: 'Location required for stories.',
    });
    return {
      allowed: false,
      reason: 'Location required. Stories need your current location to confirm proximity to the venue.',
    };
  }

  const distanceKm = calculateDistance(userLat, userLon, game.latitude, game.longitude, 'km');
  if (distanceKm > STORY_RADIUS_KM) {
    logRejection({
      timestamp: now.toISOString(),
      userId,
      eventId: gameId,
      contentType: 'story',
      reason: 'OUTSIDE_DISTANCE_RADIUS',
      distance_km: distanceKm,
      max_distance_km: STORY_RADIUS_KM,
      hours_from_event: (eventDate.getTime() - now.getTime()) / (60 * 60 * 1000),
      user_lat: userLat,
      user_lon: userLon,
      event_lat: game.latitude ?? undefined,
      event_lon: game.longitude ?? undefined,
      message: `User is ${distanceKm.toFixed(2)}km away (limit ${STORY_RADIUS_KM}km).`,
    });
    return {
      allowed: false,
      reason: `You must be within ${STORY_RADIUS_KM}km of ${game.location || 'the venue'} to post stories. You are ${distanceKm.toFixed(2)}km away.`,
      distance: distanceKm,
    };
  }

  return { allowed: true, distance: distanceKm };
}
