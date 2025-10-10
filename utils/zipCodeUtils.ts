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

interface ZipCodeSuggestion {
  original: string;
  alternatives: ZipCodeAvailability[];
  withinRadius: ZipCodeAvailability[];
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
 * Checks if a zip code is within radius of another
 */
export function isWithinRadius(
  zip1: ZipCodeLocation,
  zip2: ZipCodeLocation,
  radiusMiles: number = 20
): boolean {
  const distance = calculateDistanceMiles(
    zip1.latitude,
    zip1.longitude,
    zip2.latitude,
    zip2.longitude
  );
  return distance <= radiusMiles;
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
  // TODO: Replace with actual API call
  // Example: const response = await Advertisement.checkCapacity(zip, dateRange);
  
  // Mock implementation
  const capacity = 10; // slots per day
  const reserved = Math.floor(Math.random() * 12); // Random for demo
  
  return {
    zip,
    available: reserved < capacity,
    capacity,
    reserved: Math.min(reserved, capacity),
  };
}

/**
 * Suggests alternative zip codes when the requested zip is at capacity
 */
export async function suggestAlternativeZips(
  requestedZip: string,
  zipLocation: ZipCodeLocation,
  nearbyZips: ZipCodeLocation[],
  dateRange: string[],
  maxSuggestions: number = 5
): Promise<ZipCodeSuggestion> {
  // Check original zip capacity
  const originalCapacity = await checkZipCapacity(requestedZip, dateRange);

  // If original has capacity, return it
  if (originalCapacity.available) {
    return {
      original: requestedZip,
      alternatives: [],
      withinRadius: [originalCapacity],
    };
  }

  // Find nearby zips within 20-mile radius
  const nearby = findNearbyZipCodes(zipLocation, nearbyZips, 20);

  // Check capacity for nearby zips
  const capacityChecks = await Promise.all(
    nearby.slice(0, 15).map(async (zip) => {
      const capacity = await checkZipCapacity(zip.zip, dateRange);
      return {
        ...capacity,
        distance: zip.distance,
      };
    })
  );

  // Filter to available zips, sort by distance
  const available = capacityChecks
    .filter((zip) => zip.available)
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, maxSuggestions);

  return {
    original: requestedZip,
    alternatives: available,
    withinRadius: capacityChecks.slice(0, 10),
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
  { zip: '94301', latitude: 37.4419, longitude: -122.1430, city: 'Palo Alto', state: 'CA' },
  { zip: '94401', latitude: 37.5630, longitude: -122.3255, city: 'San Mateo', state: 'CA' },
  
  // Los Angeles Area
  { zip: '90001', latitude: 33.9731, longitude: -118.2479, city: 'Los Angeles', state: 'CA' },
  { zip: '90012', latitude: 34.0601, longitude: -118.2385, city: 'Los Angeles', state: 'CA' },
  { zip: '90210', latitude: 34.0696, longitude: -118.4060, city: 'Beverly Hills', state: 'CA' },
  { zip: '90401', latitude: 34.0154, longitude: -118.4962, city: 'Santa Monica', state: 'CA' },
  
  // New York Area
  { zip: '10001', latitude: 40.7506, longitude: -73.9971, city: 'New York', state: 'NY' },
  { zip: '10002', latitude: 40.7157, longitude: -73.9860, city: 'New York', state: 'NY' },
  { zip: '10003', latitude: 40.7317, longitude: -73.9890, city: 'New York', state: 'NY' },
  { zip: '11201', latitude: 40.6940, longitude: -73.9895, city: 'Brooklyn', state: 'NY' },
  
  // Chicago Area
  { zip: '60601', latitude: 41.8857, longitude: -87.6197, city: 'Chicago', state: 'IL' },
  { zip: '60602', latitude: 41.8827, longitude: -87.6298, city: 'Chicago', state: 'IL' },
  { zip: '60614', latitude: 41.9206, longitude: -87.6530, city: 'Chicago', state: 'IL' },
];

/**
 * Lookup zip code location (mock implementation)
 */
export async function lookupZipCode(zip: string): Promise<ZipCodeLocation | null> {
  const normalized = normalizeZipCode(zip);
  
  // In production, call geocoding API
  // const response = await fetch(`https://api.geocoding.service/zip/${normalized}`);
  
  // Mock lookup
  const found = MOCK_ZIP_DATABASE.find((z) => z.zip === normalized);
  return found || null;
}
