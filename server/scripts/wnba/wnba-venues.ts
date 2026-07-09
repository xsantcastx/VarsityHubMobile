/**
 * WNBA — static venue dictionary, keyed by ESPN's team display name (e.g.
 * "New York Liberty"). Used by sync-wnba-schedule.ts to attach
 * location/banner data the scoreboard API itself doesn't reliably provide.
 *
 * bannerUrl uses Wikimedia Commons' Special:FilePath redirect. Pro team
 * LOGOS are trademarked and never used here; arena exterior photos are
 * fine (same pattern as the FIFA venue dict). Atlanta Dream and
 * Connecticut Sun have no bannerUrl — no verified exterior photo exists on
 * Commons for either arena; the sync script falls back gracefully (banner
 * stays null, game/event still created).
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
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Wintrust-arena-exterior.jpg',
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
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/University of Texas at Arlington March 2021 008 (College Park Center).jpg',
  },
  'Golden State Valkyries': {
    name: 'Chase Center',
    address: '1 Warriors Way, San Francisco, CA 94158',
    lat: 37.768009,
    lng: -122.387787,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Chase Center - Warriors.jpg',
  },
  'Indiana Fever': {
    name: 'Gainbridge Fieldhouse',
    address: '125 S Pennsylvania St, Indianapolis, IN 46204',
    lat: 39.763924,
    lng: -86.155807,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Bankers Life Fieldhouse in May 2017.jpg',
  },
  'Las Vegas Aces': {
    name: 'Michelob ULTRA Arena',
    address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
    lat: 36.090622,
    lng: -115.179115,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Mandalay_Bay_Resort_and_Casino.jpg',
  },
  'Los Angeles Sparks': {
    name: 'Crypto.com Arena',
    address: '1111 S Figueroa St, Los Angeles, CA 90015',
    lat: 34.043087,
    lng: -118.267616,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Crypto.com Arena exterior 2023.jpg',
  },
  'Minnesota Lynx': {
    name: 'Target Center',
    address: '600 1st Ave N, Minneapolis, MN 55403',
    lat: 44.979595,
    lng: -93.276566,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Target Center exterior 02.jpg',
  },
  'New York Liberty': {
    name: 'Barclays Center',
    address: '620 Atlantic Ave, Brooklyn, NY 11217',
    lat: 40.682732,
    lng: -73.975876,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Barclays_Center_3.jpg',
  },
  'Phoenix Mercury': {
    name: 'Mortgage Matchup Center',
    address: '201 E Jefferson St, Phoenix, AZ 85004',
    lat: 33.445737,
    lng: -112.0712003,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Footprint Center 2022.jpg',
  },
  'Portland Fire': {
    name: 'Moda Center',
    address: '1 N Center Court St, Portland, OR 97227',
    lat: 45.531609,
    lng: -122.667236,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Moda Center.JPG',
  },
  'Seattle Storm': {
    name: 'Climate Pledge Arena',
    address: '334 1st Ave N, Seattle, WA 98109',
    lat: 47.6219,
    lng: -122.3539,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Climate Pledge Arena NE.jpg',
  },
  'Toronto Tempo': {
    name: 'Coca-Cola Coliseum',
    address: '45 Manitoba Dr, Toronto, ON M6K 3C3',
    lat: 43.6356773,
    lng: -79.4148464,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola Coliseum, Exhibition Place, Toronto, Ontario (29901775271).jpg',
  },
  'Washington Mystics': {
    name: 'CareFirst Arena',
    address: '1100 Oak Dr SE, Washington, DC 20032',
    lat: 38.8469016,
    lng: -76.9913962,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Entertainment and Sports Arena Exterior.jpg',
  },
};
