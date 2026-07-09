/**
 * FIFA World Cup 2026 — template data. GENERATED from the fixture feed
 * (fixturedownload.com/feed/json/fifa-world-cup-2026) — full group stage.
 *
 * Knockout-round fixtures are added as their teams become known (group stage
 * concluded June 27). Included so far: full Round of 16 (matches 89–96) and
 * all 4 quarterfinals (97–100). Still TBD: semifinals, bronze final, and the
 * final — add them here once their teams are decided, then run:
 *
 *   npx tsx scripts/fifa/create-fifa-events.ts --dry-run
 *
 * The engine is idempotent — existing org/teams/games are detected and only
 * missing pieces (flags, banners) are backfilled, never overwritten.
 *
 * Team pictures are national flags (public domain) from Wikimedia Commons.
 * Do NOT swap in federation crests — those are trademarked.
 */

export const ORGANIZATION = {
  name: 'FIFA World Cup 2026',
  description:
    'The 23rd FIFA World Cup, co-hosted by Canada, Mexico, and the United States from June 11 – July 19, 2026. Featuring 48 nations across 16 host cities.',
  sport: 'Soccer',
  org_type: 'league',
  location: 'United States, Canada & Mexico',
} as const;

export interface VenueDef {
  /** Display name used in game/event `location` */
  name: string;
  address: string;
  lat: number;
  lng: number;
  capacity: number;
  /** Stadium photo — set as banner_url on the game and event */
  bannerUrl: string;
}

export const VENUES: Record<string, VenueDef> = {
  azteca: {
    name: 'Estadio Azteca, Mexico City, Mexico',
    address:
      'Calzada de Tlalpan 3465, Santa Úrsula Coapa, Coyoacán, 04650 Ciudad de México, CDMX, Mexico',
    lat: 19.303,
    lng: -99.1506,
    capacity: 87523,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Vista_a%C3%A9rea_del_Estadio_Azteca_-_2026_-_02.jpg/960px-Vista_a%C3%A9rea_del_Estadio_Azteca_-_2026_-_02.jpg',
  },
  akron: {
    name: 'Estadio Akron, Zapopan, Guadalajara, Mexico',
    address: 'Av. Paseo Royal Country 4601, Royal Country, 45116 Zapopan, Jal., Mexico',
    lat: 20.6859,
    lng: -103.4667,
    capacity: 46732,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Estadio_Akron_02-07-2022_cabecera_sur_lado_derecho_%283%29.jpg/960px-Estadio_Akron_02-07-2022_cabecera_sur_lado_derecho_%283%29.jpg',
  },
  bbva: {
    name: 'Estadio BBVA, Guadalupe, Monterrey, Mexico',
    address: 'Av. Pablo Livas 2011, La Pastora, 67140 Guadalupe, N.L., Mexico',
    lat: 25.6692,
    lng: -100.2447,
    capacity: 53500,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Mexico_Guadalupe_Monterrey_Estadio_BBVA_Bancomer_fifa_world_cup_2026_6.JPG/960px-Mexico_Guadalupe_Monterrey_Estadio_BBVA_Bancomer_fifa_world_cup_2026_6.JPG',
  },
  bmoField: {
    name: 'BMO Field, Toronto, Canada',
    address: "170 Princes' Blvd, Toronto, ON M6K 3C3, Canada",
    lat: 43.6332,
    lng: -79.4186,
    capacity: 45736,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Toronto_BMO_Field_in_2024.jpg/960px-Toronto_BMO_Field_in_2024.jpg',
  },
  bcPlace: {
    name: 'BC Place, Vancouver, Canada',
    address: '777 Pacific Blvd, Vancouver, BC V6B 4Y8, Canada',
    lat: 49.2767,
    lng: -123.1119,
    capacity: 54500,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/BC_Place_2015_Women%27s_FIFA_World_Cup.jpg/960px-BC_Place_2015_Women%27s_FIFA_World_Cup.jpg',
  },
  lumen: {
    name: 'Lumen Field, Seattle, Washington, USA',
    address: '800 Occidental Ave S, Seattle, WA 98134, USA',
    lat: 47.5952,
    lng: -122.3316,
    capacity: 68740,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/2025_FIFA_Club_World_Cup_-_Seattle_Sounders_FC_vs._Atl%C3%A9tico_Madrid_-_05.jpg/960px-2025_FIFA_Club_World_Cup_-_Seattle_Sounders_FC_vs._Atl%C3%A9tico_Madrid_-_05.jpg',
  },
  levis: {
    name: "Levi's Stadium, Santa Clara, California, USA",
    address: '4900 Marie P DeBartolo Way, Santa Clara, CA 95054, USA',
    lat: 37.403,
    lng: -121.97,
    capacity: 68500,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Levi%27s_Stadium_in_February_2016_prior_to_Super_Bowl_50_%2824398261729%29.jpg/960px-Levi%27s_Stadium_in_February_2016_prior_to_Super_Bowl_50_%2824398261729%29.jpg',
  },
  sofi: {
    name: 'SoFi Stadium, Inglewood, California, USA',
    address: '1001 Stadium Dr, Inglewood, CA 90301, USA',
    lat: 33.9535,
    lng: -118.3392,
    capacity: 70240,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/SoFi_Stadium_2023.jpg/960px-SoFi_Stadium_2023.jpg',
  },
  att: {
    name: 'AT&T Stadium, Arlington, Texas, USA',
    address: '1 AT&T Way, Arlington, TX 76011, USA',
    lat: 32.7473,
    lng: -97.0945,
    capacity: 80000,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Arlington_June_2020_4_%28AT%26T_Stadium%29.jpg/960px-Arlington_June_2020_4_%28AT%26T_Stadium%29.jpg',
  },
  nrg: {
    name: 'NRG Stadium, Houston, Texas, USA',
    address: '1 NRG Pkwy, Houston, TX 77054, USA',
    lat: 29.6847,
    lng: -95.4107,
    capacity: 72220,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Nrg_stadium.jpg/960px-Nrg_stadium.jpg',
  },
  arrowhead: {
    name: 'Arrowhead Stadium, Kansas City, Missouri, USA',
    address: '1 Arrowhead Dr, Kansas City, MO 64129, USA',
    lat: 39.0489,
    lng: -94.4839,
    capacity: 76416,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Aerial_view_of_Arrowhead_Stadium_08-31-2013.jpg/960px-Aerial_view_of_Arrowhead_Stadium_08-31-2013.jpg',
  },
  mercedesBenz: {
    name: 'Mercedes-Benz Stadium, Atlanta, Georgia, USA',
    address: '1 AMB Drive NW, Atlanta, GA 30313, USA',
    lat: 33.7554,
    lng: -84.401,
    capacity: 71000,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Mercedes_Benz_Stadium_time_lapse_capture_2017-08-13.jpg/960px-Mercedes_Benz_Stadium_time_lapse_capture_2017-08-13.jpg',
  },
  hardRock: {
    name: 'Hard Rock Stadium, Miami Gardens, Florida, USA',
    address: '347 Don Shula Dr, Miami Gardens, FL 33056, USA',
    lat: 25.958,
    lng: -80.2389,
    capacity: 64767,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Hard_Rock_Stadium_for_Super_Bowl_LIV_%2849606710103%29.jpg/960px-Hard_Rock_Stadium_for_Super_Bowl_LIV_%2849606710103%29.jpg',
  },
  gillette: {
    name: 'Gillette Stadium, Foxborough, Massachusetts, USA',
    address: '1 Patriot Pl, Foxborough, MA 02035, USA',
    lat: 42.0909,
    lng: -71.2643,
    capacity: 64628,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Gillette_Stadium_%28Top_View%29.jpg/960px-Gillette_Stadium_%28Top_View%29.jpg',
  },
  lincoln: {
    name: 'Lincoln Financial Field, Philadelphia, Pennsylvania, USA',
    address: '1 Lincoln Financial Field Way, Philadelphia, PA 19148, USA',
    lat: 39.9008,
    lng: -75.1675,
    capacity: 69596,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Lincoln_Financial_Field_%28Aerial_view%29.jpg/960px-Lincoln_Financial_Field_%28Aerial_view%29.jpg',
  },
  metlife: {
    name: 'MetLife Stadium, East Rutherford, New Jersey, USA',
    address: '1 MetLife Stadium Dr, East Rutherford, NJ 07073, USA',
    lat: 40.8135,
    lng: -74.0745,
    capacity: 82500,
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Metlife_stadium_%28Aerial_view%29.jpg/960px-Metlife_stadium_%28Aerial_view%29.jpg',
  },
};

export interface TeamDef {
  name: string;
  city: string;
  state: string;
  /** National flag (public domain) — NOT the federation crest (trademarked) */
  logoUrl: string;
}

export const TEAMS: Record<string, TeamDef> = {
  Algeria: {
    name: 'Algeria',
    city: 'Algiers',
    state: 'Algeria',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Flag_of_Algeria.svg/250px-Flag_of_Algeria.svg.png',
  },
  Argentina: {
    name: 'Argentina',
    city: 'Buenos Aires',
    state: 'Argentina',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_Argentina.svg/250px-Flag_of_Argentina.svg.png',
  },
  Australia: {
    name: 'Australia',
    city: 'Canberra',
    state: 'Australia',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Flag_of_Australia_%28converted%29.svg/250px-Flag_of_Australia_%28converted%29.svg.png',
  },
  Austria: {
    name: 'Austria',
    city: 'Vienna',
    state: 'Austria',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Flag_of_Austria.svg/250px-Flag_of_Austria.svg.png',
  },
  Belgium: {
    name: 'Belgium',
    city: 'Brussels',
    state: 'Belgium',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Flag_of_Belgium.svg/250px-Flag_of_Belgium.svg.png',
  },
  'Bosnia and Herzegovina': {
    name: 'Bosnia and Herzegovina',
    city: 'Sarajevo',
    state: 'Bosnia and Herzegovina',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Flag_of_Bosnia_and_Herzegovina.svg/250px-Flag_of_Bosnia_and_Herzegovina.svg.png',
  },
  Brazil: {
    name: 'Brazil',
    city: 'Brasília',
    state: 'Brazil',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/250px-Flag_of_Brazil.svg.png',
  },
  'Cabo Verde': {
    name: 'Cabo Verde',
    city: 'Praia',
    state: 'Cabo Verde',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Flag_of_Cape_Verde.svg/250px-Flag_of_Cape_Verde.svg.png',
  },
  Canada: {
    name: 'Canada',
    city: 'Toronto',
    state: 'Canada',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Flag_of_Canada_%28Pantone%29.svg/250px-Flag_of_Canada_%28Pantone%29.svg.png',
  },
  Colombia: {
    name: 'Colombia',
    city: 'Bogotá',
    state: 'Colombia',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Flag_of_Colombia.svg/250px-Flag_of_Colombia.svg.png',
  },
  'Congo DR': {
    name: 'Congo DR',
    city: 'Kinshasa',
    state: 'DR Congo',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Flag_of_the_Democratic_Republic_of_the_Congo.svg/250px-Flag_of_the_Democratic_Republic_of_the_Congo.svg.png',
  },
  Croatia: {
    name: 'Croatia',
    city: 'Zagreb',
    state: 'Croatia',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Flag_of_Croatia.svg/250px-Flag_of_Croatia.svg.png',
  },
  Curaçao: {
    name: 'Curaçao',
    city: 'Willemstad',
    state: 'Curaçao',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Flag_of_Cura%C3%A7ao.svg/250px-Flag_of_Cura%C3%A7ao.svg.png',
  },
  Czechia: {
    name: 'Czechia',
    city: 'Prague',
    state: 'Czech Republic',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Flag_of_the_Czech_Republic.svg/250px-Flag_of_the_Czech_Republic.svg.png',
  },
  'Ivory Coast': {
    name: 'Ivory Coast',
    city: 'Abidjan',
    state: 'Ivory Coast',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_C%C3%B4te_d%27Ivoire.svg/250px-Flag_of_C%C3%B4te_d%27Ivoire.svg.png',
  },
  Ecuador: {
    name: 'Ecuador',
    city: 'Quito',
    state: 'Ecuador',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Flag_of_Ecuador.svg/250px-Flag_of_Ecuador.svg.png',
  },
  Egypt: {
    name: 'Egypt',
    city: 'Cairo',
    state: 'Egypt',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_Egypt.svg/250px-Flag_of_Egypt.svg.png',
  },
  England: {
    name: 'England',
    city: 'London',
    state: 'England',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Flag_of_England.svg/250px-Flag_of_England.svg.png',
  },
  France: {
    name: 'France',
    city: 'Paris',
    state: 'France',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/250px-Flag_of_France.svg.png',
  },
  Germany: {
    name: 'Germany',
    city: 'Berlin',
    state: 'Germany',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/250px-Flag_of_Germany.svg.png',
  },
  Ghana: {
    name: 'Ghana',
    city: 'Accra',
    state: 'Ghana',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Flag_of_Ghana.svg/250px-Flag_of_Ghana.svg.png',
  },
  Haiti: {
    name: 'Haiti',
    city: 'Port-au-Prince',
    state: 'Haiti',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Flag_of_Haiti.svg/250px-Flag_of_Haiti.svg.png',
  },
  'IR Iran': {
    name: 'IR Iran',
    city: 'Tehran',
    state: 'Iran',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Flag_of_Iran.svg/250px-Flag_of_Iran.svg.png',
  },
  Iraq: {
    name: 'Iraq',
    city: 'Baghdad',
    state: 'Iraq',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Flag_of_Iraq.svg/250px-Flag_of_Iraq.svg.png',
  },
  Japan: {
    name: 'Japan',
    city: 'Tokyo',
    state: 'Japan',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Flag_of_Japan.svg/250px-Flag_of_Japan.svg.png',
  },
  Jordan: {
    name: 'Jordan',
    city: 'Amman',
    state: 'Jordan',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Flag_of_Jordan.svg/250px-Flag_of_Jordan.svg.png',
  },
  Mexico: {
    name: 'Mexico',
    city: 'Mexico City',
    state: 'Mexico',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Flag_of_Mexico.svg/250px-Flag_of_Mexico.svg.png',
  },
  Morocco: {
    name: 'Morocco',
    city: 'Rabat',
    state: 'Morocco',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Flag_of_Morocco.svg/250px-Flag_of_Morocco.svg.png',
  },
  Netherlands: {
    name: 'Netherlands',
    city: 'Amsterdam',
    state: 'Netherlands',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Flag_of_the_Netherlands.svg/250px-Flag_of_the_Netherlands.svg.png',
  },
  'New Zealand': {
    name: 'New Zealand',
    city: 'Wellington',
    state: 'New Zealand',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Flag_of_New_Zealand.svg/250px-Flag_of_New_Zealand.svg.png',
  },
  Norway: {
    name: 'Norway',
    city: 'Oslo',
    state: 'Norway',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Flag_of_Norway.svg/250px-Flag_of_Norway.svg.png',
  },
  Panama: {
    name: 'Panama',
    city: 'Panama City',
    state: 'Panama',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Flag_of_Panama.svg/250px-Flag_of_Panama.svg.png',
  },
  Paraguay: {
    name: 'Paraguay',
    city: 'Asunción',
    state: 'Paraguay',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Flag_of_Paraguay.svg/250px-Flag_of_Paraguay.svg.png',
  },
  Portugal: {
    name: 'Portugal',
    city: 'Lisbon',
    state: 'Portugal',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Portugal.svg/250px-Flag_of_Portugal.svg.png',
  },
  Qatar: {
    name: 'Qatar',
    city: 'Doha',
    state: 'Qatar',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Flag_of_Qatar.svg/250px-Flag_of_Qatar.svg.png',
  },
  'Saudi Arabia': {
    name: 'Saudi Arabia',
    city: 'Riyadh',
    state: 'Saudi Arabia',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Flag_of_Saudi_Arabia.svg/250px-Flag_of_Saudi_Arabia.svg.png',
  },
  Scotland: {
    name: 'Scotland',
    city: 'Edinburgh',
    state: 'Scotland',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Flag_of_Scotland.svg/250px-Flag_of_Scotland.svg.png',
  },
  Senegal: {
    name: 'Senegal',
    city: 'Dakar',
    state: 'Senegal',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Flag_of_Senegal.svg/250px-Flag_of_Senegal.svg.png',
  },
  'South Africa': {
    name: 'South Africa',
    city: 'Johannesburg',
    state: 'South Africa',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Flag_of_South_Africa.svg/250px-Flag_of_South_Africa.svg.png',
  },
  'South Korea': {
    name: 'South Korea',
    city: 'Seoul',
    state: 'South Korea',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Flag_of_South_Korea.svg/250px-Flag_of_South_Korea.svg.png',
  },
  Spain: {
    name: 'Spain',
    city: 'Madrid',
    state: 'Spain',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Flag_of_Spain.svg/250px-Flag_of_Spain.svg.png',
  },
  Sweden: {
    name: 'Sweden',
    city: 'Stockholm',
    state: 'Sweden',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Flag_of_Sweden.svg/250px-Flag_of_Sweden.svg.png',
  },
  Switzerland: {
    name: 'Switzerland',
    city: 'Bern',
    state: 'Switzerland',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Switzerland.svg/250px-Flag_of_Switzerland.svg.png',
  },
  Tunisia: {
    name: 'Tunisia',
    city: 'Tunis',
    state: 'Tunisia',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Flag_of_Tunisia.svg/250px-Flag_of_Tunisia.svg.png',
  },
  Türkiye: {
    name: 'Türkiye',
    city: 'Ankara',
    state: 'Türkiye',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_Turkey.svg/250px-Flag_of_Turkey.svg.png',
  },
  USA: {
    name: 'USA',
    city: 'Washington',
    state: 'USA',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/250px-Flag_of_the_United_States.svg.png',
  },
  Uruguay: {
    name: 'Uruguay',
    city: 'Montevideo',
    state: 'Uruguay',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_Uruguay.svg/250px-Flag_of_Uruguay.svg.png',
  },
  Uzbekistan: {
    name: 'Uzbekistan',
    city: 'Tashkent',
    state: 'Uzbekistan',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Flag_of_Uzbekistan.svg/250px-Flag_of_Uzbekistan.svg.png',
  },
};

export interface MatchDef {
  /** Keys into TEAMS */
  home: string;
  away: string;
  /** Key into VENUES */
  venue: string;
  /** Kickoff in UTC (ISO 8601 with Z) */
  kickoffUtc: string;
  /** e.g. "Group A" */
  group: string;
  /** Shown in game description, e.g. "Match 1" */
  matchLabel: string;
  /** Local-time blurb appended to the event description */
  kickoffLocalNote: string;
  /** true when neither side is the venue's host nation */
  isNeutral: boolean;
  /** Extra flavor sentence for the game description (optional) */
  note?: string;
}

export const MATCHES: MatchDef[] = [
  // ── June 11 ────────────────────────────────────────────────────────────────
  {
    home: 'Mexico',
    away: 'South Africa',
    venue: 'azteca',
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    group: 'Group A',
    matchLabel: 'Match 1',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 1:00 PM CST.',
    isNeutral: false,
  },
  {
    home: 'South Korea',
    away: 'Czechia',
    venue: 'akron',
    kickoffUtc: '2026-06-12T02:00:00.000Z',
    group: 'Group A',
    matchLabel: 'Match 2',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 8:00 PM CST.',
    isNeutral: true,
  },
  // ── June 12 ────────────────────────────────────────────────────────────────
  {
    home: 'Canada',
    away: 'Bosnia and Herzegovina',
    venue: 'bmoField',
    kickoffUtc: '2026-06-12T19:00:00.000Z',
    group: 'Group B',
    matchLabel: 'Match 3',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT.',
    isNeutral: false,
  },
  {
    home: 'USA',
    away: 'Paraguay',
    venue: 'sofi',
    kickoffUtc: '2026-06-13T01:00:00.000Z',
    group: 'Group D',
    matchLabel: 'Match 4',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 6:00 PM PDT.',
    isNeutral: false,
  },
  // ── June 13 ────────────────────────────────────────────────────────────────
  {
    home: 'Haiti',
    away: 'Scotland',
    venue: 'gillette',
    kickoffUtc: '2026-06-14T01:00:00.000Z',
    group: 'Group C',
    matchLabel: 'Match 5',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Australia',
    away: 'Türkiye',
    venue: 'bcPlace',
    kickoffUtc: '2026-06-14T04:00:00.000Z',
    group: 'Group D',
    matchLabel: 'Match 6',
    kickoffLocalNote: 'Kickoff: 12:00 AM EDT / 9:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'Brazil',
    away: 'Morocco',
    venue: 'metlife',
    kickoffUtc: '2026-06-13T22:00:00.000Z',
    group: 'Group C',
    matchLabel: 'Match 7',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Qatar',
    away: 'Switzerland',
    venue: 'levis',
    kickoffUtc: '2026-06-13T19:00:00.000Z',
    group: 'Group B',
    matchLabel: 'Match 8',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: true,
  },
  // ── June 14 ────────────────────────────────────────────────────────────────
  {
    home: 'Ivory Coast',
    away: 'Ecuador',
    venue: 'lincoln',
    kickoffUtc: '2026-06-14T23:00:00.000Z',
    group: 'Group E',
    matchLabel: 'Match 9',
    kickoffLocalNote: 'Kickoff: 7:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Germany',
    away: 'Curaçao',
    venue: 'nrg',
    kickoffUtc: '2026-06-14T17:00:00.000Z',
    group: 'Group E',
    matchLabel: 'Match 10',
    kickoffLocalNote: 'Kickoff: 1:00 PM EDT / 12:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Netherlands',
    away: 'Japan',
    venue: 'att',
    kickoffUtc: '2026-06-14T20:00:00.000Z',
    group: 'Group F',
    matchLabel: 'Match 11',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT / 3:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Sweden',
    away: 'Tunisia',
    venue: 'bbva',
    kickoffUtc: '2026-06-15T02:00:00.000Z',
    group: 'Group F',
    matchLabel: 'Match 12',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 8:00 PM CST.',
    isNeutral: true,
  },
  // ── June 15 ────────────────────────────────────────────────────────────────
  {
    home: 'Saudi Arabia',
    away: 'Uruguay',
    venue: 'hardRock',
    kickoffUtc: '2026-06-15T22:00:00.000Z',
    group: 'Group H',
    matchLabel: 'Match 13',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Spain',
    away: 'Cabo Verde',
    venue: 'mercedesBenz',
    kickoffUtc: '2026-06-15T16:00:00.000Z',
    group: 'Group H',
    matchLabel: 'Match 14',
    kickoffLocalNote: 'Kickoff: 12:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'IR Iran',
    away: 'New Zealand',
    venue: 'sofi',
    kickoffUtc: '2026-06-16T01:00:00.000Z',
    group: 'Group G',
    matchLabel: 'Match 15',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 6:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'Belgium',
    away: 'Egypt',
    venue: 'lumen',
    kickoffUtc: '2026-06-15T19:00:00.000Z',
    group: 'Group G',
    matchLabel: 'Match 16',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: true,
  },
  // ── June 16 ────────────────────────────────────────────────────────────────
  {
    home: 'France',
    away: 'Senegal',
    venue: 'metlife',
    kickoffUtc: '2026-06-16T19:00:00.000Z',
    group: 'Group I',
    matchLabel: 'Match 17',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Iraq',
    away: 'Norway',
    venue: 'gillette',
    kickoffUtc: '2026-06-16T22:00:00.000Z',
    group: 'Group I',
    matchLabel: 'Match 18',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Argentina',
    away: 'Algeria',
    venue: 'arrowhead',
    kickoffUtc: '2026-06-17T01:00:00.000Z',
    group: 'Group J',
    matchLabel: 'Match 19',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 8:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Austria',
    away: 'Jordan',
    venue: 'levis',
    kickoffUtc: '2026-06-17T04:00:00.000Z',
    group: 'Group J',
    matchLabel: 'Match 20',
    kickoffLocalNote: 'Kickoff: 12:00 AM EDT / 9:00 PM PDT.',
    isNeutral: true,
  },
  // ── June 17 ────────────────────────────────────────────────────────────────
  {
    home: 'Ghana',
    away: 'Panama',
    venue: 'bmoField',
    kickoffUtc: '2026-06-17T23:00:00.000Z',
    group: 'Group L',
    matchLabel: 'Match 21',
    kickoffLocalNote: 'Kickoff: 7:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'England',
    away: 'Croatia',
    venue: 'att',
    kickoffUtc: '2026-06-17T20:00:00.000Z',
    group: 'Group L',
    matchLabel: 'Match 22',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT / 3:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Portugal',
    away: 'Congo DR',
    venue: 'nrg',
    kickoffUtc: '2026-06-17T17:00:00.000Z',
    group: 'Group K',
    matchLabel: 'Match 23',
    kickoffLocalNote: 'Kickoff: 1:00 PM EDT / 12:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Uzbekistan',
    away: 'Colombia',
    venue: 'azteca',
    kickoffUtc: '2026-06-18T02:00:00.000Z',
    group: 'Group K',
    matchLabel: 'Match 24',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 8:00 PM CST.',
    isNeutral: true,
  },
  // ── June 18 ────────────────────────────────────────────────────────────────
  {
    home: 'Czechia',
    away: 'South Africa',
    venue: 'mercedesBenz',
    kickoffUtc: '2026-06-18T16:00:00.000Z',
    group: 'Group A',
    matchLabel: 'Match 25',
    kickoffLocalNote: 'Kickoff: 12:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Switzerland',
    away: 'Bosnia and Herzegovina',
    venue: 'sofi',
    kickoffUtc: '2026-06-18T19:00:00.000Z',
    group: 'Group B',
    matchLabel: 'Match 26',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'Canada',
    away: 'Qatar',
    venue: 'bcPlace',
    kickoffUtc: '2026-06-18T22:00:00.000Z',
    group: 'Group B',
    matchLabel: 'Match 27',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT / 3:00 PM PDT.',
    isNeutral: false,
  },
  {
    home: 'Mexico',
    away: 'South Korea',
    venue: 'akron',
    kickoffUtc: '2026-06-19T01:00:00.000Z',
    group: 'Group A',
    matchLabel: 'Match 28',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 7:00 PM CST.',
    isNeutral: false,
  },
  // ── June 19 ────────────────────────────────────────────────────────────────
  {
    home: 'Brazil',
    away: 'Haiti',
    venue: 'lincoln',
    kickoffUtc: '2026-06-20T01:00:00.000Z',
    group: 'Group C',
    matchLabel: 'Match 29',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Scotland',
    away: 'Morocco',
    venue: 'gillette',
    kickoffUtc: '2026-06-19T22:00:00.000Z',
    group: 'Group C',
    matchLabel: 'Match 30',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Türkiye',
    away: 'Paraguay',
    venue: 'levis',
    kickoffUtc: '2026-06-20T04:00:00.000Z',
    group: 'Group D',
    matchLabel: 'Match 31',
    kickoffLocalNote: 'Kickoff: 12:00 AM EDT / 9:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'USA',
    away: 'Australia',
    venue: 'lumen',
    kickoffUtc: '2026-06-19T19:00:00.000Z',
    group: 'Group D',
    matchLabel: 'Match 32',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: false,
  },
  // ── June 20 ────────────────────────────────────────────────────────────────
  {
    home: 'Germany',
    away: 'Ivory Coast',
    venue: 'bmoField',
    kickoffUtc: '2026-06-20T20:00:00.000Z',
    group: 'Group E',
    matchLabel: 'Match 33',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Ecuador',
    away: 'Curaçao',
    venue: 'arrowhead',
    kickoffUtc: '2026-06-21T00:00:00.000Z',
    group: 'Group E',
    matchLabel: 'Match 34',
    kickoffLocalNote: 'Kickoff: 8:00 PM EDT / 7:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Netherlands',
    away: 'Sweden',
    venue: 'nrg',
    kickoffUtc: '2026-06-20T17:00:00.000Z',
    group: 'Group F',
    matchLabel: 'Match 35',
    kickoffLocalNote: 'Kickoff: 1:00 PM EDT / 12:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Tunisia',
    away: 'Japan',
    venue: 'bbva',
    kickoffUtc: '2026-06-21T04:00:00.000Z',
    group: 'Group F',
    matchLabel: 'Match 36',
    kickoffLocalNote: 'Kickoff: 12:00 AM EDT / 10:00 PM CST.',
    isNeutral: true,
  },
  // ── June 21 ────────────────────────────────────────────────────────────────
  {
    home: 'Uruguay',
    away: 'Cabo Verde',
    venue: 'hardRock',
    kickoffUtc: '2026-06-21T22:00:00.000Z',
    group: 'Group H',
    matchLabel: 'Match 37',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Spain',
    away: 'Saudi Arabia',
    venue: 'mercedesBenz',
    kickoffUtc: '2026-06-21T16:00:00.000Z',
    group: 'Group H',
    matchLabel: 'Match 38',
    kickoffLocalNote: 'Kickoff: 12:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Belgium',
    away: 'IR Iran',
    venue: 'sofi',
    kickoffUtc: '2026-06-21T19:00:00.000Z',
    group: 'Group G',
    matchLabel: 'Match 39',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'New Zealand',
    away: 'Egypt',
    venue: 'bcPlace',
    kickoffUtc: '2026-06-22T01:00:00.000Z',
    group: 'Group G',
    matchLabel: 'Match 40',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 6:00 PM PDT.',
    isNeutral: true,
  },
  // ── June 22 ────────────────────────────────────────────────────────────────
  {
    home: 'Norway',
    away: 'Senegal',
    venue: 'metlife',
    kickoffUtc: '2026-06-23T00:00:00.000Z',
    group: 'Group I',
    matchLabel: 'Match 41',
    kickoffLocalNote: 'Kickoff: 8:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'France',
    away: 'Iraq',
    venue: 'lincoln',
    kickoffUtc: '2026-06-22T21:00:00.000Z',
    group: 'Group I',
    matchLabel: 'Match 42',
    kickoffLocalNote: 'Kickoff: 5:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Argentina',
    away: 'Austria',
    venue: 'att',
    kickoffUtc: '2026-06-22T17:00:00.000Z',
    group: 'Group J',
    matchLabel: 'Match 43',
    kickoffLocalNote: 'Kickoff: 1:00 PM EDT / 12:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Jordan',
    away: 'Algeria',
    venue: 'levis',
    kickoffUtc: '2026-06-23T03:00:00.000Z',
    group: 'Group J',
    matchLabel: 'Match 44',
    kickoffLocalNote: 'Kickoff: 11:00 PM EDT / 8:00 PM PDT.',
    isNeutral: true,
  },
  // ── June 23 ────────────────────────────────────────────────────────────────
  {
    home: 'England',
    away: 'Ghana',
    venue: 'gillette',
    kickoffUtc: '2026-06-23T20:00:00.000Z',
    group: 'Group L',
    matchLabel: 'Match 45',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Panama',
    away: 'Croatia',
    venue: 'bmoField',
    kickoffUtc: '2026-06-23T23:00:00.000Z',
    group: 'Group L',
    matchLabel: 'Match 46',
    kickoffLocalNote: 'Kickoff: 7:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Portugal',
    away: 'Uzbekistan',
    venue: 'nrg',
    kickoffUtc: '2026-06-23T17:00:00.000Z',
    group: 'Group K',
    matchLabel: 'Match 47',
    kickoffLocalNote: 'Kickoff: 1:00 PM EDT / 12:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Colombia',
    away: 'Congo DR',
    venue: 'akron',
    kickoffUtc: '2026-06-24T02:00:00.000Z',
    group: 'Group K',
    matchLabel: 'Match 48',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 8:00 PM CST.',
    isNeutral: true,
  },
  // ── June 24 ────────────────────────────────────────────────────────────────
  {
    home: 'Scotland',
    away: 'Brazil',
    venue: 'hardRock',
    kickoffUtc: '2026-06-24T22:00:00.000Z',
    group: 'Group C',
    matchLabel: 'Match 49',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Morocco',
    away: 'Haiti',
    venue: 'mercedesBenz',
    kickoffUtc: '2026-06-24T22:00:00.000Z',
    group: 'Group C',
    matchLabel: 'Match 50',
    kickoffLocalNote: 'Kickoff: 6:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Switzerland',
    away: 'Canada',
    venue: 'bcPlace',
    kickoffUtc: '2026-06-24T19:00:00.000Z',
    group: 'Group B',
    matchLabel: 'Match 51',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: false,
  },
  {
    home: 'Bosnia and Herzegovina',
    away: 'Qatar',
    venue: 'lumen',
    kickoffUtc: '2026-06-24T19:00:00.000Z',
    group: 'Group B',
    matchLabel: 'Match 52',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'Czechia',
    away: 'Mexico',
    venue: 'azteca',
    kickoffUtc: '2026-06-25T01:00:00.000Z',
    group: 'Group A',
    matchLabel: 'Match 53',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 7:00 PM CST.',
    isNeutral: false,
  },
  {
    home: 'South Africa',
    away: 'South Korea',
    venue: 'bbva',
    kickoffUtc: '2026-06-25T01:00:00.000Z',
    group: 'Group A',
    matchLabel: 'Match 54',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 7:00 PM CST.',
    isNeutral: true,
  },
  // ── June 25 ────────────────────────────────────────────────────────────────
  {
    home: 'Curaçao',
    away: 'Ivory Coast',
    venue: 'lincoln',
    kickoffUtc: '2026-06-25T20:00:00.000Z',
    group: 'Group E',
    matchLabel: 'Match 55',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Ecuador',
    away: 'Germany',
    venue: 'metlife',
    kickoffUtc: '2026-06-25T20:00:00.000Z',
    group: 'Group E',
    matchLabel: 'Match 56',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Japan',
    away: 'Sweden',
    venue: 'att',
    kickoffUtc: '2026-06-25T23:00:00.000Z',
    group: 'Group F',
    matchLabel: 'Match 57',
    kickoffLocalNote: 'Kickoff: 7:00 PM EDT / 6:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Tunisia',
    away: 'Netherlands',
    venue: 'arrowhead',
    kickoffUtc: '2026-06-25T23:00:00.000Z',
    group: 'Group F',
    matchLabel: 'Match 58',
    kickoffLocalNote: 'Kickoff: 7:00 PM EDT / 6:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Türkiye',
    away: 'USA',
    venue: 'sofi',
    kickoffUtc: '2026-06-26T02:00:00.000Z',
    group: 'Group D',
    matchLabel: 'Match 59',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 7:00 PM PDT.',
    isNeutral: false,
  },
  {
    home: 'Paraguay',
    away: 'Australia',
    venue: 'levis',
    kickoffUtc: '2026-06-26T02:00:00.000Z',
    group: 'Group D',
    matchLabel: 'Match 60',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 7:00 PM PDT.',
    isNeutral: true,
  },
  // ── June 26 ────────────────────────────────────────────────────────────────
  {
    home: 'Norway',
    away: 'France',
    venue: 'gillette',
    kickoffUtc: '2026-06-26T19:00:00.000Z',
    group: 'Group I',
    matchLabel: 'Match 61',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Senegal',
    away: 'Iraq',
    venue: 'bmoField',
    kickoffUtc: '2026-06-26T19:00:00.000Z',
    group: 'Group I',
    matchLabel: 'Match 62',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Egypt',
    away: 'IR Iran',
    venue: 'lumen',
    kickoffUtc: '2026-06-27T03:00:00.000Z',
    group: 'Group G',
    matchLabel: 'Match 63',
    kickoffLocalNote: 'Kickoff: 11:00 PM EDT / 8:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'New Zealand',
    away: 'Belgium',
    venue: 'bcPlace',
    kickoffUtc: '2026-06-27T03:00:00.000Z',
    group: 'Group G',
    matchLabel: 'Match 64',
    kickoffLocalNote: 'Kickoff: 11:00 PM EDT / 8:00 PM PDT.',
    isNeutral: true,
  },
  {
    home: 'Cabo Verde',
    away: 'Saudi Arabia',
    venue: 'nrg',
    kickoffUtc: '2026-06-27T00:00:00.000Z',
    group: 'Group H',
    matchLabel: 'Match 65',
    kickoffLocalNote: 'Kickoff: 8:00 PM EDT / 7:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Uruguay',
    away: 'Spain',
    venue: 'akron',
    kickoffUtc: '2026-06-27T00:00:00.000Z',
    group: 'Group H',
    matchLabel: 'Match 66',
    kickoffLocalNote: 'Kickoff: 8:00 PM EDT / 6:00 PM CST.',
    isNeutral: true,
  },
  // ── June 27 ────────────────────────────────────────────────────────────────
  {
    home: 'Panama',
    away: 'England',
    venue: 'metlife',
    kickoffUtc: '2026-06-27T21:00:00.000Z',
    group: 'Group L',
    matchLabel: 'Match 67',
    kickoffLocalNote: 'Kickoff: 5:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Croatia',
    away: 'Ghana',
    venue: 'lincoln',
    kickoffUtc: '2026-06-27T21:00:00.000Z',
    group: 'Group L',
    matchLabel: 'Match 68',
    kickoffLocalNote: 'Kickoff: 5:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Algeria',
    away: 'Austria',
    venue: 'arrowhead',
    kickoffUtc: '2026-06-28T02:00:00.000Z',
    group: 'Group J',
    matchLabel: 'Match 69',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 9:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Jordan',
    away: 'Argentina',
    venue: 'att',
    kickoffUtc: '2026-06-28T02:00:00.000Z',
    group: 'Group J',
    matchLabel: 'Match 70',
    kickoffLocalNote: 'Kickoff: 10:00 PM EDT / 9:00 PM CDT.',
    isNeutral: true,
  },
  {
    home: 'Colombia',
    away: 'Portugal',
    venue: 'hardRock',
    kickoffUtc: '2026-06-27T23:30:00.000Z',
    group: 'Group K',
    matchLabel: 'Match 71',
    kickoffLocalNote: 'Kickoff: 7:30 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Congo DR',
    away: 'Uzbekistan',
    venue: 'mercedesBenz',
    kickoffUtc: '2026-06-27T23:30:00.000Z',
    group: 'Group K',
    matchLabel: 'Match 72',
    kickoffLocalNote: 'Kickoff: 7:30 PM EDT.',
    isNeutral: true,
  },
  // ── Round of 16 — July 4 ───────────────────────────────────────────────────
  {
    home: 'Canada',
    away: 'Morocco',
    venue: 'nrg',
    kickoffUtc: '2026-07-04T17:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 90',
    kickoffLocalNote: 'Kickoff: 1:00 PM EDT / 12:00 PM CDT.',
    isNeutral: true,
    note: 'Canada (Group B winner) meets Morocco after their shootout upset of the Netherlands.',
  },
  {
    home: 'Paraguay',
    away: 'France',
    venue: 'lincoln',
    kickoffUtc: '2026-07-04T21:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 89',
    kickoffLocalNote: 'Kickoff: 5:00 PM EDT.',
    isNeutral: true,
    note: 'Paraguay reach the last 16 after a shootout win over Germany; France arrive as two-time champions.',
  },
  // ── Round of 16 — July 5 ───────────────────────────────────────────────────
  {
    home: 'Brazil',
    away: 'Norway',
    venue: 'metlife',
    kickoffUtc: '2026-07-05T20:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 91',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Mexico',
    away: 'England',
    venue: 'azteca',
    kickoffUtc: '2026-07-06T00:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 92',
    kickoffLocalNote: 'Kickoff: 8:00 PM EDT / 6:00 PM local in Mexico City.',
    isNeutral: false,
    note: 'Host nation Mexico take on England at the Azteca.',
  },
  // ── Round of 16 — July 6 ───────────────────────────────────────────────────
  {
    home: 'Portugal',
    away: 'Spain',
    venue: 'att',
    kickoffUtc: '2026-07-06T19:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 93',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 2:00 PM CDT.',
    isNeutral: true,
    note: 'Iberian derby — reigning European champions Spain against Ronaldo’s Portugal.',
  },
  {
    home: 'USA',
    away: 'Belgium',
    venue: 'lumen',
    kickoffUtc: '2026-07-07T00:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 94',
    kickoffLocalNote: 'Kickoff: 8:00 PM EDT / 5:00 PM PDT.',
    isNeutral: false,
    note: 'The hosts play for a quarterfinal spot in front of a packed Lumen Field.',
  },
  // ── Round of 16 — July 7 ───────────────────────────────────────────────────
  {
    home: 'Argentina',
    away: 'Egypt',
    venue: 'mercedesBenz',
    kickoffUtc: '2026-07-07T16:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 95',
    kickoffLocalNote: 'Kickoff: 12:00 PM EDT.',
    isNeutral: true,
  },
  {
    home: 'Switzerland',
    away: 'Colombia',
    venue: 'bcPlace',
    kickoffUtc: '2026-07-07T20:00:00.000Z',
    group: 'Round of 16',
    matchLabel: 'Match 96',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT / 1:00 PM PDT.',
    isNeutral: true,
  },
  // ── Quarterfinals ──────────────────────────────────────────────────────────
  {
    home: 'France',
    away: 'Morocco',
    venue: 'gillette',
    kickoffUtc: '2026-07-09T20:00:00.000Z',
    group: 'Quarterfinal',
    matchLabel: 'Match 97',
    kickoffLocalNote: 'Kickoff: 4:00 PM EDT.',
    isNeutral: true,
    note: 'Rematch of the 2022 semifinal.',
  },
  {
    home: 'Norway',
    away: 'England',
    venue: 'hardRock',
    kickoffUtc: '2026-07-11T21:00:00.000Z',
    group: 'Quarterfinal',
    matchLabel: 'Match 99',
    kickoffLocalNote: 'Kickoff: 5:00 PM EDT.',
    isNeutral: true,
    note: 'Norway stunned Brazil to get here; England survived Mexico at the Azteca.',
  },
  {
    home: 'Spain',
    away: 'Belgium',
    venue: 'sofi',
    kickoffUtc: '2026-07-10T19:00:00.000Z',
    group: 'Quarterfinal',
    matchLabel: 'Match 98',
    kickoffLocalNote: 'Kickoff: 3:00 PM EDT / 12:00 PM PDT.',
    isNeutral: true,
    note: 'Third World Cup meeting between these two — Spain beat Portugal 1-0, Belgium routed host USA 4-1 to get here.',
  },
  {
    home: 'Argentina',
    away: 'Switzerland',
    venue: 'arrowhead',
    kickoffUtc: '2026-07-12T01:00:00.000Z',
    group: 'Quarterfinal',
    matchLabel: 'Match 100',
    kickoffLocalNote: 'Kickoff: 9:00 PM EDT / 8:00 PM CDT.',
    isNeutral: true,
    note: "Argentina completed a stunning comeback to beat Egypt 3-2; Switzerland outlasted Colombia 4-3 on penalties.",
  },
];
