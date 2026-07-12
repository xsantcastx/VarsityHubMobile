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
