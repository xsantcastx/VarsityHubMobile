import { httpGet } from '@/api/http';

/**
 * Zip Code Radius & Alternatives Utilities
 * 
 * Handles zip code validation, nearby zip suggestions,
 * and ad capacity checking for 20-mile radius coverage
 */

interface ZipCodeLocation {
  zip: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
}

interface ZipCodeAvailability {
  zip: string;
  available: boolean;
  capacity: number;
  reserved: number;
  distance?: number; // miles from original zip
}


/**
 * Validates US zip code format
 */
export function isValidZipCode(zip: string): boolean {
  // 5-digit or 5+4 format
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

/**
 * Normalizes zip code to 5-digit format
 */
export function normalizeZipCode(zip: string): string {
  return zip.replace(/[^\d]/g, '').substring(0, 5);
}

/**
 * Calculates distance between two coordinates in miles
 * Using Haversine formula
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}


/**
 * Finds nearby zip codes within radius, sorted by distance
 */
export function findNearbyZipCodes(
  centerZip: ZipCodeLocation,
  allZips: ZipCodeLocation[],
  radiusMiles: number = 20
): Array<ZipCodeLocation & { distance: number }> {
  return allZips
    .filter((zip) => zip.zip !== centerZip.zip)
    .map((zip) => ({
      ...zip,
      distance: calculateDistanceMiles(
        centerZip.latitude,
        centerZip.longitude,
        zip.latitude,
        zip.longitude
      ),
    }))
    .filter((zip) => zip.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Mock function to check ad capacity for a zip code
 * In production, this would call the backend API
 */
export async function checkZipCapacity(
  zip: string,
  dateRange: string[]
): Promise<ZipCodeAvailability> {
  const normalizedZip = normalizeZipCode(zip);
  const uniqueDates = Array.from(
    new Set(
      dateRange
        .map((d) => String(d).trim())
        .filter(Boolean)
    )
  );

  if (!uniqueDates.length) {
    throw new Error('No reservation dates provided');
  }

  const sortedDates = [...uniqueDates].sort();
  const from = sortedDates[0];
  const to = sortedDates[sortedDates.length - 1];

  const query = `/ads/availability?zip=${encodeURIComponent(normalizedZip)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = await httpGet(query);

  const maxSlotsPerDate =
    typeof response?.maxSlotsPerDate === 'number' ? response.maxSlotsPerDate : 3;
  const availability: Record<
    string,
    { available?: boolean; slotsUsed?: number; slotsRemaining?: number }
  > = response?.availability || {};

  let highestReserved = 0;
  const allDatesAvailable = uniqueDates.every((date) => {
    const entry = availability[date];
    const slotsUsed = typeof entry?.slotsUsed === 'number' ? entry.slotsUsed : 0;
    highestReserved = Math.max(highestReserved, slotsUsed);
    if (entry?.available === false) {
      return false;
    }
    return true;
  });

  return {
    zip: normalizedZip,
    available: allDatesAvailable,
    capacity: maxSlotsPerDate,
    reserved: Math.min(maxSlotsPerDate, highestReserved),
  };
}


/**
 * Formats distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${(miles * 5280).toFixed(0)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Generates coverage area description
 */
export function getCoverageDescription(zip: string, radiusMiles: number = 20): string {
  return `Your ad will reach users within ${radiusMiles} miles of ${zip}`;
}

