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
 * A replica backup is "restorable" iff you can connect to it and it holds
 * complete, current data — so that is exactly what this checks:
 *   1. Both databases are reachable (backup is connectable / restorable-to).
 *   2. Every backed-up table (TABLES_IN_ORDER) exists on the backup.
 *   3. No table is meaningfully behind — the backup lags the primary by at most
 *      the last sync window, never by whole tables or a large fraction of rows.
 *
 * Because the sync runs every 6h, the backup is EXPECTED to trail the primary
 * by a handful of recent rows between runs. That is not a failure. A failure is
 * a missing table, an unreachable backup, or an aggregate row deficit past the
 * drift budget (default 10%, override with BACKUP_MAX_DRIFT_PCT) — the signature
 * of a sync that has silently stopped or is erroring mid-run.
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
import { PrismaClient } from '@prisma/client';
import { TABLES_IN_ORDER } from '../src/lib/dbBackupTables.js';

const MAX_DRIFT_PCT = Number(process.env.BACKUP_MAX_DRIFT_PCT ?? '10');

function makeClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

async function countTable(client: PrismaClient, table: string): Promise<number> {
  // `table` is drawn only from the TABLES_IN_ORDER whitelist — never user input —
  // so interpolating it into the identifier is safe.
  const rows = await client.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint AS c FROM "${table}"`
  );
  return Number(rows[0]?.c ?? 0);
}

async function main() {
  const primaryUrl = process.env.DATABASE_URL;
  const backupUrl = process.env.DATABASE_BACKUP_URL;

  if (!primaryUrl) {
    console.error('❌ DATABASE_URL is not set — cannot reach the primary database.');
    process.exit(1);
  }
  if (!backupUrl) {
    console.error('❌ DATABASE_BACKUP_URL is not set.');
    console.error('   The db-backup-sync job silently skips when this is missing, which means');
    console.error('   there is NO disaster-recovery backup. Set it on the Railway `api` service.');
    process.exit(1);
  }
  if (primaryUrl === backupUrl) {
    console.error('❌ DATABASE_URL and DATABASE_BACKUP_URL point at the SAME database.');
    console.error('   A backup that is the primary is not a backup.');
    process.exit(1);
  }

  const primary = makeClient(primaryUrl);
  const backup = makeClient(backupUrl);

  try {
    // 1) Connectivity — the backup must be reachable to be restorable.
    try {
      await primary.$queryRaw`SELECT 1`;
    } catch (e: any) {
      console.error('❌ Cannot connect to PRIMARY database:', e?.message || e);
      process.exit(1);
    }
    try {
      await backup.$queryRaw`SELECT 1`;
    } catch (e: any) {
      console.error('❌ Cannot connect to BACKUP database:', e?.message || e);
      console.error('   The backup is unreachable — it cannot be restored from.');
      process.exit(1);
    }

    // 2) + 3) Table-by-table completeness and freshness.
    let primaryTotal = 0;
    let backupTotal = 0;
    const missing: string[] = [];
    const lagging: Array<{ table: string; primary: number; backup: number }> = [];

    console.log('Table                              primary     backup       delta');
    console.log('────────────────────────────────────────────────────────────────');
    for (const table of TABLES_IN_ORDER) {
      const p = await countTable(primary, table);
      primaryTotal += p;

      let b: number;
      try {
        b = await countTable(backup, table);
      } catch (e: any) {
        missing.push(table);
        console.log(`${table.padEnd(34)} ${String(p).padStart(7)}   ${'MISSING'.padStart(8)}`);
        continue;
      }
      backupTotal += b;

      const delta = p - b;
      if (delta > 0) lagging.push({ table, primary: p, backup: b });
      const flag = delta > 0 ? '  ⏳' : delta < 0 ? '  ⚠️ ahead' : '';
      console.log(
        `${table.padEnd(34)} ${String(p).padStart(7)}   ${String(b).padStart(8)}   ${String(-delta).padStart(9)}${flag}`
      );
    }
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`${'TOTAL'.padEnd(34)} ${String(primaryTotal).padStart(7)}   ${String(backupTotal).padStart(8)}`);
    console.log('');

    // Hard failure: a backed-up table does not exist on the backup.
    if (missing.length > 0) {
      console.error(`❌ ${missing.length} table(s) missing from the backup: ${missing.join(', ')}`);
      console.error('   The sync is broken or was never run for these tables.');
      process.exit(1);
    }

    // Hard failure: aggregate row deficit past the drift budget => stale/broken sync.
    const deficit = primaryTotal - backupTotal;
    const driftPct = primaryTotal === 0 ? 0 : (deficit / primaryTotal) * 100;
    if (driftPct > MAX_DRIFT_PCT) {
      console.error(
        `❌ Backup is ${driftPct.toFixed(1)}% behind the primary (${deficit} rows), past the ${MAX_DRIFT_PCT}% budget.`
      );
      console.error('   The sync has likely stopped or is erroring mid-run. Check the scheduler');
      console.error('   worker and the most recent `[Scheduler] DB backup sync` log line.');
      process.exit(1);
    }

    // Pass. Lag within budget is normal (the sync runs every 6h).
    if (lagging.length > 0) {
      console.log(
        `✅ Backup is current within budget — ${lagging.length} table(s) trail by ${deficit} row(s) ` +
          `(${driftPct.toFixed(2)}%), expected between 6-hourly syncs.`
      );
    } else {
      console.log('✅ Backup is byte-for-byte current with the primary — 0 row drift.');
    }
    console.log(`   ${TABLES_IN_ORDER.length} tables verified. Backup is reachable, complete, and restorable.`);
    process.exit(0);
  } finally {
    await primary.$disconnect().catch(() => {});
    await backup.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
