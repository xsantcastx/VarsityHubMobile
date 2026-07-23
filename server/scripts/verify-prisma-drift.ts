/**
 * Fails if prisma/schema.prisma and the committed migrations have drifted apart.
 *
 * Why this gate exists
 * --------------------
 * `start.sh` runs `prisma migrate deploy` on every Railway deploy, so any
 * committed migration auto-applies to production. Prisma generates a migration
 * from the *difference* between the migration history and schema.prisma — so on
 * a drifted tree, `prisma migrate dev` silently folds the entire accumulated
 * drift into whatever routine migration someone is writing.
 *
 * That is not hypothetical. As of 2026-07-23 the drift on main was 25 statements,
 * including 22 DROP INDEX for every search trigram index (search would have
 * degraded to sequential scans in production) plus two enum values that live
 * application code already writes. See:
 *   prisma/migrations/20260723180000_reconcile_schema_migration_drift/migration.sql
 *
 * How it works
 * ------------
 * `prisma migrate diff --from-migrations --to-schema-datamodel` replays the
 * committed migrations into a throwaway shadow database and diffs the result
 * against schema.prisma. A reconciled tree produces an empty migration.
 *
 * Requires a reachable Postgres (CI provides one as a service container).
 *
 * Caveat worth knowing when reading a failure: Prisma cannot represent PARTIAL
 * indexes, so it ignores them and will keep proposing a full-index CREATE for
 * any column whose only index is partial. If you add one via raw SQL, expect
 * this check to flag it, and reconcile deliberately rather than accepting a
 * generated migration.
 */
import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';

const SHADOW_DB = 'prisma_drift_shadow';

function baseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('[prisma-drift] DATABASE_URL is required (needs a reachable Postgres).');
    process.exit(1);
  }
  return new URL(raw);
}

function adminUrl(url: URL): string {
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';
  return admin.toString();
}

function shadowUrl(url: URL): string {
  const shadow = new URL(url.toString());
  shadow.pathname = `/${SHADOW_DB}`;
  return shadow.toString();
}

function psql(connection: string, sql: string) {
  execFileSync('psql', [connection, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

function main() {
  const url = baseUrl();
  const admin = adminUrl(url);

  // Recreate the shadow DB so a leftover from a previous run can't mask drift.
  try {
    psql(admin, `DROP DATABASE IF EXISTS "${SHADOW_DB}"`);
    psql(admin, `CREATE DATABASE "${SHADOW_DB}"`);
  } catch (err: any) {
    console.error('[prisma-drift] Could not prepare the shadow database.');
    console.error(err?.stderr?.toString() || err?.message || err);
    process.exit(1);
  }

  let diff: string;
  try {
    diff = execFileSync(
      'npx',
      [
        'prisma',
        'migrate',
        'diff',
        '--from-migrations',
        './prisma/migrations',
        '--to-schema-datamodel',
        './prisma/schema.prisma',
        '--shadow-database-url',
        shadowUrl(url),
        '--script',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err: any) {
    console.error('[prisma-drift] `prisma migrate diff` failed to run.');
    console.error(err?.stderr?.toString() || err?.message || err);
    process.exit(1);
  } finally {
    try {
      psql(admin, `DROP DATABASE IF EXISTS "${SHADOW_DB}"`);
    } catch {
      // Best-effort cleanup; the shadow DB is recreated on the next run anyway.
    }
  }

  // A reconciled tree yields only Prisma's "empty migration" marker.
  const statements = diff
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--'));

  if (statements.length === 0) {
    console.log('[prisma-drift] OK — schema.prisma and the migration history agree.');
    return;
  }

  console.error(
    `[prisma-drift] DRIFT DETECTED — ${statements.length} statement(s) separate the ` +
      'committed migrations from schema.prisma:\n'
  );
  console.error(diff.trim());
  console.error(
    '\n[prisma-drift] Do NOT run `prisma migrate dev` to resolve this — it will fold the\n' +
      'entire diff above into your migration, and `prisma migrate deploy` applies it to\n' +
      'production on the next Railway deploy. Reconcile deliberately: verify against the\n' +
      'production database what actually exists, then hand-write a migration (and/or\n' +
      'declare the missing objects in schema.prisma) so this check returns to empty.'
  );
  process.exit(1);
}

main();
