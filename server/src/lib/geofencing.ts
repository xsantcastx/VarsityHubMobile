/**
 * Geofencing utilities for location-based event posting
 * 
 * BUSINESS RULE: Users can only upload content to an event page when physically AT the game location.
 * This maintains authenticity and prevents users from different states from trolling games.
 */

import { prisma } from './prisma.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;

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
  radiusMiles: number = 0.5
): boolean {
  const distance = calculateDistance(userLat, userLon, eventLat, eventLon, 'miles');
  return distance <= radiusMiles;
}

/**
 * Check if posting window is open for an event
 * Posting opens 24 hours before game start time
 */
export function isPostingWindowOpen(eventDate: Date): boolean {
  const now = new Date();
  const eventTime = new Date(eventDate);
  const windowOpenTime = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
  
  return now >= windowOpenTime;
}

/**
 * Verify user can post to an event based on location and time
 * @returns { allowed: boolean; reason?: string }
 */
export async function verifyEventPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null
): Promise<{ allowed: boolean; reason?: string; distance?: number }> {
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

  // Check if posting window is open (24 hours before game)
  if (!isPostingWindowOpen(event.date)) {
    const eventTime = new Date(event.date);
    const windowOpenTime = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000);
    return {
      allowed: false,
      reason: `Posting opens 24 hours before the game at ${windowOpenTime.toLocaleString()}`,
    };
  }

  // Check if event has location coordinates
  if (!event.latitude || !event.longitude) {
    // If event doesn't have coordinates, allow posting (legacy support)
    // In production, all events should have coordinates
    console.warn(`Event ${eventId} missing coordinates - allowing post without geofence`);
    return { allowed: true };
  }

  // Check if user provided their location
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
