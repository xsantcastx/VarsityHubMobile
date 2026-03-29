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

    for (const table of TABLES_IN_ORDER) {
      // Prisma uses the model name as table name by default
      if (!existingTables.has(table)) {
        debugLog(`[db-backup] Table "${table}" not found in primary, skipping`);
        continue;
      }

      try {
        // Truncate backup table
        await backup.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);

        // Get all rows from primary as JSON
        const rows = await primary.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM "${table}"`
        );

        if (rows.length === 0) {
          tablesSync++;
          continue;
        }

        // Build and execute batch insert
        const columns = Object.keys(rows[0]);
        const colList = columns.map((c) => `"${c}"`).join(', ');

        // Insert in batches of 500 to avoid query size limits
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
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

        totalRows += rows.length;
        tablesSync++;
        debugLog(`[db-backup] ${table}: ${rows.length} rows synced`);
      } catch (err: any) {
        console.error(`[db-backup] Failed to sync table "${table}":`, err.message?.slice(0, 200));
        failedTables.push(table);
      }
    }

    if (failedTables.length > 0) {
      const backupErr = new Error(`DB backup sync partially failed — ${failedTables.length} table(s) not synced: ${failedTables.join(', ')}`);
      console.error('[db-backup]', backupErr.message);
      captureException(backupErr, { extra: { failedTables, tablesSync, totalRows } });
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
