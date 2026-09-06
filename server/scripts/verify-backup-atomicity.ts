/** Destructive ONLY to newly-created disposable local databases. Run with tsx. */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { syncDatabaseBackup } from '../src/lib/dbBackupSync.js';
const source = new URL(process.env.DATABASE_URL || 'postgresql://localhost:5432/varsityhub');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('Backup rollback verification requires local PostgreSQL');
}
const admin = new PrismaClient({ datasourceUrl: source.toString() });
const suffix = `${Date.now()}_${process.pid}`;
const created: string[] = [];
const urls: string[] = [];
for (const kind of ['primary', 'backup']) {
  const name = `vh_backup_probe_${kind}_${suffix}`;
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created.push(name);
  const url = new URL(source);
  url.pathname = `/${name}`;
  urls.push(url.toString());
}
process.env.DATABASE_URL = urls[0];
process.env.DATABASE_BACKUP_URL = urls[1];
const primary = new PrismaClient({ datasourceUrl: urls[0] });
const backup = new PrismaClient({ datasourceUrl: urls[1] });
try {
  for (const db of [primary, backup]) {
    await db.$executeRawUnsafe('CREATE TABLE "User" (id text PRIMARY KEY)');
    await db.$executeRawUnsafe('CREATE TABLE "Post" (id text PRIMARY KEY, title text NOT NULL)');
    await db.$executeRawUnsafe(
      'CREATE TABLE _prisma_migrations (id text PRIMARY KEY, finished_at timestamp DEFAULT now(), rolled_back_at timestamp)'
    );
  }
  await primary.$executeRawUnsafe(`INSERT INTO "User" VALUES ('new-user')`);
  await primary.$executeRawUnsafe(`INSERT INTO "Post" VALUES ('new-post','reject')`);
  await backup.$executeRawUnsafe(`INSERT INTO "User" VALUES ('old-user')`);
  await backup.$executeRawUnsafe(`INSERT INTO "Post" VALUES ('old-post','preserve')`);
  await primary.$executeRawUnsafe(
    "INSERT INTO _prisma_migrations (id, finished_at) VALUES ('new-history', '2026-09-06 12:00:00.123456')"
  );
  await backup.$executeRawUnsafe("INSERT INTO _prisma_migrations (id) VALUES ('old-history')");
  // Identical NOT VALID constraints retain pre-existing source data but reject
  // its destination insert. This exercises rollback after truncation, not only
  // the schema preflight.
  for (const db of [primary, backup]) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "Post" ADD CONSTRAINT test_failure CHECK (title <> 'reject') NOT VALID`
    );
  }
  const failed = await syncDatabaseBackup();
  assert.equal(failed.success, false);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "User"'), [{ id: 'old-user' }]);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "Post"'), [{ id: 'old-post' }]);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM _prisma_migrations'), [
    { id: 'old-history' },
  ]);
  console.log('PASS: middle-table insert failure preserves both previous backup tables');
  for (const db of [primary, backup])
    await db.$executeRawUnsafe('ALTER TABLE "Post" DROP CONSTRAINT test_failure');
  assert.equal((await syncDatabaseBackup()).success, true);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "User"'), [{ id: 'new-user' }]);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "Post"'), [{ id: 'new-post' }]);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM _prisma_migrations'), [
    { id: 'new-history' },
  ]);
  assert.deepEqual(
    await backup.$queryRawUnsafe('SELECT finished_at::text AS value FROM _prisma_migrations'),
    await primary.$queryRawUnsafe('SELECT finished_at::text AS value FROM _prisma_migrations')
  );
  console.log('PASS: successful refresh replaces data and migration history atomically');
  await primary.$executeRawUnsafe('CREATE INDEX title_boundary ON "Post" (title)');
  assert.equal((await syncDatabaseBackup()).success, false);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM _prisma_migrations'), [
    { id: 'new-history' },
  ]);
  console.log('PASS: missing index refuses refresh and preserves prior migration history');
  await primary.$executeRawUnsafe('DROP INDEX title_boundary');
  await primary.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN new_field text');
  assert.equal((await syncDatabaseBackup()).success, false);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "User"'), [{ id: 'new-user' }]);
  console.log('PASS: schema drift rejects refresh without clearing backup');
} finally {
  await primary.$disconnect();
  await backup.$disconnect();
  for (const name of created) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
  await admin.$disconnect();
}
