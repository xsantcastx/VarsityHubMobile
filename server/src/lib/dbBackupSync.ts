/**
 * Database Backup Sync
 *
 * Periodically replicates all data from the primary Postgres (Postgres-TnGR)
 * to the backup Postgres instance. Uses Prisma raw SQL to dump and restore
 * table-by-table in dependency order.
 *
 * Requires: DATABASE_BACKUP_URL env var pointing to the backup Postgres.
 */

import { PrismaClient } from '@prisma/client';
import { debugLog } from './debugLog.js';
import { captureException } from './sentry.js';

// Tables in dependency order (parents before children)
const TABLES_IN_ORDER = [
  'User',
  'Category',
  'PromoCode',
  'Organization',
  'Team',
  'Post',
  'Game',
  'Event',
  'Ad',
  'GroupChat',
  'Follows',
  'BlockedUser',
  'TeamMembership',
  'TeamFollow',
  'TeamInvite',
  'OrganizationMembership',
  'OrganizationFollow',
  'OrganizationInvite',
  'OrganizationJoinRequest',
  'Comment',
  'Story',
  'PostUpvote',
  'PostBookmark',
  'Poll',
  'PollOption',
  'PollVote',
  'GameVote',
  'CategoryAssignment',
  'CategoryFollow',
  'Notification',
  'GroupChatMember',
  'GroupChatMessage',
  'Message',
  'EventRsvp',
  'AdReservation',
  'PromoRedemption',
  'TransactionLog',
  'ProcessedStripeEvent',
  'AbuseReport',
  'AdminActivityLog',
  'UserWarning',
  'RefreshToken',
];

export async function syncDatabaseBackup(): Promise<{
  success: boolean;
  tablesSync: number;
  totalRows: number;
  error?: string;
}> {
  const backupUrl = process.env.DATABASE_BACKUP_URL;
  if (!backupUrl) {
    debugLog('[db-backup] DATABASE_BACKUP_URL not set, skipping sync');
    return { success: false, tablesSync: 0, totalRows: 0, error: 'DATABASE_BACKUP_URL not configured' };
  }

  const primary = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const backup = new PrismaClient({ datasourceUrl: backupUrl });

  let tablesSync = 0;
  let totalRows = 0;
  const failedTables: string[] = [];
  // Capture WHY each table failed, not just its name — the per-table error was
  // previously console-only, so the recurring "6 table(s) not synced" Sentry
  // issue carried no actionable cause.
  const failedTableReasons: Array<{ table: string; reason: string }> = [];

  try {
    // Test connectivity
    await primary.$queryRaw`SELECT 1`;
    await backup.$queryRaw`SELECT 1`;
    debugLog('[db-backup] Connected to both primary and backup databases');

    // Get all table names from the public schema on primary
    const tableNames = await primary.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `;
    const existingTables = new Set(tableNames.map((t) => t.tablename));

    // Disable FK constraints on backup for clean truncate + insert
    await backup.$executeRawUnsafe('SET session_replication_role = replica');

    // Build a map of backup table → set of existing columns.
    // This lets us skip columns that haven't been migrated on the backup DB yet
    // (schema drift between primary and backup after recent migrations).
    const backupColumnCache = new Map<string, Set<string>>();
    const primaryColumnCache = new Map<string, string[]>();
    const resolvePrimaryColumns = async (table: string): Promise<string[]> => {
      const cached = primaryColumnCache.get(table);
      if (cached && cached.length > 0) return cached;
      const rows = await primary.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position ASC`
      );
      const columns = rows.map((row) => row.column_name);
      primaryColumnCache.set(table, columns);
      return columns;
    };
    try {
      const backupCols = await backup.$queryRaw<Array<{ table_name: string; column_name: string }>>`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `;
      for (const row of backupCols) {
        if (!backupColumnCache.has(row.table_name)) backupColumnCache.set(row.table_name, new Set());
        backupColumnCache.get(row.table_name)!.add(row.column_name);
      }

      const primaryCols = await primary.$queryRaw<
        Array<{ table_name: string; column_name: string; ordinal_position: number }>
      >`
        SELECT table_name, column_name, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name ASC, ordinal_position ASC
      `;
      for (const row of primaryCols) {
        if (!primaryColumnCache.has(row.table_name)) primaryColumnCache.set(row.table_name, []);
        primaryColumnCache.get(row.table_name)!.push(row.column_name);
      }
    } catch (colErr: any) {
      console.error('[db-backup] Failed to read backup column info — will attempt sync without column filtering:', colErr.message?.slice(0, 200));
    }

    for (const table of TABLES_IN_ORDER) {
      // Prisma uses the model name as table name by default
      if (!existingTables.has(table)) {
        debugLog(`[db-backup] Table "${table}" not found in primary, skipping`);
        continue;
      }

      try {
        // Truncate backup table
        await backup.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);

        // Build column list: if we have backup column info, restrict to columns
        // that exist in both primary data AND backup schema (handles schema drift
        // where backup is missing recently-added migration columns).
        const allPrimaryColumns = await resolvePrimaryColumns(table);
        const backupCols = backupColumnCache.get(table);
        const columns = backupCols
          ? allPrimaryColumns.filter((c) => backupCols.has(c))
          : allPrimaryColumns;

        if (columns.length === 0) {
          console.error(`[db-backup] Table "${table}" has no matching columns in backup — skipping`);
          failedTables.push(table);
          continue;
        }

        const skippedCols = allPrimaryColumns.filter((c) => !columns.includes(c));
        if (skippedCols.length > 0) {
          debugLog(`[db-backup] "${table}": skipping ${skippedCols.length} column(s) missing from backup: ${skippedCols.join(', ')}`);
        }

        const colList = columns.map((c) => `"${c}"`).join(', ');
        const orderBy = columns.map((c) => `"${c}"`).join(', ');
        const [{ count: totalCountRaw }] = await primary.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
          `SELECT COUNT(*) AS count FROM "${table}"`
        );
        const totalTableRows = Number(totalCountRaw);

        if (totalTableRows === 0) {
          tablesSync++;
          continue;
        }

        // Insert in batches of 500 to avoid query size limits
        const batchSize = 500;
        for (let offset = 0; offset < totalTableRows; offset += batchSize) {
          const batch = await primary.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT ${colList} FROM "${table}" ORDER BY ${orderBy} LIMIT ${batchSize} OFFSET ${offset}`
          );
          if (batch.length === 0) break;
          const valueClauses: string[] = [];
          const params: unknown[] = [];
          let paramIdx = 1;

          for (const row of batch) {
            const placeholders = columns.map(() => `$${paramIdx++}`);
            valueClauses.push(`(${placeholders.join(', ')})`);
            for (const col of columns) {
              params.push(row[col]);
            }
          }

          const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueClauses.join(', ')}`;
          await backup.$executeRawUnsafe(sql, ...params);
        }

        totalRows += totalTableRows;
        tablesSync++;
        debugLog(`[db-backup] ${table}: ${totalTableRows} rows synced`);
      } catch (err: any) {
        const reason = String(err?.message || err).slice(0, 300);
        console.error(`[db-backup] Failed to sync table "${table}":`, reason);
        failedTables.push(table);
        failedTableReasons.push({ table, reason });
      }
    }

    if (failedTables.length > 0) {
      const backupErr = new Error(`DB backup sync partially failed — ${failedTables.length} table(s) not synced: ${failedTables.join(', ')}`);
      console.error('[db-backup]', backupErr.message);
      captureException(backupErr, { extra: { failedTables, failedTableReasons, tablesSync, totalRows } });
    }

    // Re-enable FK constraints
    await backup.$executeRawUnsafe('SET session_replication_role = DEFAULT');

    // Reset sequences to match primary
    try {
      const sequences = await primary.$queryRaw<Array<{ sequence_name: string }>>`
        SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
      `;
      for (const seq of sequences) {
        try {
          const [val] = await primary.$queryRawUnsafe<[{ last_value: bigint }]>(
            `SELECT last_value FROM "${seq.sequence_name}"`
          );
          await backup.$executeRawUnsafe(
            `SELECT setval('"${seq.sequence_name}"', ${val.last_value}, true)`
          );
        } catch {
          // Sequence may not exist on backup yet
        }
      }
    } catch {
      debugLog('[db-backup] Sequence sync skipped');
    }

    console.log(`[db-backup] Sync complete: ${tablesSync} tables, ${totalRows} total rows`);
    return { success: true, tablesSync, totalRows };
  } catch (err: any) {
    console.error('[db-backup] Sync failed:', err.message);
    return { success: false, tablesSync, totalRows, error: err.message };
  } finally {
    await primary.$disconnect();
    await backup.$disconnect();
  }
}
