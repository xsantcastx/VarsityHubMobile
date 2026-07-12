/**
 * WNBA — static venue dictionary, keyed by ESPN's team display name (e.g.
 * "New York Liberty"). Used by sync-wnba-schedule.ts to attach
 * location/banner data the scoreboard API itself doesn't reliably provide.
 *
 * bannerUrl is ONLY ever sourced from a no-attribution-required license —
 * CC0/public domain, or a stock site whose license explicitly waives
 * attribution (Unsplash, Pexels). Never CC BY / CC BY-SA — this app has no
 * attribution UI, so those licenses aren't usable here. Pro team LOGOS are
 * trademarked and never used regardless.
 *
 * Coverage is intentionally partial: real, verified no-attribution photos
 * of these specific arenas are scarce (only 2 of 15 found). The rest have
 * no bannerUrl — a safe no-op (no banner shown), never a crash — rather
 * than reusing an attribution-required Commons file.
 */
export interface WnbaVenueDef {
  name: string;
  address: string;
  lat: number;
  lng: number;
  bannerUrl?: string;
}

export const WNBA_VENUES: Record<string, WnbaVenueDef> = {
  'Atlanta Dream': {
    name: 'Gateway Center Arena at College Park',
    address: '2330 Convention Center Concourse, College Park, GA 30337',
    lat: 33.6467,
    lng: -84.4597,
  },
  'Chicago Sky': {
    name: 'Wintrust Arena',
    address: '200 E Cermak Rd, Chicago, IL 60616',
    lat: 41.85366,
    lng: -87.62138,
  },
  'Connecticut Sun': {
    name: 'Mohegan Sun Arena',
    address: '1 Mohegan Sun Blvd, Uncasville, CT 06382',
    lat: 41.4911501,
    lng: -72.0897019,
  },
  'Dallas Wings': {
    name: 'College Park Center',
    address: '600 S Center St, Arlington, TX 76010',
    lat: 32.7306,
    lng: -97.108,
  },
  'Golden State Valkyries': {
    name: 'Chase Center',
    address: '1 Warriors Way, San Francisco, CA 94158',
    lat: 37.768009,
    lng: -122.387787,
    bannerUrl: 'https://images.unsplash.com/photo-xCZeZefnY-g?w=960&h=400&fit=crop&q=80',
  },
  'Indiana Fever': {
    name: 'Gainbridge Fieldhouse',
    address: '125 S Pennsylvania St, Indianapolis, IN 46204',
    lat: 39.763924,
    lng: -86.155807,
  },
  'Las Vegas Aces': {
    name: 'Michelob ULTRA Arena',
    address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
    lat: 36.090622,
    lng: -115.179115,
  },
  'Los Angeles Sparks': {
    name: 'Crypto.com Arena',
    address: '1111 S Figueroa St, Los Angeles, CA 90015',
    lat: 34.043087,
    lng: -118.267616,
  },
  'Minnesota Lynx': {
    name: 'Target Center',
    address: '600 1st Ave N, Minneapolis, MN 55403',
    lat: 44.979595,
    lng: -93.276566,
  },
  'New York Liberty': {
    name: 'Barclays Center',
    address: '620 Atlantic Ave, Brooklyn, NY 11217',
    lat: 40.682732,
    lng: -73.975876,
    bannerUrl: 'https://images.unsplash.com/photo-vQq-NTV-f4k?w=960&h=400&fit=crop&q=80',
  },
  'Phoenix Mercury': {
    name: 'Mortgage Matchup Center',
    address: '201 E Jefferson St, Phoenix, AZ 85004',
    lat: 33.445737,
    lng: -112.0712003,
  },
  'Portland Fire': {
    name: 'Moda Center',
    address: '1 N Center Court St, Portland, OR 97227',
    lat: 45.531609,
    lng: -122.667236,
  },
  'Seattle Storm': {
    name: 'Climate Pledge Arena',
    address: '334 1st Ave N, Seattle, WA 98109',
    lat: 47.6219,
    lng: -122.3539,
  },
  'Toronto Tempo': {
    name: 'Coca-Cola Coliseum',
    address: '45 Manitoba Dr, Toronto, ON M6K 3C3',
    lat: 43.6356773,
    lng: -79.4148464,
  },
  'Washington Mystics': {
    name: 'CareFirst Arena',
    address: '1100 Oak Dr SE, Washington, DC 20032',
    lat: 38.8469016,
    lng: -76.9913962,
  },
};
