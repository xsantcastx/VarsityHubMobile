/**
 * MLB — static venue dictionary, keyed by the MLB Stats API's team display
 * name (e.g. "New York Yankees"). Used by sync-mlb-schedule.ts to attach
 * location/banner data the schedule API itself doesn't reliably provide.
 *
 * bannerUrl uses Wikimedia Commons' Special:FilePath redirect — a stable
 * hotlink mechanism that doesn't require knowing the internal thumbnail
 * hash path. Pro team LOGOS are trademarked and never used here; stadium
 * exterior/aerial photos are fine (same pattern as the FIFA venue dict).
 */
export interface MlbVenueDef {
  name: string;
  address: string;
  lat: number;
  lng: number;
  bannerUrl?: string;
}

export const MLB_VENUES: Record<string, MlbVenueDef> = {
  'Tampa Bay Rays': {
    name: 'Tropicana Field',
    address: '1 Tropicana Dr, St. Petersburg, FL 33705',
    lat: 27.768284,
    lng: -82.653961,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tropicana_field_from_air.JPG',
  },
  'St. Louis Cardinals': {
    name: 'Busch Stadium',
    address: '700 Clark Ave, St. Louis, MO 63102',
    lat: 38.62278,
    lng: -90.193329,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Busch_Stadium_III_(16180972535).jpg',
  },
  'Miami Marlins': {
    name: 'loanDepot Park',
    address: '501 Marlins Way, Miami, FL 33125',
    lat: 25.778301,
    lng: -80.220352,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/LoanDepot_Park_2024.jpg',
  },
  'Philadelphia Phillies': {
    name: 'Citizens Bank Park',
    address: '1 Citizens Bank Way, Philadelphia, PA 19148',
    lat: 39.9035,
    lng: -75.1598,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Citizens_Bank_Park_-_Wide_View.jpg',
  },
  // Remaining 26 teams pending research — sync script will warn and skip
  // any game whose home team isn't listed here yet, never crash.
};
