/**
 * backupFreshness — the ONE source of truth for "is the DR backup current?".
 *
 * The `db-backup-sync` scheduler job (every 6h) replicates the primary Postgres
 * into the backup instance (DATABASE_BACKUP_URL). This module connects to BOTH
 * and compares them table-by-table, computing the aggregate row drift. It is the
 * shared core behind two callers:
 *   - the runnable drill (`scripts/verify-backup-freshness.ts`, on-demand / CI), and
 *   - the `db-backup-freshness-check` scheduler job, which captures to Sentry when
 *     the backup falls behind — so a SILENTLY stopped sync is noticed between drills.
 *
 * Both share this logic so the pass/fail definition can never drift between them.
 *
 * A backup is EXPECTED to trail the primary by a handful of recent rows between
 * 6-hourly syncs — that is not a failure. A failure is a missing table, an
 * unreachable backup, or an aggregate row deficit past the drift budget
 * (default 10%, override with BACKUP_MAX_DRIFT_PCT) — the signature of a sync
 * that has silently stopped or is erroring mid-run.
 */
import { PrismaClient } from '@prisma/client';
import { TABLES_IN_ORDER } from './dbBackupTables.js';

export const DEFAULT_MAX_DRIFT_PCT = Number(process.env.BACKUP_MAX_DRIFT_PCT ?? '10');

export type PerTableCount = { table: string; primary: number; backup: number | null };

export type BackupFreshnessResult = {
  /** false when DATABASE_BACKUP_URL is unset or equals the primary — a clean skip, not a failure. */
  configured: boolean;
  /** true when the backup is reachable, complete, and within the drift budget. */
  ok: boolean;
  /** Human-readable pass/fail summary (also used as the Sentry message when !ok). */
  reason: string;
  perTable: PerTableCount[];
  missing: string[];
  primaryTotal: number;
  backupTotal: number;
  deficit: number;
  driftPct: number;
  maxDriftPct: number;
};

/**
 * Pure verdict over already-counted tables — the single place the pass/fail
 * definition lives. `backup: null` in a row means the table is missing from the
 * backup. Exported so it can be unit-tested without a database.
 */
export function evaluateFreshness(
  perTable: PerTableCount[],
  maxDriftPct: number = DEFAULT_MAX_DRIFT_PCT
): Omit<BackupFreshnessResult, 'configured'> {
  const missing = perTable.filter(r => r.backup === null).map(r => r.table);
  const primaryTotal = perTable.reduce((sum, r) => sum + r.primary, 0);
  const backupTotal = perTable.reduce((sum, r) => sum + (r.backup ?? 0), 0);
  const deficit = primaryTotal - backupTotal;
  const driftPct = primaryTotal === 0 ? 0 : (deficit / primaryTotal) * 100;
  const base = { perTable, missing, primaryTotal, backupTotal, deficit, driftPct, maxDriftPct };

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `${missing.length} table(s) missing from the backup: ${missing.join(', ')}`,
      ...base,
    };
  }
  if (driftPct > maxDriftPct) {
    return {
      ok: false,
      reason: `Backup is ${driftPct.toFixed(1)}% behind the primary (${deficit} rows), past the ${maxDriftPct}% budget — the sync has likely stopped or is erroring mid-run`,
      ...base,
    };
  }
  return {
    ok: true,
    reason:
      deficit > 0
        ? `Backup current within budget — trails by ${deficit} row(s) (${driftPct.toFixed(2)}%), expected between 6-hourly syncs`
        : 'Backup byte-for-byte current with the primary — 0 row drift',
    ...base,
  };
}

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

/**
 * Connect to the primary + backup and evaluate freshness. Never throws for the
 * "not configured" case (returns configured:false); a connectivity failure to
 * either database returns ok:false with a reason (it is a real DR failure). Only
 * unexpected, non-connectivity errors propagate.
 */
export async function checkBackupFreshness(
  opts: { maxDriftPct?: number } = {}
): Promise<BackupFreshnessResult> {
  const maxDriftPct = opts.maxDriftPct ?? DEFAULT_MAX_DRIFT_PCT;
  const primaryUrl = process.env.DATABASE_URL;
  const backupUrl = process.env.DATABASE_BACKUP_URL;

  const empty = {
    perTable: [] as PerTableCount[],
    missing: [] as string[],
    primaryTotal: 0,
    backupTotal: 0,
    deficit: 0,
    driftPct: 0,
    maxDriftPct,
  };

  if (!primaryUrl) {
    return { configured: false, ok: false, reason: 'DATABASE_URL is not set', ...empty };
  }
  // Not configured (silent skip) — the db-backup-sync job skips too, so there is
  // no backup to be stale. This is not an alert-worthy condition.
  if (!backupUrl) {
    return { configured: false, ok: true, reason: 'DATABASE_BACKUP_URL not configured', ...empty };
  }
  if (primaryUrl === backupUrl) {
    return {
      configured: false,
      ok: true,
      reason: 'DATABASE_BACKUP_URL equals DATABASE_URL (no separate backup)',
      ...empty,
    };
  }

  const primary = makeClient(primaryUrl);
  const backup = makeClient(backupUrl);
  try {
    try {
      await primary.$queryRaw`SELECT 1`;
    } catch (e: any) {
      return {
        configured: true,
        ok: false,
        reason: `Cannot connect to PRIMARY database: ${e?.message || e}`,
        ...empty,
      };
    }
    try {
      await backup.$queryRaw`SELECT 1`;
    } catch (e: any) {
      return {
        configured: true,
        ok: false,
        reason: `Backup is unreachable — cannot be restored from: ${e?.message || e}`,
        ...empty,
      };
    }

    const perTable: PerTableCount[] = [];
    for (const table of TABLES_IN_ORDER) {
      const p = await countTable(primary, table);
      let b: number | null;
      try {
        b = await countTable(backup, table);
      } catch {
        b = null; // table missing from the backup
      }
      perTable.push({ table, primary: p, backup: b });
    }

    return { configured: true, ...evaluateFreshness(perTable, maxDriftPct) };
  } finally {
    await primary.$disconnect().catch(err => {
      console.warn('[backup-freshness] failed to disconnect primary client', {
        reason: (err as Error)?.message || String(err),
      });
    });
    await backup.$disconnect().catch(err => {
      console.warn('[backup-freshness] failed to disconnect backup client', {
        reason: (err as Error)?.message || String(err),
      });
    });
  }
}
