/**
 * MLB — static venue dictionary, keyed by the MLB Stats API's team display
 * name (e.g. "New York Yankees"). Used by sync-mlb-schedule.ts to attach
 * location/banner data the schedule API itself doesn't reliably provide.
 *
 * bannerUrl is ONLY ever sourced from a no-attribution-required license —
 * CC0/public domain (Wikimedia Commons Special:FilePath, or Library of
 * Congress Highsmith collection mirrors on Commons), or a stock site whose
 * license explicitly waives attribution (Unsplash, Pexels). Never CC BY /
 * CC BY-SA — this app has no attribution UI, so those licenses aren't
 * usable here. Pro team LOGOS are trademarked and never used regardless.
 *
 * Coverage is intentionally partial: where no verified no-attribution photo
 * of that specific stadium could be found, bannerUrl is omitted rather than
 * guessing or reusing an attribution-required file. A missing bannerUrl is
 * a safe no-op (no banner shown) — never a crash.
 */
export interface MlbVenueDef {
  name: string;
  address: string;
  lat: number;
  lng: number;
  bannerUrl?: string;
}

export const MLB_VENUES: Record<string, MlbVenueDef> = {
  'Arizona Diamondbacks': {
    name: 'Chase Field',
    address: '401 E Jefferson St, Phoenix, AZ 85004',
    lat: 33.4456,
    lng: -112.0667,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Atlanta Braves': {
    name: 'Truist Park',
    address: '755 Battery Ave SE, Atlanta, GA 30339',
    lat: 33.8908,
    lng: -84.4678,
    // No verified no-attribution photo found — omit.
  },
  'Baltimore Orioles': {
    name: 'Oriole Park at Camden Yards',
    address: '333 W Camden St, Baltimore, MD 21201',
    lat: 39.2837,
    lng: -76.6197,
    // Real public-domain Highsmith photo exists at loc.gov (LC-DIG-highsm-04854)
    // but no confirmed Wikimedia Commons mirror filename — omit until one is
    // found or the image is downloaded and self-hosted via Cloudinary.
  },
  'Boston Red Sox': {
    name: 'Fenway Park',
    address: '4 Jersey St, Boston, MA 02215',
    lat: 42.3467,
    lng: -71.0972,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Chicago Cubs': {
    name: 'Wrigley Field',
    address: '1060 W Addison St, Chicago, IL 60613',
    lat: 41.9484,
    lng: -87.6553,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Chicago White Sox': {
    name: 'Rate Field',
    address: '333 W 35th St, Chicago, IL 60616',
    lat: 41.830017,
    lng: -87.634598,
    bannerUrl:
      'https://images.pexels.com/photos/32536303/pexels-photo-32536303.jpeg?w=960&h=400&fit=crop',
  },
  'Cincinnati Reds': {
    name: 'Great American Ball Park',
    address: '100 Joe Nuxhall Way, Cincinnati, OH 45202',
    lat: 39.091833,
    lng: -84.504,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Cleveland Guardians': {
    name: 'Progressive Field',
    address: '2401 Ontario Street, Cleveland, OH 44115',
    lat: 41.496211,
    lng: -81.685785,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Colorado Rockies': {
    name: 'Coors Field',
    address: '2001 Blake St, Denver, CO 80205',
    lat: 39.756229,
    lng: -104.994865,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Detroit Tigers': {
    name: 'Comerica Park',
    address: '2100 Woodward Ave, Detroit, MI 48201',
    lat: 42.338356,
    lng: -83.048134,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Houston Astros': {
    name: 'Daikin Park',
    address: '501 Crawford Street, Houston, TX 77002',
    lat: 29.7571,
    lng: -95.3555,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Kansas City Royals': {
    name: 'Kauffman Stadium',
    address: '1 Royal Way, Kansas City, MO 64129',
    lat: 39.0519,
    lng: -94.4807,
    // No verified no-attribution photo found — omit.
  },
  'Los Angeles Angels': {
    name: 'Angel Stadium',
    address: '2000 E Gene Autry Way, Anaheim, CA 92806',
    lat: 33.8006,
    lng: -117.8828,
    // Library of Congress Highsmith collection, public domain ("no known
    // restrictions on publication"), mirrored to Commons under this LCCN.
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Angel_Stadium_of_Anaheim,_California_LCCN2013632778.tif',
  },
  'Los Angeles Dodgers': {
    name: 'Dodger Stadium',
    address: '1000 Vin Scully Avenue, Los Angeles, CA 90012',
    lat: 34.0739,
    lng: -118.24,
    // Library of Congress Highsmith collection, public domain, Commons mirror.
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Dodger_Stadium,_also_sometimes_called_Chavez_Ravine,_is_a_stadium_in_Los_Angeles,_California_LCCN2013632695.jpg',
  },
  'Milwaukee Brewers': {
    name: 'American Family Field',
    address: '1 Brewers Way, Milwaukee, WI 53214',
    lat: 43.028,
    lng: -87.9711,
    // No verified no-attribution photo found — omit.
  },
  'Minnesota Twins': {
    name: 'Target Field',
    address: '1 Twins Way, Minneapolis, MN 55403',
    lat: 44.9817,
    lng: -93.2777,
    // No verified no-attribution photo found — omit.
  },
  'New York Mets': {
    name: 'Citi Field',
    address: '41 Seaver Way, Flushing, NY 11368',
    lat: 40.7571,
    lng: -73.8458,
    // No verified no-attribution photo found — omit.
  },
  'New York Yankees': {
    name: 'Yankee Stadium',
    address: '1 East 161st Street, Bronx, NY 10451',
    lat: 40.8296,
    lng: -73.9262,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  Athletics: {
    name: 'Sutter Health Park',
    address: '400 Ballpark Drive, West Sacramento, CA 95691',
    lat: 38.5805,
    lng: -121.5135,
    // No verified no-attribution photo found — omit.
  },
  'Tampa Bay Rays': {
    name: 'Tropicana Field',
    address: '1 Tropicana Dr, St. Petersburg, FL 33705',
    lat: 27.768284,
    lng: -82.653961,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'St. Louis Cardinals': {
    name: 'Busch Stadium',
    address: '700 Clark Ave, St. Louis, MO 63102',
    lat: 38.62278,
    lng: -90.193329,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Miami Marlins': {
    name: 'loanDepot Park',
    address: '501 Marlins Way, Miami, FL 33125',
    lat: 25.778301,
    lng: -80.220352,
    // No verified no-attribution photo found — omit.
  },
  'Philadelphia Phillies': {
    name: 'Citizens Bank Park',
    address: '1 Citizens Bank Way, Philadelphia, PA 19148',
    lat: 39.9035,
    lng: -75.1598,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Pittsburgh Pirates': {
    name: 'PNC Park',
    address: '115 Federal Street, Pittsburgh, PA 15212',
    lat: 40.4415,
    lng: -80.0035,
    // Real public-domain Highsmith photo exists at loc.gov (LC-DIG-highsm-58460)
    // but no confirmed Wikimedia Commons mirror filename — omit until one is
    // found or the image is downloaded and self-hosted via Cloudinary.
  },
  'San Diego Padres': {
    name: 'Petco Park',
    address: '100 Park Blvd, San Diego, CA 92101',
    lat: 32.7076,
    lng: -117.1575,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'San Francisco Giants': {
    name: 'Oracle Park',
    address: '24 Willie Mays Plaza, San Francisco, CA 94107',
    lat: 37.7786,
    lng: -122.3897,
    // No verified no-attribution photo found — omit.
  },
  'Seattle Mariners': {
    name: 'T-Mobile Park',
    address: '1250 1st Avenue South, Seattle, WA 98134',
    lat: 47.5914,
    lng: -122.3325,
    // bannerUrl omitted 2026-07-28 — prior Unsplash id was invalid (HTTP 404). Blank is a safe no-op (client shows a gradient); no verified no-attribution photo yet.
  },
  'Texas Rangers': {
    name: 'Globe Life Field',
    address: '734 Stadium Drive, Arlington, TX 76011',
    lat: 32.7469,
    lng: -97.0875,
    // No verified no-attribution photo found (the one lead found was
    // actually the old Globe Life Park, a different stadium — rejected).
  },
  'Toronto Blue Jays': {
    name: 'Rogers Centre',
    address: '1 Blue Jays Way, Toronto, ON M5V 1J1',
    lat: 43.6414,
    lng: -79.3892,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Toronto_Blue_Jays_Banners_%26_Scoreboard_Rogers_Centre_2022.jpg',
  },
  'Washington Nationals': {
    name: 'Nationals Park',
    address: '1500 South Capitol Street SE, Washington, DC 20003',
    lat: 38.8703,
    lng: -77.0045,
    // Already a Library of Congress Highsmith public-domain photo — no change needed.
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Aerial_view_of_Nationals_Park.jpg',
  },
};
