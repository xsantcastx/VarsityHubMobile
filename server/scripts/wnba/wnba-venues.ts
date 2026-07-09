/**
 * WNBA — static venue dictionary, keyed by ESPN's team display name (e.g.
 * "New York Liberty"). Used by sync-wnba-schedule.ts to attach
 * location/banner data the scoreboard API itself doesn't reliably provide.
 *
 * bannerUrl uses Wikimedia Commons' Special:FilePath redirect. Pro team
 * LOGOS are trademarked and never used here; arena exterior photos are
 * fine (same pattern as the FIFA venue dict).
 */
export interface WnbaVenueDef {
  name: string;
  address: string;
  lat: number;
  lng: number;
  bannerUrl?: string;
}

export const WNBA_VENUES: Record<string, WnbaVenueDef> = {
  'New York Liberty': {
    name: 'Barclays Center',
    address: '620 Atlantic Ave, Brooklyn, NY 11217',
    lat: 40.682732,
    lng: -73.975876,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Barclays_Center_3.jpg',
  },
  'Las Vegas Aces': {
    name: 'Michelob ULTRA Arena',
    address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
    lat: 36.090622,
    lng: -115.179115,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Mandalay_Bay_Resort_and_Casino.jpg',
  },
  // Remaining 13 teams (2026 field of 15) pending research — sync script
  // will warn and skip any game whose home team isn't listed here yet,
  // never crash.
};
