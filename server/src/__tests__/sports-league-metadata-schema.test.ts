import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SPORTS_LEAGUE_CATALOG } from '../lib/sportsLeagueCatalog.js';

const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
const migration = readFileSync(
  path.join(migrationsDir, '20260901190000_add_sports_league_metadata/migration.sql'),
  'utf8'
);
const allMigrations = readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql') || !name.includes('.'))
  .map(name => {
    const migrationPath = path.join(migrationsDir, name, 'migration.sql');
    try {
      return readFileSync(migrationPath, 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n');

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`model ${name} not found in schema.prisma`);
  return match[1];
}

describe('sports league metadata schema', () => {
  it('adds a nullable event link to data-driven league metadata', () => {
    const event = modelBlock('Event');

    expect(event).toMatch(/sports_league_id String\?/);
    expect(event).toMatch(/sportsLeague\s+SportsLeague\?/);
    expect(event).toMatch(/@@index\(\[sports_league_id\]\)/);
  });

  it('keeps league metadata external and non-claimable', () => {
    const league = modelBlock('SportsLeague');

    expect(league).toMatch(/slug\s+String\s+@unique/);
    expect(league).toMatch(/sport_slug\s+String/);
    expect(league).toMatch(/level\s+String/);
    expect(league).toMatch(/gender\s+String/);
    expect(league).not.toMatch(/owner|member|invite|approved_by/i);
  });

  it('seeds every currently supported schedule league in the migration', () => {
    for (const league of SPORTS_LEAGUE_CATALOG) {
      expect(allMigrations).toContain(`'${league.slug}'`);
    }
  });

  it('backfills existing external events from their linked pro team league', () => {
    expect(migration).toMatch(/UPDATE "Event" e/);
    expect(migration).toMatch(/JOIN "SportsLeague" sl ON sl\."slug" = pt\."league"::text/);
    expect(migration).toMatch(/e\."pro_external_ref" IS NOT NULL/);
  });
});
