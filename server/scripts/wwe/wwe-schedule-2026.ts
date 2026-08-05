/**
 * WWE schedule — curated from the official wwe.com/events listing (pulled
 * 2026-08-05). WWE is a touring promotion: every show is a standalone Event
 * pinned to the single "WWE" ProTeam (external_ref `wwe:wwe`), carrying its own
 * venue. Source of truth for the WWE half of the pro-schedule ingest via the
 * jsonFileAdapter — kept as a checked-in fixture (not a live scrape) because
 * wwe.com is a JS app with no stable public schedule API and the free
 * TheSportsDB key returns only the single next event.
 *
 * Start times: wwe.com lists dates, not always exact bells. We use each show's
 * conventional local start and encode it as the venue-local evening; the
 * events startup geocode-backfill fills coordinates from venue_name/address.
 *
 * Regenerate the JSON the ingest reads:
 *   npx tsx server/scripts/wwe/wwe-schedule-2026.ts > server/scripts/wwe/wwe-schedule-2026.json
 */

type WweShow = {
  /** Provider-stable id → external_ref `wwe:<id>`. Drives ingest idempotency. */
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local start time HH:mm (24h) in the venue's timezone. */
  time: string;
  /** IANA timezone of the venue. */
  tz: string;
  /** Display title of the event page. */
  title: string;
  venue: string;
  /** "City, ST" or "City, Country". */
  city: string;
};

// Chronological, from wwe.com/events (2026-08-05 snapshot). SummerSlam (Aug 1-2)
// already passed and is omitted.
const SHOWS: WweShow[] = [
  { id: '2026-08-06-fairfax', date: '2026-08-06', time: '19:30', tz: 'America/New_York', title: 'WWE Summer Tour — Fairfax', venue: 'EagleBank Arena', city: 'Fairfax, VA' },
  { id: '2026-08-07-philadelphia', date: '2026-08-07', time: '19:45', tz: 'America/New_York', title: 'WWE Friday Night SmackDown — Philadelphia', venue: 'Xfinity Mobile Arena', city: 'Philadelphia, PA' },
  { id: '2026-08-10-norfolk', date: '2026-08-10', time: '19:30', tz: 'America/New_York', title: 'WWE Monday Night RAW — Norfolk', venue: 'Scope Arena', city: 'Norfolk, VA' },
  { id: '2026-08-13-manchester', date: '2026-08-13', time: '19:30', tz: 'America/New_York', title: 'WWE Summer Tour — Manchester', venue: 'SNHU Arena', city: 'Manchester, NH' },
  { id: '2026-08-13-poughkeepsie-nxt', date: '2026-08-13', time: '19:00', tz: 'America/New_York', title: 'WWE NXT Live — Poughkeepsie', venue: 'Majed J. Nesheiwat Convention Center', city: 'Poughkeepsie, NY' },
  { id: '2026-08-14-boston', date: '2026-08-14', time: '19:45', tz: 'America/New_York', title: 'WWE Friday Night SmackDown — Boston', venue: 'TD Garden', city: 'Boston, MA' },
  { id: '2026-08-14-salisbury-nxt', date: '2026-08-14', time: '19:00', tz: 'America/New_York', title: 'WWE NXT Live — Salisbury', venue: 'Wicomico Youth & Civic Center', city: 'Salisbury, MD' },
  { id: '2026-08-15-petersburg-nxt', date: '2026-08-15', time: '19:00', tz: 'America/New_York', title: 'WWE NXT Live — Petersburg', venue: 'VSU Multipurpose Center', city: 'Petersburg, VA' },
  { id: '2026-08-17-buffalo', date: '2026-08-17', time: '19:30', tz: 'America/New_York', title: 'WWE Monday Night RAW — Buffalo', venue: 'KeyBank Center', city: 'Buffalo, NY' },
  { id: '2026-08-20-london-on', date: '2026-08-20', time: '19:30', tz: 'America/Toronto', title: 'WWE Summer Tour — London', venue: 'Canada Life Place', city: 'London, ON' },
  { id: '2026-08-21-toronto', date: '2026-08-21', time: '19:45', tz: 'America/Toronto', title: 'WWE Friday Night SmackDown — Toronto', venue: 'Scotiabank Arena', city: 'Toronto, ON' },
  { id: '2026-08-22-edmonton', date: '2026-08-22', time: '19:30', tz: 'America/Edmonton', title: 'WWE Summer Tour — Edmonton', venue: 'Rogers Place', city: 'Edmonton, AB' },
  { id: '2026-08-23-calgary', date: '2026-08-23', time: '19:30', tz: 'America/Edmonton', title: 'WWE Summer Tour — Calgary', venue: 'Scotiabank Saddledome', city: 'Calgary, AB' },
  { id: '2026-08-24-ottawa', date: '2026-08-24', time: '19:30', tz: 'America/Toronto', title: 'WWE Monday Night RAW & SmackDown — Ottawa', venue: 'Canadian Tire Centre', city: 'Ottawa, ON' },
  { id: '2026-08-28-cleveland', date: '2026-08-28', time: '19:30', tz: 'America/New_York', title: 'WWE RAW & Friday Night SmackDown — Cleveland', venue: 'Rocket Arena', city: 'Cleveland, OH' },
  { id: '2026-08-29-savannah', date: '2026-08-29', time: '19:30', tz: 'America/New_York', title: 'WWE Summer Tour — Savannah', venue: 'Enmarket Arena', city: 'Savannah, GA' },
  { id: '2026-08-30-north-charleston', date: '2026-08-30', time: '19:00', tz: 'America/New_York', title: 'WWE Summer Tour — North Charleston', venue: 'North Charleston Coliseum', city: 'North Charleston, SC' },
  { id: '2026-09-06-atlanta-sme', date: '2026-09-06', time: '20:00', tz: 'America/New_York', title: "WWE Saturday Night's Main Event — Atlanta", venue: 'State Farm Arena', city: 'Atlanta, GA' },
  { id: '2026-09-07-birmingham', date: '2026-09-07', time: '19:30', tz: 'America/Chicago', title: 'WWE Monday Night RAW — Birmingham', venue: 'Legacy Arena', city: 'Birmingham, AL' },
  { id: '2026-09-11-mexico-city-sd', date: '2026-09-11', time: '19:00', tz: 'America/Mexico_City', title: 'WWE Friday Night SmackDown — Mexico City', venue: 'Arena CDMX', city: 'Mexico City, MEX' },
  { id: '2026-09-14-mexico-city-raw', date: '2026-09-14', time: '19:00', tz: 'America/Mexico_City', title: 'WWE Monday Night RAW — Mexico City', venue: 'Arena CDMX', city: 'Mexico City, MEX' },
  { id: '2026-09-18-corpus-christi', date: '2026-09-18', time: '19:00', tz: 'America/Chicago', title: 'WWE Friday Night SmackDown — Corpus Christi', venue: 'American Bank Center', city: 'Corpus Christi, TX' },
  { id: '2026-09-21-san-antonio', date: '2026-09-21', time: '19:30', tz: 'America/Chicago', title: 'WWE Monday Night RAW — San Antonio', venue: 'Frost Bank Center', city: 'San Antonio, TX' },
  { id: '2026-09-25-indianapolis', date: '2026-09-25', time: '19:45', tz: 'America/Indiana/Indianapolis', title: 'WWE Friday Night SmackDown — Indianapolis', venue: 'Gainbridge Fieldhouse', city: 'Indianapolis, IN' },
  { id: '2026-09-28-milwaukee', date: '2026-09-28', time: '19:30', tz: 'America/Chicago', title: 'WWE Monday Night RAW — Milwaukee', venue: 'Fiserv Forum', city: 'Milwaukee, WI' },
  { id: '2026-10-02-denver', date: '2026-10-02', time: '19:45', tz: 'America/Denver', title: 'WWE Friday Night SmackDown — Denver', venue: 'Ball Arena', city: 'Denver, CO' },
  { id: '2026-10-05-st-louis', date: '2026-10-05', time: '19:30', tz: 'America/Chicago', title: 'WWE Monday Night RAW — St. Louis', venue: 'Enterprise Center', city: 'St. Louis, MO' },
  { id: '2026-10-09-lafayette', date: '2026-10-09', time: '19:00', tz: 'America/Chicago', title: 'WWE Friday Night SmackDown — Lafayette', venue: 'Cajundome', city: 'Lafayette, LA' },
  { id: '2026-10-10-new-orleans-mitb', date: '2026-10-10', time: '18:00', tz: 'America/Chicago', title: 'WWE Money in the Bank — New Orleans', venue: 'Smoothie King Center', city: 'New Orleans, LA' },
  { id: '2026-10-12-bossier-city', date: '2026-10-12', time: '19:30', tz: 'America/Chicago', title: 'WWE Monday Night RAW — Bossier City', venue: 'Brookshire Grocery Arena', city: 'Bossier City, LA' },
  { id: '2026-10-16-sacramento', date: '2026-10-16', time: '19:45', tz: 'America/Los_Angeles', title: 'WWE Friday Night SmackDown — Sacramento', venue: 'Golden 1 Center', city: 'Sacramento, CA' },
  { id: '2026-10-19-san-diego', date: '2026-10-19', time: '19:30', tz: 'America/Los_Angeles', title: 'WWE Monday Night RAW — San Diego', venue: 'Pechanga Arena', city: 'San Diego, CA' },
  { id: '2026-10-23-ontario', date: '2026-10-23', time: '19:45', tz: 'America/Los_Angeles', title: 'WWE Friday Night SmackDown — Ontario', venue: 'Toyota Arena', city: 'Ontario, CA' },
  { id: '2026-10-26-fresno', date: '2026-10-26', time: '19:30', tz: 'America/Los_Angeles', title: 'WWE Monday Night RAW — Fresno', venue: 'Save Mart Center', city: 'Fresno, CA' },
  { id: '2026-10-30-charleston-wv', date: '2026-10-30', time: '19:00', tz: 'America/New_York', title: 'WWE Friday Night SmackDown — Charleston', venue: 'Charleston Coliseum', city: 'Charleston, WV' },
  { id: '2026-11-02-brooklyn', date: '2026-11-02', time: '19:30', tz: 'America/New_York', title: 'WWE Monday Night RAW — Brooklyn', venue: 'Barclays Center', city: 'Brooklyn, NY' },
  { id: '2026-11-28-houston-survivor-series', date: '2026-11-28', time: '18:30', tz: 'America/Chicago', title: 'WWE Survivor Series: WarGames — Houston', venue: 'Daikin Park', city: 'Houston, TX' },
];

/** Convert a local date+time in an IANA tz to a UTC ISO instant. */
function localToUtcIso(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  // Find the UTC instant whose wall-clock in `tz` equals the given local time.
  // Start from the naive UTC guess and correct by the tz offset at that instant.
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const asUtc = new Date(naive);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(asUtc).map(p => [p.type, p.value]));
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute)
  );
  const offset = wall - naive; // ms the tz is ahead of UTC at that instant
  return new Date(naive - offset).toISOString();
}

export const WWE_FIXTURES = SHOWS.map(s => ({
  external_ref: `wwe:${s.id}`,
  league: 'wwe' as const,
  starts_at: localToUtcIso(s.date, s.time, s.tz),
  home_team_ref: null,
  away_team_ref: null,
  title: s.title,
  venue_name: s.venue,
  venue_address: `${s.venue}, ${s.city}`,
  timezone: s.tz,
  status: 'scheduled' as const,
}));

// `npx tsx wwe-schedule-2026.ts` prints the fixture JSON for the ingest.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(WWE_FIXTURES, null, 2) + '\n');
}
