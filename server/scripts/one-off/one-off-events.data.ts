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
