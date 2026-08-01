/**
 * Reserved username blocklist.
 *
 * Two jobs:
 *
 * 1. Platform identities — nobody but us gets @varsityhub, @admin, @support.
 *    A handle that looks like staff is a phishing primitive.
 *
 * 2. Professional franchise impersonation — @newyorkyankees or @nfl on a social
 *    product reads as an identity claim, which is the one prong of nominative
 *    fair use (New Kids on the Block v. News America) that a handle cannot
 *    satisfy. VarsityHub itself never mints these handles: pro teams are
 *    ProTeam rows with no presence in the @username namespace at all. This
 *    blocklist closes the other half — a fan squatting the handle instead.
 *
 * SCOPE, deliberately chosen (see the design spec):
 *
 * Reserved:  full "city + nickname" forms (newyorkyankees, losangeleslakers),
 *            their multi-word-city initial forms (nyyankees, lalakers,
 *            sfgiants), league names, and a curated set of nicknames that are
 *            overwhelmingly franchise-identifying on their own.
 *
 * NOT reserved: bare nicknames that are ordinary English words — heat, magic,
 *            storm, dream, sky, sun, kings, giants, thunder, jazz, fire. Those
 *            are words before they are marks, blocking them would deny handles
 *            to real users with no impersonation risk, and "@storm" does not
 *            assert affiliation the way "@seattlestorm" does. If a specific
 *            bare nickname turns into an actual problem, add it to
 *            DISTINCTIVE_NICKNAMES — that is the tuning knob.
 *
 * Comparison is normalization-insensitive: dots and underscores are stripped
 * before matching, so ny_yankees and n.y.yankees are both caught.
 */

import { PRO_TEAM_SEED } from './proTeams.js';

/** Lowercase and strip everything that is not a letter or digit. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const PLATFORM_RESERVED = [
  'varsityhub',
  'varsity',
  'varsityhubapp',
  'varsityhubofficial',
  'admin',
  'administrator',
  'moderator',
  'mod',
  'support',
  'help',
  'helpdesk',
  'staff',
  'team',
  'official',
  'security',
  'billing',
  'payments',
  'noreply',
  'no-reply',
  'postmaster',
  'webmaster',
  'root',
  'system',
  'api',
  'null',
  'undefined',
  'me',
  'you',
  'everyone',
  'all',
];

const LEAGUE_RESERVED = [
  'nfl',
  'nba',
  'wnba',
  'mlb',
  'wwe',
  'nationalfootballleague',
  'nationalbasketballassociation',
  'majorleaguebaseball',
  'worldwrestlingentertainment',
  // Adjacent leagues we do not carry yet but which are equally squattable.
  'nhl',
  'mls',
  'ncaa',
];

/**
 * Nicknames distinctive enough that the bare word identifies the franchise.
 * Kept short and hand-picked on purpose — every entry here is a handle a real
 * user can no longer have, so the bar is "this word is essentially only ever
 * the team".
 */
const DISTINCTIVE_NICKNAMES = [
  'yankees',
  'dodgers',
  'lakers',
  'celtics',
  'knicks',
  'steelers',
  'packers',
  'seahawks',
  '49ers',
  'buccaneers',
  'bengals',
  'jaguars',
  'mavericks',
  'timberwolves',
  'grizzlies',
  'clippers',
  'raptors',
  '76ers',
  'cavaliers',
  'nuggets',
  'pelicans',
  'canucks',
  'diamondbacks',
  'phillies',
  'astros',
  'mariners',
  'orioles',
  'guardians',
  'brewers',
  'padres',
  'redsox',
  'whitesox',
  'bluejays',
  'valkyries',
  'mystics',
  'liberty',
  'seahawk',
  'commanders',
  'bronco',
  'broncos',
  'chargers',
  'raiders',
  'buffalobills',
];

/** Two-or-more-word market -> initials, e.g. "New York" -> "ny". Shorter
 *  markets return null (a single initial is meaningless as a handle prefix). */
function marketInitials(market: string): string | null {
  const words = market.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  return words
    .map(w => w[0])
    .join('')
    .toLowerCase();
}

/**
 * The market portion of a team name — "New York Yankees" -> "New York".
 *
 * Derived from the name rather than the `city` column on purpose: several
 * franchises are seeded with their borough or suburb (Yankees/Bronx,
 * Mets/Queens, Braves/Cumberland), so the city column would miss exactly the
 * handles most worth reserving. The name always carries the market the public
 * uses.
 */
function marketFromName(name: string, shortName: string): string | null {
  const lowerName = name.toLowerCase();
  const lowerShort = shortName.toLowerCase();
  if (!lowerName.endsWith(lowerShort)) return null;
  const market = name.slice(0, name.length - shortName.length).trim();
  return market.length > 0 ? market : null;
}

function buildProTeamReserved(): Set<string> {
  const out = new Set<string>();

  for (const team of PRO_TEAM_SEED) {
    const full = normalizeUsername(team.name);
    if (full.length >= 3) out.add(full);

    const nickname = normalizeUsername(team.short_name);

    // "{market initials}{nickname}" — nyyankees, lalakers, sfgiants. These are
    // the handles a squatter actually reaches for.
    const market = marketFromName(team.name, team.short_name);
    if (market && nickname.length >= 3) {
      const initials = marketInitials(market);
      if (initials) out.add(`${initials}${nickname}`);
    }

    // "{city}{nickname}" too, which covers the cases where the seeded city
    // differs from the market in the name (Athletics -> westsacramentoathletics).
    if (team.city) {
      const withCity = normalizeUsername(`${team.city}${team.short_name}`);
      if (withCity.length >= 3) out.add(withCity);

      const cityInit = marketInitials(team.city);
      if (cityInit && nickname.length >= 3) out.add(`${cityInit}${nickname}`);
    }
  }

  return out;
}

const RESERVED: Set<string> = (() => {
  const set = new Set<string>();
  for (const w of PLATFORM_RESERVED) set.add(normalizeUsername(w));
  for (const w of LEAGUE_RESERVED) set.add(normalizeUsername(w));
  for (const w of DISTINCTIVE_NICKNAMES) set.add(normalizeUsername(w));
  for (const w of buildProTeamReserved()) set.add(w);
  set.delete('');
  return set;
})();

/** True when the handle is reserved and must not be granted to a user. */
export function isReservedUsername(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return RESERVED.has(normalizeUsername(raw));
}

export const RESERVED_USERNAME_MESSAGE =
  'That username is reserved and cannot be used. Please choose another.';

/** Exposed for tests and for auditing what the blocklist actually covers. */
export function reservedUsernamesForTest(): ReadonlySet<string> {
  return RESERVED;
}
