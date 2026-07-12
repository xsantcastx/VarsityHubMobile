/**
 * One-off events — template data.
 *
 * Edit this file each time you want to push standalone events (watch parties,
 * fundraisers, tryouts, meetups, or a single game) that don't belong to a
 * tournament/org structure like the FIFA template. Then run:
 *
 *   npx tsx scripts/one-off/create-one-off-events.ts --dry-run   # preview
 *   npx tsx scripts/one-off/create-one-off-events.ts             # create
 *
 * The engine is idempotent — events are matched by title + exact date, so
 * already-created entries are skipped and it's safe to leave old entries in
 * the list (or delete them once they've been pushed, your call).
 *
 * The two entries below are EXAMPLES with fake names — replace them with real
 * events before running without --dry-run.
 */

export interface OneOffEventDef {
  title: string;
  description: string;
  /** game | watch_party | fundraiser | tryout | bbq | other */
  eventType: 'game' | 'watch_party' | 'fundraiser' | 'tryout' | 'bbq' | 'other';
  /** Event start in UTC (ISO 8601 with Z) */
  dateUtc: string;
  /** Display location / address */
  location: string;
  /** Optional map pin — without these the event won't appear on the map */
  lat?: number;
  lng?: number;
  /**
   * Stadium/venue photo URL — set as banner_url on the event (and the game,
   * for game-type entries). Use a direct https image URL (e.g. Wikimedia
   * Commons or Cloudinary).
   */
  bannerUrl?: string;
  /** Optional RSVP cap */
  maxAttendees?: number;
  /** Optional contact line shown on the event */
  contactInfo?: string;
  /** Optional league/school label */
  linkedLeague?: string;
  /**
   * Provide this to also create a linked Game record — needed for the entry
   * to show up in the main feed's "upcoming" section, which reads ONLY from
   * Game.list(), never from standalone Events. Omit homeTeam/awayTeam for
   * non-matchup entries (festivals, watch parties with no "vs") — the feed
   * card never renders team names, so a teamless Game displays fine.
   */
  game?: {
    homeTeam?: string;
    awayTeam?: string;
    expectedAttendance?: number;
    isNeutral?: boolean;
    /**
     * Optional: ensure Team records exist (created under this EXISTING org,
     * matched by name) so the game page shows team cards with pictures.
     * Logo licensing — pro league logos (NBA/NFL/MLB/etc.) are trademarked and
     * NOT free to use; do not hotlink them. Safe options: national flags
     * (public domain), a generated initials monogram (e.g. ui-avatars.com), or
     * artwork you own. Existing teams keep their current logo (no overwrite).
     */
    teamOrgName?: string;
    homeTeamLogoUrl?: string;
    awayTeamLogoUrl?: string;
  };
}

export const EVENTS: OneOffEventDef[] = [
  // ── Wimbledon 2026 — Women's Semifinal 2 (created 2026-07-09) ────────────────────
  {
    title: "Wimbledon Women's Semifinal: Kostyuk vs Noskova",
    description:
      "The day's second Centre Court semifinal, following Karolína Muchová's 7-6(4) 6-4 win over Coco Gauff earlier in the session. The winner faces Muchová in Saturday's final. Centre Court play begins 1:30 PM BST; second-match start time depends on how the first match runs.",
    eventType: 'game',
    dateUtc: '2026-07-09T12:30:00.000Z', // Thu Jul 9, 1:30 PM BST (Centre Court session start)
    location: 'All England Lawn Tennis Club — Centre Court, Church Road, Wimbledon, London SW19 5AE, UK',
    lat: 51.4336,
    lng: -0.2144,
    linkedLeague: 'Wimbledon',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'Marta Kostyuk', awayTeam: 'Linda Nosková', isNeutral: true },
  },
  // ── Wimbledon 2026 — Men's Semifinal 1 (created 2026-07-09) ──────────────────────
  {
    title: "Wimbledon Men's Semifinal: Sinner vs Djokovic",
    description:
      'Defending champion and World No. 1 Jannik Sinner faces seven-time champion Novak Djokovic, who survived a 5-hour, 15-minute epic over Félix Auger-Aliassime in the quarterfinal. First Centre Court match of the day.',
    eventType: 'game',
    dateUtc: '2026-07-10T12:30:00.000Z', // Fri Jul 10, 1:30 PM BST (Centre Court session start)
    location: 'All England Lawn Tennis Club — Centre Court, Church Road, Wimbledon, London SW19 5AE, UK',
    lat: 51.4336,
    lng: -0.2144,
    linkedLeague: 'Wimbledon',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'Jannik Sinner', awayTeam: 'Novak Djokovic', isNeutral: true },
  },
  // ── Wimbledon 2026 — Men's Semifinal 2 (created 2026-07-09) ──────────────────────
  {
    title: "Wimbledon Men's Semifinal: Zverev vs Fery",
    description:
      "Roland Garros champion Alexander Zverev takes on British wildcard Arthur Fery. The day's second Centre Court match, following Sinner vs Djokovic — exact start time depends on how the first match runs.",
    eventType: 'game',
    dateUtc: '2026-07-10T14:30:00.000Z', // Fri Jul 10, ~3:30 PM BST (second match, approximate)
    location: 'All England Lawn Tennis Club — Centre Court, Church Road, Wimbledon, London SW19 5AE, UK',
    lat: 51.4336,
    lng: -0.2144,
    linkedLeague: 'Wimbledon',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'Alexander Zverev', awayTeam: 'Arthur Fery', isNeutral: true },
  },
  // ── Wimbledon 2026 — Ladies' Singles Final (created 2026-07-09) ──────────────────
  {
    title: "Wimbledon Ladies' Singles Final",
    description:
      "Karolína Muchová reached the final by beating Coco Gauff; her opponent is the winner of Thursday's Kostyuk–Nosková semifinal, still TBD. Reported start time varies by source (~2 PM BST) — check wimbledon.com closer to the date for the confirmed time.",
    eventType: 'game',
    dateUtc: '2026-07-11T13:00:00.000Z', // Sat Jul 11, ~2:00 PM BST (approximate, sources vary)
    location: 'All England Lawn Tennis Club — Centre Court, Church Road, Wimbledon, London SW19 5AE, UK',
    lat: 51.4336,
    lng: -0.2144,
    linkedLeague: 'Wimbledon',
    contactInfo: 'customerservice@varsityhub.app',
  },
  // ── Wimbledon 2026 — Gentlemen's Singles Final (created 2026-07-09) ──────────────
  {
    title: "Wimbledon Gentlemen's Singles Final",
    description:
      'Both finalists TBD until the Friday semifinals (Sinner/Djokovic, Zverev/Fery) conclude. Note: Carlos Alcaraz withdrew from the 2026 tournament due to a wrist injury and is not in contention.',
    eventType: 'game',
    dateUtc: '2026-07-12T15:00:00.000Z', // Sun Jul 12, 4:00 PM BST
    location: 'All England Lawn Tennis Club — Centre Court, Church Road, Wimbledon, London SW19 5AE, UK',
    lat: 51.4336,
    lng: -0.2144,
    linkedLeague: 'Wimbledon',
    contactInfo: 'customerservice@varsityhub.app',
  },
  // ── MLB — All-Star Game (created 2026-07-09) ──────────────────────────────────────
  {
    title: 'MLB All-Star Game',
    description:
      "The 2026 MLB All-Star Game in Philadelphia. Gates open 5:00 PM ET, FOX coverage begins 7:00 PM ET, first pitch 8:00 PM ET.",
    eventType: 'game',
    dateUtc: '2026-07-15T00:00:00.000Z', // Tue Jul 14, 8:00 PM EDT
    location: 'Citizens Bank Park, 1 Citizens Bank Way, Philadelphia, PA 19148',
    lat: 39.9035,
    lng: -75.1598,
    bannerUrl: 'https://images.unsplash.com/photo-k5BMRjswRek?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'MLB',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'National League', awayTeam: 'American League', isNeutral: true },
  },
  // ── WNBA — Liberty vs Lynx (created 2026-07-09) ───────────────────────────────────
  {
    title: 'New York Liberty vs Minnesota Lynx',
    description: 'WNBA regular season, nationally televised on ABC. Tip-off 1:00 PM ET.',
    eventType: 'game',
    dateUtc: '2026-07-11T17:00:00.000Z', // Sat Jul 11, 1:00 PM EDT
    location: 'Barclays Center, 620 Atlantic Ave, Brooklyn, NY 11217',
    lat: 40.682732,
    lng: -73.975876,
    bannerUrl: 'https://images.unsplash.com/photo-vQq-NTV-f4k?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'WNBA',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'New York Liberty', awayTeam: 'Minnesota Lynx', isNeutral: false },
  },
  // ── WNBA — Aces vs Mercury (created 2026-07-09) ───────────────────────────────────
  {
    title: 'Las Vegas Aces vs Phoenix Mercury',
    description: 'WNBA regular season, streaming on Peacock. Tip-off 6:00 PM ET / 3:00 PM PT.',
    eventType: 'game',
    dateUtc: '2026-07-11T22:00:00.000Z', // Sat Jul 11, 6:00 PM EDT
    location: 'Michelob ULTRA Arena, 3950 S Las Vegas Blvd, Las Vegas, NV 89119',
    lat: 36.090622,
    lng: -115.179115,
    linkedLeague: 'WNBA',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'Las Vegas Aces', awayTeam: 'Phoenix Mercury', isNeutral: false },
  },
  // ── WNBA — Fever at Aces (created 2026-07-09) ─────────────────────────────────────
  {
    title: 'Indiana Fever at Las Vegas Aces',
    description: 'WNBA regular season, nationally televised on NBC. Tip-off 9:00 PM ET / 6:00 PM PT.',
    eventType: 'game',
    dateUtc: '2026-07-13T01:00:00.000Z', // Sun Jul 12, 9:00 PM EDT
    location: 'Michelob ULTRA Arena, 3950 S Las Vegas Blvd, Las Vegas, NV 89119',
    lat: 36.090622,
    lng: -115.179115,
    linkedLeague: 'WNBA',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'Las Vegas Aces', awayTeam: 'Indiana Fever', isNeutral: false },
  },
  // ── UFC 329 — McGregor vs Holloway 2 (created 2026-07-09) ─────────────────────────
  {
    title: 'UFC 329: McGregor vs Holloway 2',
    description:
      "Headliner of UFC International Fight Week (Jul 9-12, Las Vegas). Former featherweight/lightweight champion Conor McGregor rematches former featherweight champion Max Holloway. Prelims 5:00 PM ET; main card 9:00 PM ET.",
    eventType: 'game',
    dateUtc: '2026-07-12T01:00:00.000Z', // Sat Jul 11, 9:00 PM EDT (main card)
    location: 'T-Mobile Arena, 3780 S Las Vegas Blvd, Las Vegas, NV 89158',
    lat: 36.102982,
    lng: -115.178726,
    linkedLeague: 'UFC',
    contactInfo: 'customerservice@varsityhub.app',
    game: { homeTeam: 'Conor McGregor', awayTeam: 'Max Holloway', isNeutral: true },
  },
  // ── EXAMPLE: championship game (fictional) — replace before a real run ─────
  {
    title: 'Harbor City Hawks vs Summit Storm — Championship Game 5',
    description:
      'Championship series, Game 5. The series returns home for a decisive matchup. Tip-off: 7:30 PM local time.',
    eventType: 'game',
    dateUtc: '2026-06-14T00:30:00.000Z',
    location: 'Harbor City Arena, Harbor City, OH',
    lat: 41.4965,
    lng: -81.6882,
    // Placeholder venue image — replace with a photo YOU own before a real run.
    bannerUrl: 'https://placehold.co/960x400?text=Venue+Photo',
    linkedLeague: 'Demo League',
    game: {
      homeTeam: 'Harbor City Hawks',
      awayTeam: 'Summit Storm',
      expectedAttendance: 5000,
      isNeutral: false,
      teamOrgName: 'LIME PRODUCTIONS',
    },
  },
  // ── EXAMPLE: championship game 6, if necessary (fictional) — replace me ────
  {
    title: 'Summit Storm vs Harbor City Hawks — Championship Game 6',
    description:
      'Championship series, Game 6 (if necessary). Tip-off: 8:30 PM local time.',
    eventType: 'game',
    dateUtc: '2026-06-17T00:30:00.000Z',
    location: 'Summit Pavilion, Summit City, CA',
    lat: 37.7680,
    lng: -122.3877,
    // Placeholder venue image — replace with a photo YOU own before a real run.
    bannerUrl: 'https://placehold.co/960x400?text=Venue+Photo',
    linkedLeague: 'Demo League',
    game: {
      homeTeam: 'Summit Storm',
      awayTeam: 'Harbor City Hawks',
      expectedAttendance: 6000,
      isNeutral: false,
      teamOrgName: 'LIME PRODUCTIONS',
    },
  },
  // ── NBA Finals 2026 — Game 4 (real event, created 2026-06-09) ─────────────
  {
    title: 'New York Knicks vs San Antonio Spurs — NBA Finals Game 4',
    description:
      '2026 NBA Finals, Game 4. The Knicks lead the series 2-1 after the Spurs took Game 3 at Madison Square Garden. Tip-off: 8:30 PM EDT on ABC.',
    eventType: 'game',
    dateUtc: '2026-06-11T00:30:00.000Z', // Wed Jun 10, 8:30 PM EDT
    location: 'Madison Square Garden, New York, NY',
    lat: 40.7505,
    lng: -73.9934,
    bannerUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Interior_of_Madison_Square_Garden_2024.png',
    linkedLeague: 'NBA',
    game: {
      homeTeam: 'New York Knicks',
      awayTeam: 'San Antonio Spurs',
      expectedAttendance: 19812,
      isNeutral: false,
      teamOrgName: 'LIME PRODUCTIONS', // org the existing Knicks team lives under
      // Spurs: team-colors monogram (official NBA logos are trademarked — not used)
      awayTeamLogoUrl:
        'https://ui-avatars.com/api/?name=San+Antonio+Spurs&length=3&background=0C0C0C&color=C4CED4&size=512&bold=true&format=png',
    },
  },
  // ── Fanatics Fest NYC 2026 — Day 1: Thursday, July 16 (created 2026-07-08) ───────
  {
    title: 'Fanatics Fest NYC 2026 — Day 1: Thursday, July 16',
    description:
      'Opening day of the four-day festival at the Javits Center, 1-8pm. Headliner: LeBron James & Tyrese Haliburton tape a live "Mind the Game" podcast episode on the Center Stage at 1:15pm (releases July 21 on YouTube/Prime Video) — James returns for a second day Friday. Also today: the Disney x NFL "Fan Draft" with commissioner Roger Goodell, the $2M multi-day Fanatics Games competition kicks off (Tom Brady, Rob Gronkowski, WWE stars), and athlete autograph signings begin (Aaron Judge, Tom Brady, Freddie Freeman, Jalen Brunson and more).',
    eventType: 'other',
    dateUtc: '2026-07-16T17:00:00.000Z', // Thu Jul 16, 1:00 PM EDT (doors)
    location: 'Javits Center, 429 11th Ave, New York, NY 10001',
    lat: 40.75687,
    lng: -74.001762,
    bannerUrl: 'https://images.unsplash.com/photo-Nx7o8JDB3o4?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'Fanatics Fest',
    contactInfo: 'customerservice@varsityhub.app',
    // Teamless game record — required for this to appear in the main feed's
    // "upcoming" section (Game.list()-only; see file header). No confirmed
    // attendance figure, so expectedAttendance is intentionally omitted.
    game: { isNeutral: true },
  },
  // ── Fanatics Fest NYC 2026 — Day 2: Friday, July 17 (created 2026-07-08) ─────────
  {
    title: 'Fanatics Fest NYC 2026 — Day 2: Friday, July 17',
    description:
      "Javits Center, 10am-7pm. Headliner: the official FIFA World Cup Final pre-match press conferences — both finalist teams take the Fanatics Fest stage days before Sunday's Final at MetLife Stadium (finalists and exact stage time still TBA as the knockout rounds continue). LeBron James makes his second and final festival appearance today. Fanatics Games competition and autograph signings continue.",
    eventType: 'other',
    dateUtc: '2026-07-17T14:00:00.000Z', // Fri Jul 17, 10:00 AM EDT (doors)
    location: 'Javits Center, 429 11th Ave, New York, NY 10001',
    lat: 40.75687,
    lng: -74.001762,
    bannerUrl: 'https://images.unsplash.com/photo-Nx7o8JDB3o4?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'Fanatics Fest',
    contactInfo: 'customerservice@varsityhub.app',
    game: { isNeutral: true },
  },
  // ── Fanatics Fest NYC 2026 — Day 3: Saturday, July 18 (created 2026-07-08) ───────
  {
    title: 'Fanatics Fest NYC 2026 — Day 3: Saturday, July 18',
    description:
      'Javits Center, 10am-7pm. Headliner: WWE takes over the weekend — Roman Reigns, Cody Rhodes, John Cena, Rhea Ripley, Liv Morgan and Jey Uso compete in the Fanatics Games, with Cody Rhodes, Rhea Ripley, IYO SKY, Randy Orton, Charlotte Flair, Bianca Belair and more on-site for signings. The same night, WWE\'s "Saturday Night\'s Main Event" airs live from Madison Square Garden — a separate ticketed WWE show elsewhere in NYC, not part of Fanatics Fest itself, but timed to the same weekend. Exclusive Topps Chrome x Cactus Jack releases continue at the Topps booth.',
    eventType: 'other',
    dateUtc: '2026-07-18T14:00:00.000Z', // Sat Jul 18, 10:00 AM EDT (doors)
    location: 'Javits Center, 429 11th Ave, New York, NY 10001',
    lat: 40.75687,
    lng: -74.001762,
    bannerUrl: 'https://images.unsplash.com/photo-Nx7o8JDB3o4?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'Fanatics Fest',
    contactInfo: 'customerservice@varsityhub.app',
    game: { isNeutral: true },
  },
  // ── Fanatics Fest NYC 2026 — Day 4: Sunday, July 19 (created 2026-07-08) ─────────
  {
    title: 'Fanatics Fest NYC 2026 — Day 4: Sunday, July 19',
    description:
      "Javits Center, 10am-5pm, closing day. Headliner: billed as NYC's largest indoor FIFA World Cup Final watch party, with pop-up bar viewing and a seated family theater option, running through the Final's kickoff at MetLife Stadium (finalists TBD). The multi-day, $2M Fanatics Games competition also wraps up during the festival's four days.",
    eventType: 'watch_party',
    dateUtc: '2026-07-19T14:00:00.000Z', // Sun Jul 19, 10:00 AM EDT (doors)
    location: 'Javits Center, 429 11th Ave, New York, NY 10001',
    lat: 40.75687,
    lng: -74.001762,
    bannerUrl: 'https://images.unsplash.com/photo-Nx7o8JDB3o4?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'Fanatics Fest',
    contactInfo: 'customerservice@varsityhub.app',
    game: { isNeutral: true },
  },
  // ── FIBA World Cup 2027 Qualifiers — Switzerland vs Serbia (created 2026-07-07) ──
  {
    title: 'Switzerland vs Serbia — FIBA World Cup 2027 Qualifiers',
    description:
      "FIBA Basketball World Cup 2027 European Qualifiers, First Round, Group C. Serbia won 97-73 behind captain Nikola Jokić's 22 points, 14 rebounds and 7 assists, clinching Second Round qualification.",
    eventType: 'game',
    dateUtc: '2026-07-02T18:00:00.000Z', // Thu Jul 2, 6:00 PM UTC / 8:00 PM CEST
    location: 'BCF Arena, Fribourg, Switzerland',
    lat: 46.81737,
    lng: 7.15554,
    linkedLeague: 'FIBA World Cup Qualifiers',
    game: {
      homeTeam: 'Switzerland',
      awayTeam: 'Serbia',
      isNeutral: false,
    },
  },
  // ── FIBA World Cup 2027 Qualifiers — Slovenia vs Sweden (created 2026-07-07) ─────
  {
    title: 'Slovenia vs Sweden — FIBA World Cup 2027 Qualifiers',
    description:
      "FIBA Basketball World Cup 2027 European Qualifiers, First Round, Group H decider. Sweden won 88-79 on Pelle Larsson's 31 points, advancing to the Second Round to face Finland, France and Hungary.",
    eventType: 'game',
    dateUtc: '2026-07-06T18:00:00.000Z', // Mon Jul 6, 8:00 PM CEST
    location: 'Arena Stožice, Ljubljana, Slovenia',
    lat: 46.0753,
    lng: 14.5195,
    linkedLeague: 'FIBA World Cup Qualifiers',
    game: {
      homeTeam: 'Slovenia',
      awayTeam: 'Sweden',
      isNeutral: false,
    },
  },
  // ── MLB — Yankees @ Rays (created 2026-07-06) ──────────────────────────────
  {
    title: 'New York Yankees at Tampa Bay Rays',
    description:
      'MLB regular season. Series opener at Tropicana Field — the Rays have taken four of five meetings from the Yankees this year. First pitch 6:40 PM ET.',
    eventType: 'game',
    dateUtc: '2026-07-06T22:40:00.000Z', // Mon Jul 6, 6:40 PM EDT
    location: 'Tropicana Field, St. Petersburg, FL',
    lat: 27.768284,
    lng: -82.653961,
    bannerUrl: 'https://images.unsplash.com/photo-n-WsL9yCmls?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'MLB',
    game: {
      homeTeam: 'Tampa Bay Rays',
      awayTeam: 'New York Yankees',
      isNeutral: false,
    },
  },
  // ── MLB — Brewers @ Cardinals (created 2026-07-06) ─────────────────────────
  {
    title: 'Milwaukee Brewers at St. Louis Cardinals',
    description:
      'MLB regular season. Tuesday doubleheader nightcap at Busch Stadium — a May 5 rainout makeup turns this into a rare five-game series. First pitch 6:45 PM CT.',
    eventType: 'game',
    dateUtc: '2026-07-07T23:45:00.000Z', // Tue Jul 7, 6:45 PM CDT (DH game 2)
    location: 'Busch Stadium, St. Louis, MO',
    lat: 38.62278,
    lng: -90.193329,
    bannerUrl: 'https://images.unsplash.com/photo-f4cqfNQOBkA?w=960&h=400&fit=crop&q=80',
    linkedLeague: 'MLB',
    game: {
      homeTeam: 'St. Louis Cardinals',
      awayTeam: 'Milwaukee Brewers',
      isNeutral: false,
    },
  },
  // ── MLB — Mariners @ Marlins (created 2026-07-06) ──────────────────────────
  {
    title: 'Seattle Mariners at Miami Marlins',
    description:
      "MLB regular season interleague series opener at loanDepot Park — the clubs' only meeting of 2026. First pitch 6:40 PM ET.",
    eventType: 'game',
    dateUtc: '2026-07-07T22:40:00.000Z', // Tue Jul 7, 6:40 PM EDT
    location: 'loanDepot Park, Miami, FL',
    lat: 25.778301,
    lng: -80.220352,
    linkedLeague: 'MLB',
    game: {
      homeTeam: 'Miami Marlins',
      awayTeam: 'Seattle Mariners',
      isNeutral: false,
    },
  },
  // ── EXAMPLE: standalone watch party (no game record) — replace me ─────────
  {
    title: 'Riverside Hawks Watch Party',
    description:
      'Join the Riverside Hawks community for a live watch party! Big screens, food trucks, and team giveaways.',
    eventType: 'watch_party',
    dateUtc: '2026-06-20T22:00:00.000Z', // 6:00 PM EDT
    location: '120 Main Street, Greenwich, CT 06830',
    lat: 41.0262,
    lng: -73.6282,
    // Placeholder venue image — replace with a photo YOU own of YOUR venue.
    bannerUrl: 'https://placehold.co/960x400?text=Venue+Photo',
    maxAttendees: 150,
    contactInfo: 'events@varsityhub.app',
  },
  // ── EXAMPLE: single game + linked event — replace me ──────────────────────
  {
    title: 'Northside Eagles vs Southpoint Wolves',
    description:
      'Friday night rivalry game under the lights. Concessions and spirit wear available at the gate.',
    eventType: 'game',
    dateUtc: '2026-06-19T23:00:00.000Z', // 7:00 PM EDT
    location: '750 Stadium Drive, Stamford, CT 06902',
    lat: 41.0534,
    lng: -73.5387,
    // Placeholder venue image — replace with a photo YOU own of YOUR venue.
    bannerUrl: 'https://placehold.co/960x400?text=Venue+Photo',
    game: {
      homeTeam: 'Northside Eagles',
      awayTeam: 'Southpoint Wolves',
      expectedAttendance: 2500,
      isNeutral: false,
    },
  },
];
