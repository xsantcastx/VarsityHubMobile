/**
 * MLB — static venue dictionary, keyed by the MLB Stats API's team display
 * name (e.g. "New York Yankees"). Used by sync-mlb-schedule.ts to attach
 * location/banner data the schedule API itself doesn't reliably provide.
 *
 * bannerUrl uses Wikimedia Commons' Special:FilePath redirect — a stable
 * hotlink mechanism that doesn't require knowing the internal thumbnail
 * hash path. Pro team LOGOS are trademarked and never used here; stadium
 * exterior/aerial photos are fine (same pattern as the FIFA venue dict).
 *
 * A few filenames are UNCERTAIN — verified only via search-result snippets
 * (Wikimedia is unreachable from this environment), not by opening the
 * Commons file page directly. If a banner ever 404s in the app, the fix is
 * a one-line swap of that team's bannerUrl to a re-verified filename.
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
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Chase_Field_aerial.jpg',
  },
  'Atlanta Braves': {
    name: 'Truist Park',
    address: '755 Battery Ave SE, Atlanta, GA 30339',
    lat: 33.8908,
    lng: -84.4678,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Truist_Park_2025.jpg',
  },
  'Baltimore Orioles': {
    name: 'Oriole Park at Camden Yards',
    address: '333 W Camden St, Baltimore, MD 21201',
    lat: 39.2837,
    lng: -76.6197,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/OrioleParkAtCamdenYardsJune2013.jpg',
  },
  'Boston Red Sox': {
    name: 'Fenway Park',
    address: '4 Jersey St, Boston, MA 02215',
    lat: 42.3467,
    lng: -71.0972,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Fenway_Park.jpg',
  },
  'Chicago Cubs': {
    name: 'Wrigley Field',
    address: '1060 W Addison St, Chicago, IL 60613',
    lat: 41.9484,
    lng: -87.6553,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Wrigley_Field_2018_-_42195054760.jpg',
  },
  'Chicago White Sox': {
    name: 'Rate Field',
    address: '333 W 35th St, Chicago, IL 60616',
    lat: 41.830017,
    lng: -87.634598,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/US_Cellular_Field.jpg',
  },
  'Cincinnati Reds': {
    name: 'Great American Ball Park',
    address: '100 Joe Nuxhall Way, Cincinnati, OH 45202',
    lat: 39.091833,
    lng: -84.504,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Great_American_Ballpark_2007.jpg',
  },
  'Cleveland Guardians': {
    name: 'Progressive Field',
    address: '2401 Ontario Street, Cleveland, OH 44115',
    lat: 41.496211,
    lng: -81.685785,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Progressive_Field_aerial_2015.jpg',
  },
  'Colorado Rockies': {
    name: 'Coors Field',
    address: '2001 Blake St, Denver, CO 80205',
    lat: 39.756229,
    lng: -104.994865,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coors_field_aerial_1.JPG',
  },
  'Detroit Tigers': {
    name: 'Comerica Park',
    address: '2100 Woodward Ave, Detroit, MI 48201',
    lat: 42.338356,
    lng: -83.048134,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Comerica_Park.jpg',
  },
  'Houston Astros': {
    name: 'Daikin Park',
    address: '501 Crawford Street, Houston, TX 77002',
    lat: 29.7571,
    lng: -95.3555,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Minute_Maid_Park_2010.JPG',
  },
  'Kansas City Royals': {
    name: 'Kauffman Stadium',
    address: '1 Royal Way, Kansas City, MO 64129',
    lat: 39.0519,
    lng: -94.4807,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/NewKauffman.jpg',
  },
  'Los Angeles Angels': {
    name: 'Angel Stadium',
    address: '2000 E Gene Autry Way, Anaheim, CA 92806',
    lat: 33.8006,
    lng: -117.8828,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Angel_Stadium_of_Anaheim.jpg',
  },
  'Los Angeles Dodgers': {
    name: 'Dodger Stadium',
    address: '1000 Vin Scully Avenue, Los Angeles, CA 90012',
    lat: 34.0739,
    lng: -118.24,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Aerial_view_of_Dodger_Stadium,_April_2024.JPG',
  },
  'Milwaukee Brewers': {
    name: 'American Family Field',
    address: '1 Brewers Way, Milwaukee, WI 53214',
    lat: 43.028,
    lng: -87.9711,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/American_Family_Field_seen_from_I-94.jpg',
  },
  'Minnesota Twins': {
    name: 'Target Field',
    address: '1 Twins Way, Minneapolis, MN 55403',
    lat: 44.9817,
    lng: -93.2777,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Target_Field_Aerial.jpg',
  },
  'New York Mets': {
    name: 'Citi Field',
    address: '41 Seaver Way, Flushing, NY 11368',
    lat: 40.7571,
    lng: -73.8458,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Citi_Field_facade.jpg',
  },
  'New York Yankees': {
    name: 'Yankee Stadium',
    address: '1 East 161st Street, Bronx, NY 10451',
    lat: 40.8296,
    lng: -73.9262,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/New_Yankee_Stadium.JPG',
  },
  Athletics: {
    name: 'Sutter Health Park',
    address: '400 Ballpark Drive, West Sacramento, CA 95691',
    lat: 38.5805,
    lng: -121.5135,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Aerial_view_of_Sutter_Health_Park_in_2024.jpg',
  },
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
  'Pittsburgh Pirates': {
    name: 'PNC Park',
    address: '115 Federal Street, Pittsburgh, PA 15212',
    lat: 40.4415,
    lng: -80.0035,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/PNC_Park_Pittsburgh_front_entrance_gate.jpg',
  },
  'San Diego Padres': {
    name: 'Petco Park',
    address: '100 Park Blvd, San Diego, CA 92101',
    lat: 32.7076,
    lng: -117.1575,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Petco_Park_from_above.jpg',
  },
  'San Francisco Giants': {
    name: 'Oracle Park',
    address: '24 Willie Mays Plaza, San Francisco, CA 94107',
    lat: 37.7786,
    lng: -122.3897,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/ATT_Sunset_Panorama.jpg',
  },
  'Seattle Mariners': {
    name: 'T-Mobile Park',
    address: '1250 1st Avenue South, Seattle, WA 98134',
    lat: 47.5914,
    lng: -122.3325,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Safeco_Field,_Seattle-.jpg',
  },
  'Texas Rangers': {
    name: 'Globe Life Field',
    address: '734 Stadium Drive, Arlington, TX 76011',
    lat: 32.7469,
    lng: -97.0875,
    bannerUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/GlobeLifeField2021.jpg',
  },
  'Toronto Blue Jays': {
    name: 'Rogers Centre',
    address: '1 Blue Jays Way, Toronto, ON M5V 1J1',
    lat: 43.6414,
    lng: -79.3892,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Rogers_Centre,_Toronto,_Ontario_(21217570604).jpg',
  },
  'Washington Nationals': {
    name: 'Nationals Park',
    address: '1500 South Capitol Street SE, Washington, DC 20003',
    lat: 38.8703,
    lng: -77.0045,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Aerial_view_of_Nationals_Park.jpg',
  },
};
