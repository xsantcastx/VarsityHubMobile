/**
 * Database Backup Sync
 *
 * Periodically replicates all data from the primary Postgres (Postgres-TnGR)
 * to the backup Postgres instance. Uses Prisma raw SQL to dump and restore
 * table-by-table in dependency order.
 *
 * Requires: DATABASE_BACKUP_URL env var pointing to the backup Postgres.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { assertBackupSchemaParity } from './dbBackupSchema.js';
import { debugLog } from './debugLog.js';
import { captureException } from './sentry.js';
import { buildRowValuesClause, enumCastTypeName } from './dbBackupSql.js';
import { TABLES_IN_ORDER, DEFERRED_FK_COLUMNS, BACKUP_EXCLUDED_TABLES } from './dbBackupTables.js';

export async function syncDatabaseBackup(): Promise<{
  success: boolean;
  tablesSync: number;
  totalRows: number;
  error?: string;
}> {
  const backupUrl = process.env.DATABASE_BACKUP_URL;
  if (!backupUrl) {
    debugLog('[db-backup] DATABASE_BACKUP_URL not set, skipping sync');
    return {
      success: false,
      tablesSync: 0,
      totalRows: 0,
      error: 'DATABASE_BACKUP_URL not configured',
    };
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
    const existingTables = new Set(tableNames.map(t => t.tablename));

    // NOTE: no `SET session_replication_role = replica` here. It only ever
    // applied to one pooled Prisma connection while inserts ran on others, so
    // it never disabled FK checks reliably — and making it stick would be
    // worse: inserts would "succeed" against tables emptied by a later
    // TRUNCATE CASCADE, producing a silently orphaned, unrestorable backup.
    // Inserts run with FKs enforced; a violation is the alarm we want.

    // Build a map of backup table → set of existing columns.
    // This lets us skip columns that haven't been migrated on the backup DB yet
    // (schema drift between primary and backup after recent migrations).
    const backupColumnCache = new Map<string, Set<string>>();
    const primaryColumnCache = new Map<string, string[]>();
    // Enum (USER-DEFINED) columns must be inserted with an explicit ::"<EnumType>"
    // cast — $executeRawUnsafe binds params as text, and Postgres won't implicitly
    // coerce text → enum (error 42804). Maps table → column → {dataType, udtName}.
    const primaryColumnTypeCache = new Map<
      string,
      Map<string, { dataType: string; udtName: string }>
    >();
    const timestampType = (table: string, col: string): string => {
      const type = primaryColumnTypeCache.get(table)?.get(col)?.udtName;
      return type === 'timestamp' || type === 'timestamptz' ? type : '';
    };
    const castForColumn = (table: string, col: string): string =>
      timestampType(table, col) || enumCastTypeName(primaryColumnTypeCache.get(table)?.get(col));
    const resolvePrimaryColumns = async (table: string): Promise<string[]> => {
      const cached = primaryColumnCache.get(table);
      if (cached && cached.length > 0) return cached;
      const rows = await primary.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position ASC`
      );
      const columns = rows.map(row => row.column_name);
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
        if (!backupColumnCache.has(row.table_name))
          backupColumnCache.set(row.table_name, new Set());
        backupColumnCache.get(row.table_name)!.add(row.column_name);
      }

      const primaryCols = await primary.$queryRaw<
        Array<{
          table_name: string;
          column_name: string;
          ordinal_position: number;
          data_type: string;
          udt_name: string;
        }>
      >`
        SELECT table_name, column_name, ordinal_position, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name ASC, ordinal_position ASC
      `;
      for (const row of primaryCols) {
        if (!primaryColumnCache.has(row.table_name)) primaryColumnCache.set(row.table_name, []);
        primaryColumnCache.get(row.table_name)!.push(row.column_name);
        if (!primaryColumnTypeCache.has(row.table_name))
          primaryColumnTypeCache.set(row.table_name, new Map());
        primaryColumnTypeCache
          .get(row.table_name)!
          .set(row.column_name, { dataType: row.data_type, udtName: row.udt_name });
      }
    } catch (colErr: any) {
      console.error(
        '[db-backup] Failed to read backup column info — will attempt sync without column filtering:',
        colErr.message?.slice(0, 200)
      );
    }

    // A primary table missing from TABLES_IN_ORDER never reaches the backup
    // (and, if anything references it, gets wiped by the TRUNCATE CASCADE
    // below) — alarm instead of skipping silently. New models are caught in
    // CI by db-backup-table-order.test.ts; this guards live schema drift.
    const unlistedTables = [...existingTables]
      .filter(t => !TABLES_IN_ORDER.includes(t) && !BACKUP_EXCLUDED_TABLES.has(t))
      .sort();
    if (unlistedTables.length > 0) {
      const msg = `DB backup sync: ${unlistedTables.length} primary table(s) not in TABLES_IN_ORDER, not backed up: ${unlistedTables.join(', ')}`;
      console.error('[db-backup]', msg);
      captureException(new Error(msg), { extra: { unlistedTables } });
      throw new Error(msg);
    }

    const syncableTables = TABLES_IN_ORDER.filter(t => existingTables.has(t));
    // Migration history describes the schema, so copy it only after strict
    // schema parity succeeds, in the same snapshot/transaction as application data.
    if (primaryColumnCache.has('_prisma_migrations')) syncableTables.push('_prisma_migrations');

    // Empty ALL tables in one statement before inserting anything. The old
    // per-table `TRUNCATE "<table>" CASCADE` was the root cause of the
    // recurring 23503 partial failures: truncating "Game" cascaded into the
    // already-synced "Post", so every Post child (Comment, PostUpvote,
    // PostBookmark, Notification) hit an FK violation on insert — and the
    // cascade-deleted rows were never restored. Tables missing on the backup
    // (it never receives `prisma migrate deploy`) are excluded here; their
    // INSERT below fails loudly into failedTables instead.
    const truncatable =
      backupColumnCache.size > 0
        ? syncableTables.filter(t => backupColumnCache.has(t))
        : syncableTables;
    // Fail before clearing the last complete backup when its schema is incomplete.
    for (const table of syncableTables) {
      const columns = await resolvePrimaryColumns(table);
      const available = backupColumnCache.get(table);
      if (!available || columns.some(column => !available.has(column))) {
        throw new Error(`Backup schema incomplete for ${table}; migrate backup before syncing`);
      }
    }
    await backup.$transaction(
      async backupTx => {
        // All primary reads happen inside one REPEATABLE READ transaction so every
        // table is captured from the same snapshot — otherwise rows written while
        // the sync runs can reference parents that were read out before they
        // existed, failing the child table's insert.
        await primary.$transaction(
          async tx => {
            await assertBackupSchemaParity(tx, backupTx);
            if (syncableTables.includes('_prisma_migrations')) {
              const [pending] = await tx.$queryRawUnsafe<Array<{ count: number }>>(
                'SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL'
              );
              if (pending.count > 0)
                throw new Error('Primary migration is incomplete; backup refresh refused');
            }
            const sequences = await tx.$queryRawUnsafe<Array<{ sequence_name: string }>>(
              "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'"
            );
            if (sequences.length > 0) {
              throw new Error('Backup sequence recovery is not implemented; refresh refused');
            }
            if (truncatable.length > 0) {
              await backupTx.$executeRawUnsafe(
                `TRUNCATE TABLE ${truncatable.map(t => `"${t}"`).join(', ')} CASCADE`
              );
            }
            for (const table of syncableTables) {
              try {
                // Build column list: if we have backup column info, restrict to columns
                // that exist in both primary data AND backup schema (handles schema drift
                // where backup is missing recently-added migration columns).
                const allPrimaryColumns = await resolvePrimaryColumns(table);
                const backupCols = backupColumnCache.get(table);
                // Deferred FK columns (cycles / self-references) are inserted as
                // NULL by omission and back-filled after every table is loaded.
                const deferredCols = DEFERRED_FK_COLUMNS[table] ?? [];
                const columns = (
                  backupCols ? allPrimaryColumns.filter(c => backupCols.has(c)) : allPrimaryColumns
                ).filter(c => !deferredCols.includes(c));

                if (columns.length === 0) {
                  console.error(
                    `[db-backup] Table "${table}" has no matching columns in backup — skipping`
                  );
                  failedTables.push(table);
                  failedTableReasons.push({ table, reason: 'no matching columns in backup' });
                  continue;
                }

                const skippedCols = allPrimaryColumns.filter(
                  c => !columns.includes(c) && !deferredCols.includes(c)
                );
                if (skippedCols.length > 0) {
                  debugLog(
                    `[db-backup] "${table}": skipping ${skippedCols.length} column(s) missing from backup: ${skippedCols.join(', ')}`
                  );
                }

                const colList = columns.map(c => `"${c}"`).join(', ');
                // PostgreSQL timestamps may contain microseconds; JS Date only
                // retains milliseconds. Preserve exact source text and cast it
                // back on INSERT, including immutable migration audit timestamps.
                const selectList = columns
                  .map(c => (timestampType(table, c) ? `"${c}"::text AS "${c}"` : `"${c}"`))
                  .join(', ');
                const orderBy = columns.map(c => `"${c}"`).join(', ');
                const [{ count: totalCountRaw }] = await tx.$queryRawUnsafe<
                  Array<{ count: bigint | number | string }>
                >(`SELECT COUNT(*) AS count FROM "${table}"`);
                const totalTableRows = Number(totalCountRaw);

                if (totalTableRows === 0) {
                  tablesSync++;
                  continue;
                }

                // Insert in batches of 500 to avoid query size limits
                const batchSize = 500;
                for (let offset = 0; offset < totalTableRows; offset += batchSize) {
                  const batch = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
                    `SELECT ${selectList} FROM "${table}" ORDER BY ${orderBy} LIMIT ${batchSize} OFFSET ${offset}`
                  );
                  if (batch.length === 0) break;
                  const valueClauses: string[] = [];
                  const params: unknown[] = [];
                  let paramIdx = 1;

                  for (const row of batch) {
                    const { clause, nextParamIdx } = buildRowValuesClause(columns, paramIdx, col =>
                      castForColumn(table, col)
                    );
                    paramIdx = nextParamIdx;
                    valueClauses.push(clause);
                    for (const col of columns) {
                      params.push(row[col]);
                    }
                  }

                  const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueClauses.join(', ')}`;
                  await backupTx.$executeRawUnsafe(sql, ...params);
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

            // Back-fill the deferred FK columns now that every table's rows exist.
            // These form FK shapes no insert order can satisfy: the
            // User.organization_id <-> Organization.league_owner_id cycle and
            // Comment.parent_id self-references.
            for (const [table, cols] of Object.entries(DEFERRED_FK_COLUMNS)) {
              if (!existingTables.has(table) || failedTables.includes(table)) continue;
              const backupCols = backupColumnCache.get(table);
              for (const col of cols) {
                if (backupCols && !backupCols.has(col)) continue; // backup schema drift
                try {
                  const batchSize = 500;
                  for (let offset = 0; ; offset += batchSize) {
                    const rows = await tx.$queryRawUnsafe<Array<{ id: unknown; value: unknown }>>(
                      `SELECT "id", "${col}" AS value FROM "${table}" WHERE "${col}" IS NOT NULL ORDER BY "id" LIMIT ${batchSize} OFFSET ${offset}`
                    );
                    if (rows.length === 0) break;
                    const valueClauses: string[] = [];
                    const params: unknown[] = [];
                    let paramIdx = 1;
                    for (const row of rows) {
                      valueClauses.push(`($${paramIdx++}, $${paramIdx++})`);
                      params.push(row.id, row.value);
                    }
                    await backupTx.$executeRawUnsafe(
                      `UPDATE "${table}" AS t SET "${col}" = v.value FROM (VALUES ${valueClauses.join(', ')}) AS v(id, value) WHERE t."id" = v.id`,
                      ...params
                    );
                    if (rows.length < batchSize) break;
                  }
                } catch (err: any) {
                  const reason = String(err?.message || err).slice(0, 300);
                  console.error(`[db-backup] Failed to back-fill "${table}"."${col}":`, reason);
                  if (!failedTables.includes(table)) failedTables.push(table);
                  failedTableReasons.push({ table: `${table}.${col}`, reason });
                }
              }
            }
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            // Prisma's default interactive-transaction timeout is 5s — far too
            // short for a full-database read. The snapshot only holds reads on
            // the primary; 15 minutes is a generous ceiling, not an expectation.
            timeout: 15 * 60_000,
            maxWait: 60_000,
          }
        );

        if (failedTables.length > 0) {
          const backupErr = new Error(
            `DB backup sync partially failed — ${failedTables.length} table(s) not synced: ${failedTables.join(', ')}`
          );
          console.error('[db-backup]', backupErr.message);
          // Stringify the reasons — Sentry flattens raw object arrays in `extra`
          // to "[Array]", which is how the cause got lost in the first place.
          captureException(backupErr, {
            extra: {
              failedTables,
              failedTableReasons: JSON.stringify(failedTableReasons),
              tablesSync,
              totalRows,
            },
          });
        }

        if (failedTables.length > 0)
          throw new Error(`Backup refresh rolled back: ${failedTables.join(', ')}`);
      },
      { timeout: 16 * 60_000, maxWait: 60_000 }
    );

    // A partial sync is a failure — the old unconditional `success: true` made
    // the scheduler log a green "sync complete" over 30 days of missing tables.
    if (failedTables.length > 0) {
      return {
        success: false,
        tablesSync,
        totalRows,
        error: `${failedTables.length} table(s) not synced: ${failedTables.join(', ')}`,
      };
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
