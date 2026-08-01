import type { ProLeague } from '@prisma/client';
import { PRO_TEAM_SEED } from '../proTeams.js';

/**
 * Resolves a provider's team name to our canonical `ProTeam.external_ref`
 * (`{league}:{slug}`), or null when it maps to nothing seeded.
 *
 * The seed is the source of truth: a name only resolves if its slug matches a
 * seeded team in that league. An unknown name returns null so the ingester
 * quarantines the fixture rather than inventing a franchise (see resolveFixture
 * UNKNOWN_*). Team rosters were verified exact against the live provider for
 * NFL/NBA/WNBA/MLB on 2026-07-31; the alias table covers relocations/renames a
 * provider might still report under an old name.
 */

const KNOWN_REFS_BY_LEAGUE: Record<string, Set<string>> = (() => {
  const acc: Record<string, Set<string>> = {};
  for (const t of PRO_TEAM_SEED) {
    (acc[t.league] ??= new Set()).add(t.external_ref);
  }
  return acc;
})();

/** Provider names whose slug doesn't match our canonical ref, keyed by `{league}:{slug}`. */
const ALIASES: Record<string, string> = {
  'nfl:washington-football-team': 'nfl:washington-commanders',
  'nfl:washington-redskins': 'nfl:washington-commanders',
  'nfl:oakland-raiders': 'nfl:las-vegas-raiders',
  'nfl:san-diego-chargers': 'nfl:los-angeles-chargers',
  'nfl:st-louis-rams': 'nfl:los-angeles-rams',
};

export function slugifyTeam(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveProTeamRef(
  league: ProLeague,
  name: string | null | undefined
): string | null {
  if (!name) return null;
  const candidate = `${league}:${slugifyTeam(name)}`;
  if (ALIASES[candidate]) return ALIASES[candidate];
  return KNOWN_REFS_BY_LEAGUE[league]?.has(candidate) ? candidate : null;
}
