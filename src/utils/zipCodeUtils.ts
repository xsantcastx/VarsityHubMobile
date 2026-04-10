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
    .filter(zip => zip.zip !== centerZip.zip)
    .map(zip => ({
      ...zip,
      distance: calculateDistanceMiles(
        centerZip.latitude,
        centerZip.longitude,
        zip.latitude,
        zip.longitude
      ),
    }))
    .filter(zip => zip.distance <= radiusMiles)
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
  const uniqueDates = Array.from(new Set(dateRange.map(d => String(d).trim()).filter(Boolean)));

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
  const allDatesAvailable = uniqueDates.every(date => {
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

/**
 * Mock zip code database (in production, use real geocoding API)
 */
export const MOCK_ZIP_DATABASE: ZipCodeLocation[] = [
  // San Francisco Bay Area
  { zip: '94102', latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', state: 'CA' },
  { zip: '94103', latitude: 37.7716, longitude: -122.4094, city: 'San Francisco', state: 'CA' },
  { zip: '94110', latitude: 37.7485, longitude: -122.4184, city: 'San Francisco', state: 'CA' },
  { zip: '94115', latitude: 37.7858, longitude: -122.4364, city: 'San Francisco', state: 'CA' },
  { zip: '94133', latitude: 37.8025, longitude: -122.4093, city: 'San Francisco', state: 'CA' },
  { zip: '94301', latitude: 37.4419, longitude: -122.143, city: 'Palo Alto', state: 'CA' },
  { zip: '94401', latitude: 37.563, longitude: -122.3255, city: 'San Mateo', state: 'CA' },

  // Los Angeles Area
  { zip: '90001', latitude: 33.9731, longitude: -118.2479, city: 'Los Angeles', state: 'CA' },
  { zip: '90012', latitude: 34.0601, longitude: -118.2385, city: 'Los Angeles', state: 'CA' },
  { zip: '90210', latitude: 34.0696, longitude: -118.406, city: 'Beverly Hills', state: 'CA' },
  { zip: '90401', latitude: 34.0154, longitude: -118.4962, city: 'Santa Monica', state: 'CA' },

  // New York Area
  { zip: '10001', latitude: 40.7506, longitude: -73.9971, city: 'New York', state: 'NY' },
  { zip: '10002', latitude: 40.7157, longitude: -73.986, city: 'New York', state: 'NY' },
  { zip: '10003', latitude: 40.7317, longitude: -73.989, city: 'New York', state: 'NY' },
  { zip: '11201', latitude: 40.694, longitude: -73.9895, city: 'Brooklyn', state: 'NY' },

  // Chicago Area
  { zip: '60601', latitude: 41.8857, longitude: -87.6197, city: 'Chicago', state: 'IL' },
  { zip: '60602', latitude: 41.8827, longitude: -87.6298, city: 'Chicago', state: 'IL' },
  { zip: '60614', latitude: 41.9206, longitude: -87.653, city: 'Chicago', state: 'IL' },
];

/**
 * Lookup zip code location (mock implementation)
 */
export async function lookupZipCode(zip: string): Promise<ZipCodeLocation | null> {
  const normalized = normalizeZipCode(zip);

  // In production, call geocoding API
  // const response = await fetch(`https://api.geocoding.service/zip/${normalized}`);

  // Mock lookup
  const found = MOCK_ZIP_DATABASE.find(z => z.zip === normalized);
  return found || null;
}
