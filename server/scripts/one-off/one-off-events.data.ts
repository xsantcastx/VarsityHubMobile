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
   * Only for eventType 'game': also creates a Game record and links the event
   * to it (game pages, scores, polls). Omit for all other event types.
   */
  game?: {
    homeTeam: string;
    awayTeam: string;
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
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/1280px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg',
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
    // Example venue photo — replace with a picture of YOUR venue
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Toronto_BMO_Field_in_2024.jpg/1280px-Toronto_BMO_Field_in_2024.jpg',
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
    // Example venue photo — replace with a picture of YOUR venue
    bannerUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/SoFi_Stadium_2023.jpg/1280px-SoFi_Stadium_2023.jpg',
    game: {
      homeTeam: 'Northside Eagles',
      awayTeam: 'Southpoint Wolves',
      expectedAttendance: 2500,
      isNeutral: false,
    },
  },
];
