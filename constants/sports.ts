/**
 * Canonical Sports Taxonomy (client)
 *
 * Single source of truth for the sports list, shared with the backend via
 * shared/sports-taxonomy.json. See server/src/lib/sportsTaxonomy.ts for the
 * server-side counterpart (slug validation + free-text normalization).
 */

import sportsTaxonomy from '../shared/sports-taxonomy.json';

export type SportOption = { slug: string; label: string };
export const SPORT_OPTIONS: SportOption[] = sportsTaxonomy.sports;
export const SPORT_LABELS: string[] = SPORT_OPTIONS.map(s => s.label);

/**
 * Sport slug → emoji, for compact UI (the map's sport filter chips).
 * Every taxonomy slug has an entry so a chip always has a glyph; `other`
 * falls back to a generic marker.
 */
export const SPORT_EMOJI: Record<string, string> = {
  baseball: '⚾',
  basketball: '🏀',
  cheerleading: '📣',
  crew: '🚣',
  cross_country: '🏃',
  dance: '🩰',
  esports: '🎮',
  field_hockey: '🏑',
  football: '🏈',
  golf: '⛳',
  gymnastics: '🤸',
  ice_hockey: '🏒',
  lacrosse: '🥍',
  mma: '🥊',
  soccer: '⚽',
  softball: '🥎',
  swimming: '🏊',
  tennis: '🎾',
  track_field: '🏃',
  volleyball: '🏐',
  wrestling: '🤼',
  other: '🏅',
};

const SPORT_LABEL_TO_SLUG: Record<string, string> = SPORT_OPTIONS.reduce(
  (acc, s) => {
    acc[s.label.toLowerCase()] = s.slug;
    acc[s.slug.toLowerCase()] = s.slug;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Normalize a free-text/label/slug sport value to a canonical slug.
 * `Team.sport` is a plain string, so incoming values vary ("Football",
 * "football", "Ice Hockey"). Returns null when it maps to nothing known.
 */
export function normalizeSportSlug(sport?: string | null): string | null {
  if (!sport) return null;
  const key = sport
    .trim()
    .toLowerCase()
    .replace(/[\s/&]+/g, '_')
    .replace(/_+/g, '_');
  if (SPORT_EMOJI[key]) return key;
  const direct = SPORT_LABEL_TO_SLUG[sport.trim().toLowerCase()];
  return direct ?? null;
}

/** Emoji for a sport value (label/slug/free-text), or null if unknown. */
export function sportEmoji(sport?: string | null): string | null {
  const slug = normalizeSportSlug(sport);
  return slug ? (SPORT_EMOJI[slug] ?? null) : null;
}
