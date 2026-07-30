#!/usr/bin/env npx tsx
/**
 * verify-backup-freshness.ts
 *
 * The runnable version of docs/runbooks/P0_DATABASE_BACKUP_AND_RESTORE_DRILL.md.
 * Proves the disaster-recovery backup is REAL and CURRENT rather than "hope":
 * the `db-backup-sync` scheduler job (every 6h) replicates the primary Postgres
 * into the backup instance (DATABASE_BACKUP_URL), and this drill connects to
 * BOTH and compares them table-by-table.
 *
 * The pass/fail definition lives in ../src/lib/backupFreshness.ts — the SAME
 * logic the `db-backup-freshness-check` scheduler job uses to alert Sentry when
 * the sync silently stops between drills. This script is a thin CLI over it.
 *
 * A replica backup is "restorable" iff you can connect to it and it holds
 * complete, current data. Because the sync runs every 6h, the backup is EXPECTED
 * to trail the primary by a handful of recent rows between runs — that is not a
 * failure. A failure is a missing table, an unreachable backup, or an aggregate
 * row deficit past the drift budget (default 10%, override BACKUP_MAX_DRIFT_PCT).
 *
 * Run (local, against prod public proxies):
 *   cd server
 *   DATABASE_URL="<Postgres-TnGR DATABASE_PUBLIC_URL>" \
 *   DATABASE_BACKUP_URL="<Postgres DATABASE_PUBLIC_URL>" \
 *   npm run verify:backup-freshness
 *
 * Or inside Railway (internal hostnames resolve there):
 *   railway run --service api npm run verify:backup-freshness
 *
 * Exit 0 = backup is current and complete. Exit 1 = not configured, unreachable,
 * a table is missing, or the backup is stale/broken beyond the drift budget.
 */

import 'dotenv/config';
import { checkBackupFreshness } from '../src/lib/backupFreshness.js';
import { TABLES_IN_ORDER } from '../src/lib/dbBackupTables.js';

async function main() {
  // The drill treats "not configured" as a HARD failure — running the drill is
  // an explicit request to prove a backup exists, so a missing/degenerate
  // DATABASE_BACKUP_URL must fail loudly (unlike the scheduler job, which skips).
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set — cannot reach the primary database.');
    process.exit(1);
  }
  if (!process.env.DATABASE_BACKUP_URL) {
    console.error('❌ DATABASE_BACKUP_URL is not set.');
    console.error('   The db-backup-sync job silently skips when this is missing, which means');
    console.error('   there is NO disaster-recovery backup. Set it on the Railway `api` service.');
    process.exit(1);
  }
  if (process.env.DATABASE_URL === process.env.DATABASE_BACKUP_URL) {
    console.error('❌ DATABASE_URL and DATABASE_BACKUP_URL point at the SAME database.');
    console.error('   A backup that is the primary is not a backup.');
    process.exit(1);
  }

  const result = await checkBackupFreshness();

  // Connectivity failures come back with an empty perTable and ok:false.
  if (result.perTable.length === 0 && !result.ok) {
    console.error(`❌ ${result.reason}`);
    process.exit(1);
  }

  console.log('Table                              primary     backup       delta');
  console.log('────────────────────────────────────────────────────────────────');
  for (const { table, primary, backup } of result.perTable) {
    if (backup === null) {
      console.log(`${table.padEnd(34)} ${String(primary).padStart(7)}   ${'MISSING'.padStart(8)}`);
      continue;
    }
    const delta = primary - backup;
    const flag = delta > 0 ? '  ⏳' : delta < 0 ? '  ⚠️ ahead' : '';
    console.log(
      `${table.padEnd(34)} ${String(primary).padStart(7)}   ${String(backup).padStart(8)}   ${String(-delta).padStart(9)}${flag}`
    );
  }
  console.log('────────────────────────────────────────────────────────────────');
  console.log(
    `${'TOTAL'.padEnd(34)} ${String(result.primaryTotal).padStart(7)}   ${String(result.backupTotal).padStart(8)}`
  );
  console.log('');

  if (!result.ok) {
    console.error(`❌ ${result.reason}`);
    if (result.missing.length === 0) {
      console.error('   The sync has likely stopped or is erroring mid-run. Check the scheduler');
      console.error('   worker and the most recent `[Scheduler] DB backup sync` log line.');
    }
    process.exit(1);
  }

  console.log(`✅ ${result.reason}`);
  console.log(
    `   ${TABLES_IN_ORDER.length} tables verified. Backup is reachable, complete, and restorable.`
  );
  process.exit(0);
}

main().catch(e => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
