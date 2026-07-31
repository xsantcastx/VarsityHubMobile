import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the sports taxonomy file from multiple possible locations.
 *
 * Mirrors the multi-path JSON loader pattern in planLimits.ts:
 * build copies shared/ to dist/shared/, Docker copies shared/ to /app/shared/.
 */
function resolveTaxonomyPath(): string {
  const cwd = process.cwd();
  const candidatePaths = [
    path.resolve(__dirname, '../../shared/sports-taxonomy.json'), // dist/lib -> dist/shared
    path.resolve(__dirname, '../../../shared/sports-taxonomy.json'), // dist/lib -> shared
    '/app/shared/sports-taxonomy.json',
    '/app/dist/shared/sports-taxonomy.json',
    path.resolve(cwd, 'shared/sports-taxonomy.json'),
    path.resolve(cwd, 'dist/shared/sports-taxonomy.json'),
    path.resolve(cwd, '../shared/sports-taxonomy.json'),
    path.resolve(__dirname, '../../../../shared/sports-taxonomy.json'),
    path.resolve(__dirname, '../../../../../shared/sports-taxonomy.json'),
  ];

  const uniquePaths = Array.from(new Set(candidatePaths));

  for (const candidatePath of uniquePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  const checkedPaths = uniquePaths.map(p => `  - ${p}`).join('\n');
  const diagnosticInfo = [
    `Current working directory: ${cwd}`,
    `Compiled file location: ${__dirname}`,
    `Checked paths:\n${checkedPaths}`,
  ].join('\n');

  throw new Error(`sports-taxonomy.json not found in any expected location.\n\n${diagnosticInfo}`);
}

type SportEntry = { slug: string; label: string };

const taxonomyPath = resolveTaxonomyPath();
const taxonomy = require(taxonomyPath) as { sports: SportEntry[] };

export const SPORTS: readonly SportEntry[] = taxonomy.sports;
export const SPORT_SLUGS: ReadonlySet<string> = new Set(taxonomy.sports.map(s => s.slug));

const LABEL_BY_SLUG = new Map(taxonomy.sports.map(s => [s.slug, s.label]));

// Free-text → slug aliases for legacy Team.sport values (lowercased keys).
const SPORT_ALIASES: Record<string, string> = {
  'track & field': 'track_field',
  'track and field': 'track_field',
  track: 'track_field',
  xc: 'cross_country',
  'cross country': 'cross_country',
  'swim & dive': 'swimming',
  'swim and dive': 'swimming',
  swim: 'swimming',
  'swimming & diving': 'swimming',
  hockey: 'ice_hockey',
  rowing: 'crew',
  cheer: 'cheerleading',
};

export function isCanonicalSport(slug: string): boolean {
  return SPORT_SLUGS.has(slug);
}

export function getSportLabel(slug: string): string {
  return LABEL_BY_SLUG.get(slug) ?? slug;
}

export function normalizeSportToSlug(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return null;
  const collapsed = raw.replace(/\s+/g, ' ');
  if (SPORT_SLUGS.has(collapsed)) return collapsed;
  const underscored = collapsed.replace(/[\s/-]+/g, '_').replace(/&/g, 'and');
  if (SPORT_SLUGS.has(underscored)) return underscored;
  if (SPORT_ALIASES[collapsed]) return SPORT_ALIASES[collapsed];
  const byLabel = taxonomy.sports.find(s => s.label.toLowerCase() === collapsed);
  return byLabel ? byLabel.slug : null;
}

/**
 * Stable program slug for a non-canonical ("Other") sport, keyed on the name so
 * two different custom sports in one org do NOT collapse into a single 'other'
 * program (unique constraint is (organization_id, sport)). The `custom:` prefix
 * guarantees no collision with a future canonical slug of the same word. A
 * blank name has nothing to key on, so it falls back to the shared 'other'.
 */
export function customSportSlug(name: string | null | undefined): string {
  const slug = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `custom:${slug}` : 'other';
}
