/**
 * Geographic utilities for zip code distance calculations
 * and finding nearby available advertising slots.
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lon1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lon2 - Longitude of point 2
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get approximate coordinates for a US zip code
 * Uses the first 3 digits to map to a region's centroid
 * 
 * Note: This is a simplified approach using zip code prefixes.
 * For production use, consider using a full zip code database
 * like the USPS ZIP Code Database or a service like Geocodio.
 */
export function getZipCoordinates(zipCode: string): { lat: number; lon: number } | null {
  const zip3 = zipCode.substring(0, 3);
  const coords = ZIP_PREFIX_COORDS[zip3];
  
  if (!coords) return null;
  
  return { lat: coords[0], lon: coords[1] };
}

/**
 * Approximate coordinates for US zip code prefixes (first 3 digits)
 * Format: [latitude, longitude]
 * 
 * Source: Approximated from USPS sectional center facilities
 * Note: These are approximate centroids for each prefix range
 */
const ZIP_PREFIX_COORDS: Record<string, [number, number]> = {
  // Northeast
  '010': [42.2, -72.6],    // MA (Western)
  '011': [42.4, -71.4],    // MA (Boston Metro)
  '012': [42.3, -71.8],    // MA (Worcester)
  '013': [42.1, -72.6],    // MA (Springfield)
  '014': [42.5, -71.0],    // MA (North Shore)
  '015': [42.7, -71.2],    // MA (North)
  '016': [42.0, -71.4],    // MA (South)
  '017': [41.7, -71.3],    // MA (Cape Cod)
  '018': [42.5, -71.9],    // MA (North Central)
  '019': [42.4, -73.0],    // MA (Berkshires)
  
  '020': [41.8, -71.4],    // RI (Providence)
  '021': [41.9, -71.4],    // RI (Providence)
  '022': [41.8, -71.6],    // RI (West)
  '023': [41.5, -71.5],    // RI (South)
  '024': [41.9, -71.3],    // RI (East Providence)
  '025': [41.8, -71.4],    // RI (Central)
  '026': [41.7, -71.5],    // RI (Warwick)
  '027': [41.8, -71.4],    // RI (Providence)
  '028': [41.4, -71.4],    // RI (South County)
  '029': [41.6, -71.5],    // RI (South)
  
  '030': [43.2, -71.5],    // NH (Manchester)
  '031': [43.0, -71.5],    // NH (Manchester South)
  '032': [43.0, -71.5],    // NH (Nashua)
  '033': [43.0, -71.4],    // NH (Concord)
  '034': [43.7, -72.3],    // NH (Lebanon)
  '035': [43.7, -71.5],    // NH (Laconia)
  '036': [44.5, -71.2],    // NH (Berlin)
  '037': [44.0, -71.7],    // NH (North Conway)
  '038': [43.0, -71.0],    // NH (Portsmouth)
  
  '040': [44.5, -73.2],    // VT (Burlington)
  '041': [44.3, -72.5],    // VT (Montpelier)
  '042': [43.2, -72.7],    // VT (Brattleboro)
  '043': [44.0, -73.2],    // VT (Middlebury)
  '044': [44.5, -73.2],    // VT (Burlington Area)
  '045': [44.5, -72.0],    // VT (Northeast Kingdom)
  '046': [43.2, -72.5],    // VT (Windsor)
  '047': [44.0, -72.6],    // VT (Barre)
  '048': [43.5, -73.0],    // VT (Rutland)
  '049': [44.7, -72.5],    // VT (St. Johnsbury)
  
  '050': [40.7, -74.0],    // NY (Manhattan)
  '051': [40.7, -73.9],    // NY (Manhattan)
  '052': [40.8, -73.9],    // NY (Bronx)
  '053': [40.6, -74.0],    // NY (Staten Island)
  '054': [40.6, -73.9],    // NY (Brooklyn)
  '055': [40.7, -73.8],    // NY (Queens)
  
  '100': [40.7, -74.0],    // NY (Manhattan)
  '101': [40.7, -74.0],    // NY (Manhattan)
  '102': [40.7, -74.0],    // NY (Manhattan)
  '103': [40.8, -73.9],    // NY (Bronx)
  '104': [40.8, -73.9],    // NY (Bronx)
  '105': [40.6, -73.8],    // NY (Brooklyn)
  '106': [40.6, -73.9],    // NY (Brooklyn)
  '107': [40.7, -73.8],    // NY (Queens)
  '108': [40.7, -73.8],    // NY (Queens)
  '109': [40.6, -74.1],    // NY (Staten Island)
  
  '110': [40.9, -73.8],    // NY (Queens)
  '111': [40.7, -73.7],    // NY (Queens)
  '112': [40.6, -73.7],    // NY (Brooklyn)
  '113': [40.7, -73.6],    // NY (Queens)
  '114': [40.7, -73.7],    // NY (Queens)
  '115': [40.6, -73.6],    // NY (Queens)
  '116': [40.6, -73.8],    // NY (Queens)
  
  '117': [41.0, -73.7],    // NY (Westchester)
  '118': [41.0, -73.8],    // NY (Westchester)
  '119': [41.0, -73.6],    // NY (Westchester)
  '120': [42.8, -73.9],    // NY (Albany)
  '121': [42.7, -73.8],    // NY (Albany)
  '122': [42.9, -73.8],    // NY (Albany)
  '123': [43.0, -73.5],    // NY (Schenectady)
  '124': [43.3, -74.5],    // NY (Gloversville)
  '125': [43.1, -75.2],    // NY (Utica)
  '126': [43.5, -75.5],    // NY (Watertown)
  '127': [44.7, -74.7],    // NY (Plattsburgh)
  '128': [43.1, -77.6],    // NY (Rochester)
  '129': [44.5, -73.5],    // NY (Plattsburgh)
  
  '130': [43.0, -76.1],    // NY (Syracuse)
  '131': [43.0, -76.2],    // NY (Syracuse)
  '132': [43.2, -76.0],    // NY (Syracuse)
  '133': [43.0, -76.0],    // NY (Syracuse)
  '134': [43.4, -76.5],    // NY (Oswego)
  '135': [42.1, -75.9],    // NY (Binghamton)
  '136': [42.4, -76.5],    // NY (Ithaca)
  '137': [42.3, -77.3],    // NY (Corning)
  '138': [42.5, -77.5],    // NY (Bath)
  '139': [42.1, -77.0],    // NY (Elmira)
  
  '140': [42.9, -78.8],    // NY (Buffalo)
  '141': [42.9, -78.9],    // NY (Buffalo)
  '142': [43.1, -79.0],    // NY (Buffalo North)
  '143': [42.3, -79.2],    // NY (Niagara Falls)
  '144': [42.9, -78.6],    // NY (Buffalo East)
  '145': [42.5, -78.7],    // NY (Buffalo South)
  '146': [42.1, -79.2],    // NY (Jamestown)
  '147': [42.0, -79.5],    // NY (Jamestown South)
  '148': [42.3, -78.0],    // NY (Bradford)
  '149': [42.7, -78.2],    // NY (Springville)
  
  '150': [40.0, -75.1],    // PA (Philadelphia)
  '151': [39.9, -75.2],    // PA (Philadelphia)
  '152': [40.1, -75.1],    // PA (Philadelphia)
  '153': [40.0, -75.3],    // PA (West Chester)
  '154': [40.3, -75.1],    // PA (Norristown)
  
  '170': [40.4, -79.9],    // PA (Pittsburgh)
  '171': [40.5, -80.0],    // PA (Pittsburgh)
  '172': [40.3, -79.8],    // PA (Pittsburgh)
  '173': [40.0, -80.1],    // PA (Wheeling)
  
  '180': [41.2, -77.0],    // PA (Williamsport)
  '181': [40.5, -78.4],    // PA (Altoona)
  '190': [40.3, -76.9],    // PA (Harrisburg)
  '191': [40.2, -76.8],    // PA (Harrisburg)
  '192': [40.0, -76.3],    // PA (Lancaster)
  '193': [40.6, -75.6],    // PA (Lehigh Valley)
  '194': [41.4, -75.7],    // PA (Scranton)
  '195': [40.6, -75.5],    // PA (Allentown)
  '196': [40.3, -76.4],    // PA (Reading)
  
  '200': [38.9, -77.0],    // DC (Washington)
  '201': [38.9, -77.0],    // DC (Washington)
  '202': [38.9, -77.0],    // DC (Washington)
  '203': [38.9, -77.0],    // DC (Washington)
  '204': [38.9, -77.0],    // DC (Washington)
  '205': [38.9, -77.0],    // DC (Washington)
  
  '206': [38.9, -76.9],    // MD (Prince George's)
  '207': [39.0, -77.1],    // MD (Montgomery)
  '208': [39.1, -77.2],    // MD (Montgomery North)
  '209': [38.8, -76.9],    // MD (Prince George's)
  
  '210': [39.3, -76.6],    // MD (Baltimore)
  '211': [39.3, -76.6],    // MD (Baltimore)
  '212': [39.4, -76.7],    // MD (Baltimore County)
  '213': [39.5, -76.4],    // MD (Baltimore East)
  '214': [39.4, -76.8],    // MD (Baltimore)
  '215': [39.2, -76.5],    // MD (Baltimore)
  '216': [39.5, -77.7],    // MD (Hagerstown)
  '217': [39.6, -78.8],    // MD (Cumberland)
  '218': [39.4, -76.1],    // MD (Salisbury)
  '219': [38.3, -75.1],    // MD (Ocean City)
  
  '220': [37.5, -77.4],    // VA (Richmond)
  '221': [37.4, -77.5],    // VA (Richmond)
  '222': [37.5, -77.5],    // VA (Richmond)
  '223': [37.3, -77.4],    // VA (Petersburg)
  '224': [37.8, -79.4],    // VA (Roanoke)
  '225': [37.3, -79.9],    // VA (Roanoke South)
  '226': [37.1, -80.6],    // VA (Bluefield)
  '227': [37.8, -80.4],    // VA (Covington)
  '228': [38.0, -78.5],    // VA (Charlottesville)
  '229': [38.2, -78.2],    // VA (Charlottesville)
  
  '230': [38.0, -78.5],    // VA (Charlottesville)
  '231': [38.9, -77.5],    // VA (Manassas)
  '232': [37.8, -77.9],    // VA (Fredericksburg)
  '233': [36.8, -76.3],    // VA (Norfolk)
  '234': [37.0, -76.4],    // VA (Norfolk)
  '235': [37.2, -76.5],    // VA (Hampton)
  '236': [37.0, -76.3],    // VA (Newport News)
  '237': [36.8, -76.1],    // VA (Portsmouth)
  '238': [36.7, -76.0],    // VA (Virginia Beach)
  '239': [36.9, -76.2],    // VA (Norfolk)
  
  '240': [38.4, -82.4],    // WV (Huntington)
  '241': [38.3, -81.6],    // WV (Charleston)
  '242': [38.5, -82.6],    // WV (Huntington)
  '243': [39.4, -79.9],    // WV (Clarksburg)
  '244': [39.3, -77.9],    // WV (Martinsburg)
  '245': [38.2, -81.8],    // WV (Charleston)
  '246': [37.8, -81.2],    // WV (Bluefield)
  '247': [39.6, -79.9],    // WV (Morgantown)
  '248': [39.3, -80.3],    // WV (Fairmont)
  '249': [39.5, -79.7],    // WV (Morgantown)
  
  '250': [38.0, -78.5],    // VA (Charlottesville)
  '251': [38.2, -79.2],    // VA (Staunton)
  '252': [37.8, -79.4],    // VA (Roanoke)
  '253': [38.4, -78.9],    // VA (Harrisonburg)
  '254': [38.1, -79.1],    // VA (Staunton)
  '255': [37.3, -79.2],    // VA (Lynchburg)
  '256': [37.8, -80.0],    // VA (Radford)
  '257': [36.6, -82.2],    // VA (Bristol)
  '258': [37.3, -80.6],    // VA (Blacksburg)
  '259': [37.1, -79.4],    // VA (Martinsville)
  
  '260': [36.6, -78.4],    // NC (Durham)
  '261': [36.1, -80.2],    // NC (Winston-Salem)
  '262': [36.0, -79.8],    // NC (Greensboro)
  '263': [36.1, -79.4],    // NC (Burlington)
  '264': [35.2, -77.9],    // NC (Rocky Mount)
  '265': [36.1, -79.9],    // NC (Greensboro)
  '266': [36.5, -80.8],    // NC (North Wilkesboro)
  '267': [35.9, -81.5],    // NC (Hickory)
  '268': [36.5, -81.2],    // NC (Boone)
  '269': [36.1, -81.7],    // NC (Lenoir)
  
  '270': [36.1, -79.8],    // NC (Greensboro)
  '271': [36.1, -80.2],    // NC (Winston-Salem)
  '272': [36.1, -79.4],    // NC (Greensboro)
  '273': [35.2, -77.9],    // NC (Greenville)
  '274': [35.9, -79.0],    // NC (Chapel Hill)
  '275': [36.0, -79.8],    // NC (Greensboro)
  '276': [35.6, -82.6],    // NC (Asheville)
  '277': [35.9, -79.0],    // NC (Durham)
  '278': [35.8, -78.6],    // NC (Raleigh)
  '279': [35.2, -80.8],    // NC (Charlotte)
  
  '280': [35.2, -80.8],    // NC (Charlotte)
  '281': [35.0, -80.9],    // NC (Charlotte)
  '282': [35.3, -80.7],    // NC (Charlotte)
  '283': [34.2, -79.7],    // SC (Florence)
  '284': [34.0, -81.0],    // SC (Columbia)
  '285': [35.7, -81.3],    // NC (Gastonia)
  '286': [35.5, -82.5],    // NC (Asheville)
  '287': [35.6, -82.3],    // NC (Asheville)
  '288': [35.5, -82.9],    // NC (Asheville West)
  '289': [35.3, -82.5],    // NC (Hendersonville)
  
  '290': [33.9, -81.0],    // SC (Columbia)
  '291': [34.0, -81.0],    // SC (Columbia)
  '292': [34.8, -82.4],    // SC (Greenville)
  '293': [34.8, -82.6],    // SC (Spartanburg)
  '294': [34.0, -80.9],    // SC (Columbia)
  '295': [34.0, -79.8],    // SC (Florence)
  '296': [34.9, -81.9],    // SC (Greenville)
  '297': [35.1, -81.5],    // SC (Rock Hill)
  '298': [32.8, -79.9],    // SC (Charleston)
  '299': [32.5, -80.8],    // SC (Beaufort)
  
  '300': [33.7, -84.4],    // GA (Atlanta)
  '301': [33.8, -84.4],    // GA (Atlanta)
  '302': [33.7, -84.3],    // GA (Atlanta)
  '303': [33.9, -84.5],    // GA (Atlanta)
  '304': [33.6, -84.4],    // GA (Atlanta)
  '305': [33.8, -84.2],    // GA (Atlanta)
  '306': [33.9, -83.4],    // GA (Athens)
  '307': [34.3, -83.8],    // GA (Gainesville)
  '308': [34.0, -84.6],    // GA (Marietta)
  '309': [33.6, -84.2],    // GA (Atlanta)
  
  '310': [32.1, -81.1],    // GA (Savannah)
  '311': [33.5, -82.0],    // GA (Augusta)
  '312': [32.5, -82.9],    // GA (Macon)
  '313': [31.6, -84.2],    // GA (Albany)
  '314': [32.8, -83.6],    // GA (Macon)
  '315': [31.2, -81.5],    // GA (Waycross)
  '316': [32.4, -81.8],    // GA (Vidalia)
  '317': [33.6, -85.1],    // GA (Rome)
  '318': [31.1, -81.4],    // GA (Brunswick)
  '319': [30.8, -83.3],    // GA (Valdosta)
  
  '320': [30.3, -81.7],    // FL (Jacksonville)
  '321': [30.4, -81.6],    // FL (Jacksonville)
  '322': [30.3, -81.4],    // FL (Jacksonville Beach)
  '323': [29.6, -82.3],    // FL (Gainesville)
  '324': [29.7, -81.2],    // FL (Daytona Beach)
  '325': [28.5, -81.4],    // FL (Orlando)
  '326': [29.2, -81.0],    // FL (Daytona Beach)
  '327': [28.5, -81.4],    // FL (Orlando)
  '328': [28.5, -81.4],    // FL (Orlando)
  '329': [28.5, -81.6],    // FL (Orlando West)
  
  '330': [26.1, -80.1],    // FL (Miami)
  '331': [26.0, -80.1],    // FL (Miami)
  '332': [25.8, -80.2],    // FL (Miami)
  '333': [26.7, -80.1],    // FL (Boca Raton)
  '334': [26.9, -80.1],    // FL (West Palm Beach)
  '335': [27.0, -80.2],    // FL (West Palm Beach)
  '336': [26.1, -80.3],    // FL (Fort Lauderdale)
  '337': [25.8, -80.3],    // FL (Miami West)
  '338': [28.0, -80.6],    // FL (Melbourne)
  '339': [27.8, -80.4],    // FL (Vero Beach)
  
  '340': [27.9, -82.5],    // FL (Tampa)
  '341': [28.0, -82.4],    // FL (Tampa)
  '342': [27.3, -82.5],    // FL (Sarasota)
  '343': [27.5, -82.6],    // FL (Bradenton)
  '344': [26.6, -81.9],    // FL (Fort Myers)
  '345': [28.5, -81.9],    // FL (Lakeland)
  '346': [28.1, -82.7],    // FL (Tampa Bay)
  '347': [27.8, -82.8],    // FL (St. Petersburg)
  '348': [28.0, -81.7],    // FL (Lakeland)
  '349': [26.1, -81.7],    // FL (Naples)
  
  // Midwest
  '350': [33.4, -86.8],    // AL (Birmingham)
  '360': [32.4, -86.3],    // AL (Montgomery)
  '370': [30.7, -88.0],    // AL (Mobile)
  
  '380': [38.3, -85.8],    // KY (Louisville)
  '390': [38.0, -84.5],    // KY (Lexington)
  '400': [38.3, -85.8],    // KY (Louisville)
  '410': [36.2, -86.8],    // TN (Nashville)
  '420': [36.2, -82.3],    // TN (Bristol)
  '430': [39.1, -84.5],    // OH (Cincinnati)
  '440': [41.5, -81.7],    // OH (Cleveland)
  '450': [39.9, -83.0],    // OH (Columbus)
  '460': [41.1, -80.6],    // OH (Youngstown)
  '470': [39.8, -84.2],    // OH (Dayton)
  '480': [41.7, -83.5],    // OH (Toledo)
  '490': [39.3, -82.1],    // OH (Athens)
  
  '500': [41.6, -93.6],    // IA (Des Moines)
  '510': [42.5, -96.4],    // IA (Sioux City)
  '520': [42.0, -91.7],    // IA (Cedar Rapids)
  '530': [41.3, -95.9],    // IA (Council Bluffs)
  '540': [42.5, -94.2],    // IA (Fort Dodge)
  
  '550': [44.9, -93.3],    // MN (Minneapolis)
  '560': [46.8, -92.1],    // MN (Duluth)
  '570': [43.7, -94.5],    // MN (Mankato)
  
  '580': [46.9, -96.8],    // ND (Fargo)
  '590': [47.9, -97.1],    // ND (Grand Forks)
  
  '600': [41.8, -87.6],    // IL (Chicago)
  '610': [42.3, -89.1],    // IL (Rockford)
  '620': [40.1, -88.2],    // IL (Champaign)
  '630': [38.6, -90.2],    // IL (East St. Louis)
  
  '640': [38.6, -90.2],    // MO (St. Louis)
  '650': [39.1, -94.6],    // MO (Kansas City)
  '660': [37.2, -93.3],    // MO (Springfield)
  '670': [38.6, -92.2],    // MO (Columbia)
  
  '680': [41.3, -95.9],    // NE (Omaha)
  '690': [40.8, -96.7],    // NE (Lincoln)
  
  '700': [39.7, -104.9],   // CO (Denver)
  '710': [38.8, -104.8],   // CO (Colorado Springs)
  '720': [39.0, -108.6],   // CO (Grand Junction)
  '730': [42.9, -106.3],   // WY (Casper)
  '740': [40.8, -111.9],   // UT (Salt Lake City)
  
  '750': [32.8, -96.8],    // TX (Dallas)
  '760': [29.4, -98.5],    // TX (San Antonio)
  '770': [29.8, -95.4],    // TX (Houston)
  '780': [30.3, -97.7],    // TX (Austin)
  '790': [31.8, -106.4],   // TX (El Paso)
  
  '800': [33.4, -112.1],   // AZ (Phoenix)
  '810': [46.6, -112.0],   // MT (Helena)
  '820': [43.6, -116.2],   // ID (Boise)
  '830': [41.1, -104.8],   // WY (Cheyenne)
  '840': [40.8, -111.9],   // UT (Salt Lake City)
  '850': [33.4, -112.1],   // AZ (Phoenix)
  '860': [32.2, -110.9],   // AZ (Tucson)
  '870': [35.1, -106.6],   // NM (Albuquerque)
  '880': [36.1, -115.2],   // NV (Las Vegas)
  '890': [39.5, -119.8],   // NV (Reno)
  
  '900': [34.0, -118.2],   // CA (Los Angeles)
  '910': [32.7, -117.2],   // CA (San Diego)
  '920': [37.8, -122.4],   // CA (San Francisco)
  '930': [38.6, -121.5],   // CA (Sacramento)
  '940': [37.7, -121.9],   // CA (San Jose)
  '950': [36.7, -119.8],   // CA (Fresno)
  '960': [34.1, -117.3],   // CA (San Bernardino)
  
  '970': [45.5, -122.7],   // OR (Portland)
  '980': [47.6, -122.3],   // WA (Seattle)
  '990': [61.2, -149.9],   // AK (Anchorage)
};
