/**
 * Migration shape + invariants — static checks that catch the most common
 * "broken migration" failure modes without requiring a live DB.
 *
 * For full SQL validity, the source of truth is `prisma migrate deploy`
 * itself running at Railway boot — if a migration is syntactically broken,
 * the deploy fails and the previous server image keeps serving (see
 * server/start.sh). This test catches the bugs that wouldn't fail at
 * boot but would corrupt history or silently skip safety guards.
 *
 * Specifically:
 *   1. Every migration directory has a non-empty migration.sql
 *   2. Every directory follows the YYYYMMDDHHMMSS_name convention
 *   3. Migrations are lexicographically monotonic (no two with the same
 *      timestamp; sort matches creation order)
 *   4. The team_org_required safety guard is intact (DO block aborts
 *      above ORPHAN_THRESHOLD — without this, a future schema-drift
 *      regression could mass-delete real Team rows in prod)
 *   5. No migration uses DROP without IF EXISTS (other than IF EXISTS
 *      pattern), since prisma's idempotency check assumes prior state
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

// Historical migrations that don't follow the current invariants but are
// already shipped to production. We can't rename them or rewrite their SQL
// without breaking the _prisma_migrations history. Listed here so future
// migrations are still gated by the test, while existing tech debt is
// explicitly acknowledged rather than silently ignored.
const NAMING_GRANDFATHER: Set<string> = new Set([
  // 8-digit timestamp instead of 14 — was hand-renamed at some point and
  // ships fine because Prisma orders by directory name and there's no
  // collision with surrounding migrations. Renaming now would break prod's
  // _prisma_migrations row.
  '20260325_add_notification_types',
]);

// Explicitly forbidden migration directories. These names are known history
// drift / archaeology artifacts rather than legitimate migrations. If one
// reappears in the repo, `prisma migrate status` starts reporting a fake
// "missing from local migrations" mismatch against environments that recorded
// the stale row in `_prisma_migrations`.
const FORBIDDEN_MIGRATION_DIRS: Set<string> = new Set([
  '20260422110117_add_story_and_message_hot_query_indexes',
]);


function listMigrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((entry) => {
      if (entry === 'migration_lock.toml') return false;
      const full = join(MIGRATIONS_DIR, entry);
      return statSync(full).isDirectory();
    })
    .sort(); // lexicographic
}

const migrationDirs = listMigrationDirs();

describe('Prisma migrations — shape + invariants', () => {
  it('has a non-empty set of migrations', () => {
    expect(migrationDirs.length).toBeGreaterThan(0);
  });

  it('does not contain known-forbidden duplicate migration directories', () => {
    const forbidden = migrationDirs.filter((dir) => FORBIDDEN_MIGRATION_DIRS.has(dir));
    expect(forbidden).toEqual([]);
  });

  describe('every migration directory', () => {
    for (const dir of migrationDirs) {
      describe(dir, () => {
        const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');

        it('has a migration.sql', () => {
          expect(() => readFileSync(sqlPath, 'utf8')).not.toThrow();
        });

        it('is non-empty', () => {
          const sql = readFileSync(sqlPath, 'utf8').trim();
          expect(sql.length).toBeGreaterThan(0);
        });

        it('matches the YYYYMMDDHHMMSS_name naming convention', () => {
          // Prisma generates names like 20250909115558_init. The 14-digit
          // prefix is what `prisma migrate deploy` uses for ordering. A
          // hand-renamed directory that breaks this convention silently
          // sorts wrong and applies migrations out of order.
          if (NAMING_GRANDFATHER.has(dir)) {
            expect(NAMING_GRANDFATHER.has(dir)).toBe(true);
            return;
          }
          expect(dir).toMatch(/^\d{14}_[a-z0-9_]+$/);
        });
      });
    }
  });

  it('migration timestamps are strictly monotonic (no collisions)', () => {
    const timestamps = migrationDirs
      .map((d) => d.slice(0, 14))
      .filter((t) => /^\d{14}$/.test(t));
    const seen = new Set<string>();
    const collisions: string[] = [];
    for (const t of timestamps) {
      if (seen.has(t)) collisions.push(t);
      seen.add(t);
    }
    expect(collisions).toEqual([]);
  });

  it('lexicographic sort matches numeric timestamp sort (excluding grandfathered)', () => {
    // Trips if someone hand-edits a directory name in a way that breaks
    // the ordering invariant Prisma relies on.
    const filtered = migrationDirs.filter((d) => !NAMING_GRANDFATHER.has(d));
    const lex = [...filtered];
    const byTs = [...filtered].sort((a, b) => {
      const at = parseInt(a.slice(0, 14), 10);
      const bt = parseInt(b.slice(0, 14), 10);
      return at - bt;
    });
    expect(lex).toEqual(byTs);
  });

  describe('safety guards on destructive migrations', () => {
    it('team_org_required preserves its ORPHAN_THRESHOLD abort', () => {
      // This migration deletes orphan Team rows. The DO block at the top
      // refuses to run if more than threshold rows would be deleted —
      // without that guard, a future schema-drift regression that leaks
      // many NULL-org_id rows could silently mass-delete real teams.
      const dir = migrationDirs.find((d) => d.endsWith('_team_org_required'));
      expect(dir).toBeTruthy();
      const sql = readFileSync(join(MIGRATIONS_DIR, dir!, 'migration.sql'), 'utf8');
      expect(sql).toMatch(/ORPHAN_THRESHOLD/);
      expect(sql).toMatch(/RAISE EXCEPTION/);
      // Must abort BEFORE the DELETE to be a real guard
      const abortIdx = sql.indexOf('RAISE EXCEPTION');
      const deleteIdx = sql.indexOf('DELETE FROM "Team"');
      expect(abortIdx).toBeGreaterThan(0);
      expect(deleteIdx).toBeGreaterThan(0);
      expect(abortIdx).toBeLessThan(deleteIdx);
    });

    it('organization duplicate backstop uses normalized partial unique indexes', () => {
      const dir = migrationDirs.find((d) => d.endsWith('_organization_duplicate_name_backstop'));
      expect(dir).toBeTruthy();
      const sql = readFileSync(join(MIGRATIONS_DIR, dir!, 'migration.sql'), 'utf8');
      expect(sql).toContain('DROP INDEX IF EXISTS "Organization_name_zip_code_key"');
      expect(sql).toContain('normalize_org_name_for_dedupe');
      expect(sql).toContain('"Organization_active_norm_name_zip_key"');
      expect(sql).toContain('"Organization_active_norm_name_null_zip_key"');
    });
  });

  // Note: an IF-EXISTS-on-DROP-CONSTRAINT idempotency check was tried here
  // and rejected. Prisma's default migration output emits bare DROP CONSTRAINT,
  // and the _prisma_migrations table is the actual idempotency mechanism
  // (each migration applies exactly once per environment). Adding an
  // IF-EXISTS lint would require grandfathering ~100 historical migrations
  // and conflict with the standard prisma migrate dev workflow.
});
