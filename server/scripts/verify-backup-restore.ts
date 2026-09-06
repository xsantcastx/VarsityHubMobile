/** Restores into a newly-created LOCAL database only; never restores in-place. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertBackupSchemaParity } from '../src/lib/dbBackupSchema.js';

const required = (key: string) => {
  if (!process.env[key]) throw new Error(`${key} is required`);
  try {
    return new URL(process.env[key]!);
  } catch {
    throw new Error(`${key} must be a valid PostgreSQL URL`);
  }
};
const sourceUrl = required('RESTORE_SOURCE_URL');
const primaryUrl = required('RESTORE_PRIMARY_URL');
const adminUrl = required('RESTORE_ADMIN_URL');
if (adminUrl.search || !['localhost', '127.0.0.1', '[::1]'].includes(adminUrl.hostname)) {
  throw new Error('Restore target must be an isolated local PostgreSQL service');
}
const name = `vh_restore_${randomUUID().replaceAll('-', '')}`;
const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${name}`;
const command = (name: string) => (process.env.PG_BIN ? resolve(process.env.PG_BIN, name) : name);
const envFor = (url: URL, readOnly = false) => ({
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1),
  PGOPTIONS: `-c timezone=UTC -c default_transaction_read_only=${readOnly ? 'on' : 'off'}`,
});
const source = new PrismaClient({ datasourceUrl: sourceUrl.toString() });
const primary = new PrismaClient({ datasourceUrl: primaryUrl.toString() });
const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
const target = new PrismaClient({ datasourceUrl: targetUrl.toString() });
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
type Reader = Pick<typeof source, '$queryRawUnsafe' | '$executeRawUnsafe'>;
async function fingerprints(db: Reader) {
  const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  const rows: Record<string, { count: number; hash: string }> = {};
  for (const { tablename } of tables) {
    [rows[tablename]] = await db.$queryRawUnsafe<Array<{ count: number; hash: string }>>(
      `SELECT count(*)::int AS count,md5(coalesce(string_agg(h,'' ORDER BY h),'')) hash FROM (SELECT md5(to_jsonb(t)::text) h FROM public.${quote(tablename)} t) s`
    );
  }
  return rows;
}
const report: Record<string, unknown> = { startedAt: new Date().toISOString(), success: false };
let created = false;
let phase = 'create_isolated_database';
try {
  const [isolation] = await admin.$queryRawUnsafe<Array<{ enabled: string | null }>>(
    "SELECT current_setting('varsity.restore_isolated', true) AS enabled"
  );
  if (isolation.enabled !== 'on')
    throw new Error(
      'Restore PostgreSQL must be explicitly provisioned with varsity.restore_isolated=on'
    );
  await admin.$executeRawUnsafe(`CREATE DATABASE ${quote(name)}`);
  created = true;
  phase = 'snapshot_dump';
  let original: Awaited<ReturnType<typeof fingerprints>> = {};
  let archive: Buffer = Buffer.alloc(0);
  await source.$transaction(
    async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      const [{ snapshot }] = await tx.$queryRawUnsafe<Array<{ snapshot: string }>>(
        'SELECT pg_export_snapshot() AS snapshot'
      );
      original = await fingerprints(tx);
      archive = execFileSync(
        command('pg_dump'),
        ['--format=custom', '--no-owner', '--no-acl', `--snapshot=${snapshot}`],
        {
          env: envFor(sourceUrl, true),
          maxBuffer: 64 * 1024 * 1024,
          timeout: 120000,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
    },
    { isolationLevel: 'RepeatableRead', timeout: 180000 }
  );
  phase = 'restore';
  try {
    execFileSync(
      command('pg_restore'),
      ['--dbname', name, '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl'],
      {
        env: envFor(targetUrl),
        input: archive,
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  } finally {
    archive.fill(0);
  }
  const restored = await target.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
    return fingerprints(tx);
  });
  if (JSON.stringify(original) !== JSON.stringify(restored))
    throw new Error('Restored content mismatch');
  report.tables = Object.keys(original).length;
  report.rows = Object.values(original).reduce((sum, row) => sum + row.count, 0);
  report.contentMatched = true;
  // Only for rehearsing a reviewed repair, always against the disposable target.
  // Scheduled acceptance drills MUST leave RESTORE_REPAIR_SQL unset.
  if (process.env.RESTORE_REPAIR_SQL) {
    phase = 'rehearse_schema_repair';
    execFileSync(command('psql'), ['-X', '--set', 'ON_ERROR_STOP=1', '--single-transaction'], {
      env: envFor(targetUrl),
      input: readFileSync(process.env.RESTORE_REPAIR_SQL),
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    await assertBackupSchemaParity(primary, target);
    // Proven schema equality is mandatory before copying the source-of-truth ledger.
    // This rehearsal never changes the real backup migration history.
    const migrations = await primary.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM _prisma_migrations ORDER BY id'
    );
    await target.$transaction(async tx => {
      await tx.$executeRawUnsafe('TRUNCATE _prisma_migrations');
      for (const row of migrations) {
        const columns = Object.keys(row);
        await tx.$executeRawUnsafe(
          `INSERT INTO _prisma_migrations (${columns.map(quote).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
          ...columns.map(key => row[key])
        );
      }
    });
    report.repairRehearsal = true;
  }
  phase = 'schema_parity';
  await assertBackupSchemaParity(primary, target);
  phase = 'migrate_deploy';
  execFileSync(resolve('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: targetUrl.toString() },
    timeout: 120000,
    stdio: 'pipe',
  });
  phase = 'purchase_recovery';
  execFileSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      'node_modules/jest/bin/jest.js',
      '--runInBand',
      'src/__tests__/ad-purchase-intents.db.test.ts',
      'src/__tests__/payments-finalization.test.ts',
      'src/__tests__/ad-state-invariants.test.ts',
    ],
    { env: { ...process.env, DATABASE_URL: targetUrl.toString() }, timeout: 120000, stdio: 'pipe' }
  );
  report.purchaseRecoveryPassed = true;
  phase = 'application_constraints';
  const existing = await target.user.findFirst({ select: { email: true } });
  let writePassed = false,
    duplicateRejected = false;
  try {
    await target.$transaction(async tx => {
      await tx.user.create({ data: { email: `restore-${name}@example.invalid` } });
      writePassed = true;
      if (existing) await tx.user.create({ data: { email: existing.email } });
      throw new Error('rollback_probe');
    });
  } catch (error: any) {
    duplicateRejected = error?.code === 'P2002';
  }
  if (!writePassed || (existing && !duplicateRejected))
    throw new Error('Application write/unique constraint probe failed');
  if (await target.user.count({ where: { email: `restore-${name}@example.invalid` } }))
    throw new Error('Probe did not roll back');
  const team = await target.team.findFirst({ select: { id: true } });
  if (team) {
    let orphanRejected = false;
    try {
      await target.teamFollow.create({ data: { user_id: `missing-${name}`, team_id: team.id } });
    } catch (error: any) {
      orphanRejected = error?.code === 'P2003';
    }
    if (!orphanRejected) throw new Error('Foreign key probe failed');
  }
  report.migrationDeployPassed = true;
  report.applicationConstraintsPassed = true;
  report.success = true;
} catch (error: any) {
  report.failedPhase = phase;
  report.errorCode =
    error?.code || String(error?.stderr || '').match(/P[0-9]{4}/)?.[0] || error?.name || 'unknown';
  // Child output can include data/connection details; emit phase/code only.
  process.exitCode = 1;
} finally {
  await source.$disconnect();
  await primary.$disconnect();
  await target.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
  await admin.$disconnect();
  report.cleanedUp = true;
  report.finishedAt = new Date().toISOString();
  if (process.env.RESTORE_REPORT_PATH)
    writeFileSync(process.env.RESTORE_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
