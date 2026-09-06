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
  }
  await primary.$executeRawUnsafe(`INSERT INTO "User" VALUES ('new-user')`);
  await primary.$executeRawUnsafe(`INSERT INTO "Post" VALUES ('new-post','reject')`);
  await backup.$executeRawUnsafe(`INSERT INTO "User" VALUES ('old-user')`);
  await backup.$executeRawUnsafe(`INSERT INTO "Post" VALUES ('old-post','preserve')`);
  await backup.$executeRawUnsafe(
    `ALTER TABLE "Post" ADD CONSTRAINT test_failure CHECK (title <> 'reject')`
  );
  const failed = await syncDatabaseBackup();
  assert.equal(failed.success, false);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "User"'), [{ id: 'old-user' }]);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "Post"'), [{ id: 'old-post' }]);
  console.log('PASS: middle-table insert failure preserves both previous backup tables');
  await backup.$executeRawUnsafe('ALTER TABLE "Post" DROP CONSTRAINT test_failure');
  assert.equal((await syncDatabaseBackup()).success, true);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "User"'), [{ id: 'new-user' }]);
  assert.deepEqual(await backup.$queryRawUnsafe('SELECT id FROM "Post"'), [{ id: 'new-post' }]);
  console.log('PASS: successful refresh replaces both tables');
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
