import { describe, it, before as beforeAll, after as afterAll, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
const database = new URL(process.env.DATABASE_URL || '');
assert(['localhost', '127.0.0.1'].includes(database.hostname));
assert(database.pathname.startsWith('/varsityhub_audit_') || database.pathname.endsWith('_test'));
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.VARSITYHUB_ENV_PATH, '/dev/null');
import { expect } from 'expect';
import { fn } from 'jest-mock';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { prisma } from '../../lib/prisma.js';
const describeDb = describe;
import { makeFakeStorage } from './exportFakeStorage.mjs';

const { dataExportRouter } = await import('../../routes/dataExport.js');
const { __setObjectStorageAdapterForTests } = await import('../../lib/objectStorage.js');
const { __setQueueDataExportForTests } = await import('../../jobs/queues.js');
const { processExportJob } = await import('../../workers/dataExportWorker.js');
const { buildUserDataExportArchive } = await import('../../lib/dataExport/builder.js');
const { runDataExportCleanupSweep } = await import('../../lib/dataExport/cleanup.js');

describeDb('Export lifecycle regression scenarios', () => {
  let userId: string;
  let otherId: string;
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: userId, email_verified: true };
    next();
  });
  app.use(dataExportRouter);
  beforeAll(async () => {
    userId = (
      await prisma.user.create({
        data: {
          email: `export-lifecycle-${Date.now()}@fixture.invalid`,
          email_verified: true,
          plan: 'legend',
          preferences: {
            theme: 'dark',
            position: 'Pitcher',
            notifications: {
              team_updates: false,
              messages_notifications: true,
              push_token: 'nested-fixture-secret',
            },
            plan: 'rookie',
            apple_original_transaction_id: 'fixture-payment-secret',
            push_token: 'fixture-push-secret',
          },
        },
      })
    ).id;
    otherId = (
      await prisma.user.create({ data: { email: `export-other-${Date.now()}@fixture.invalid` } })
    ).id;
    await prisma.post.create({ data: { author_id: userId, content: 'OWNED_EXPORT_POST' } });
    await prisma.post.create({ data: { author_id: otherId, content: 'OTHER_PRIVATE_POST' } });
    await prisma.comment.create({
      data: {
        author_id: userId,
        content: 'OWNED_COMMENT',
        post_id: (await prisma.post.findFirstOrThrow({ where: { author_id: userId } })).id,
      },
    });
  });
  beforeEach(async () => {
    await prisma.dataExport.deleteMany({ where: { user_id: userId } });
    __setObjectStorageAdapterForTests(makeFakeStorage().adapter);
    __setQueueDataExportForTests(async () => 'fixture-job');
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    __setQueueDataExportForTests(null);
  });

  it('unavailable storage rejects before inserting and reports unavailable', async () => {
    __setObjectStorageAdapterForTests(makeFakeStorage({ configured: false }).adapter);
    expect((await request(app).post('/me/data-export')).status).toBe(503);
    expect(await prisma.dataExport.count({ where: { user_id: userId } })).toBe(0);
    expect((await request(app).get('/me/data-export-availability')).body.available).toBe(false);
  });

  it('concurrent requests create exactly one pending job', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => request(app).post('/me/data-export'))
    );
    expect(results.map(r => r.status).sort()).toEqual([202, 409, 409, 409, 409, 409]);
    expect(await prisma.dataExport.count({ where: { user_id: userId } })).toBe(1);
  });

  it('every promised section builds, includes owned data and canonical billing, excludes secrets and other posts', async () => {
    const archive = await buildUserDataExportArchive(userId);
    const directory = mkdtempSync(join(tmpdir(), 'varsityhub-export-test-'));
    try {
      const path = join(directory, 'archive.zip');
      writeFileSync(path, archive.zipBuffer);
      const read = (file: string) =>
        JSON.parse(execFileSync('unzip', ['-p', path, file], { encoding: 'utf8' }));
      expect(read('MANIFEST.json').domains_failed).toEqual([]);
      expect(archive.domainsIncluded).toHaveLength(26);
      expect(read('profile.json').email).toContain('@fixture.invalid');
      expect(read('preferences.json')).toEqual({
        theme: 'dark',
        position: 'Pitcher',
        notifications: { team_updates: false, messages_notifications: true },
      });
      expect(read('billing_summary.json').plan).toBe('legend');
      expect(read('comments.json')[0].content).toBe('OWNED_COMMENT');
      expect(read('posts.json').map((p: any) => p.content)).toEqual(['OWNED_EXPORT_POST']);
      const all = execFileSync('unzip', ['-p', path], { encoding: 'utf8' });
      for (const forbidden of [
        'fixture-payment-secret',
        'fixture-push-secret',
        'nested-fixture-secret',
        'OTHER_PRIVATE_POST',
        'password_hash',
      ]) {
        expect(all).not.toContain(forbidden);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('a failed extractor cannot produce a ready partial archive', async () => {
    const fake = makeFakeStorage();
    __setObjectStorageAdapterForTests(fake.adapter);
    const original = prisma.comment.findMany;
    prisma.comment.findMany = (() =>
      Promise.reject(new Error('fixture query outage'))) as typeof original;
    try {
      await expect(buildUserDataExportArchive(userId)).rejects.toThrow('Data export incomplete');
      const row = await prisma.dataExport.create({ data: { user_id: userId, status: 'pending' } });
      await processExportJob({ data: { exportId: row.id, userId } } as any);
      expect((await prisma.dataExport.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
        'failed'
      );
      expect(fake.puts).toHaveLength(0);
    } finally {
      prisma.comment.findMany = original;
    }
  });

  it('expired ready archives are expired in lists and rejected without a cleanup run', async () => {
    const row = await prisma.dataExport.create({
      data: {
        user_id: userId,
        status: 'ready',
        storage_key: 'expired.zip',
        expires_at: new Date(Date.now() - 1000),
      },
    });
    expect((await request(app).get(`/me/data-export/${row.id}/download`)).status).toBe(410);
    expect((await request(app).get('/me/data-exports')).body[0].status).toBe('expired');
  });

  it('a link with less than 30 seconds of archive life never extends it', async () => {
    const row = await prisma.dataExport.create({
      data: {
        user_id: userId,
        status: 'ready',
        storage_key: 'near.zip',
        expires_at: new Date(Date.now() + 9000),
      },
    });
    const res = await request(app).get(`/me/data-export/${row.id}/download`);
    expect(res.status).toBe(200);
    expect(Number(new URL(res.body.url).searchParams.get('ttl'))).toBeLessThanOrEqual(9);
    expect(new Date(res.body.expires_at).getTime()).toBeLessThanOrEqual(row.expires_at!.getTime());
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('duplicate workers upload once', async () => {
    const fake = makeFakeStorage();
    __setObjectStorageAdapterForTests(fake.adapter);
    const row = await prisma.dataExport.create({ data: { user_id: userId, status: 'pending' } });
    const job = { data: { exportId: row.id, userId } } as any;
    await Promise.all([processExportJob(job), processExportJob(job)]);
    expect(fake.puts).toHaveLength(1);
    expect((await prisma.dataExport.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      'ready'
    );
  });

  it('cancel during upload cannot resurrect the archive, and removes the settled upload', async () => {
    const fake = makeFakeStorage();
    let release!: () => void;
    let uploading!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      uploading = resolve;
    });
    __setObjectStorageAdapterForTests({
      ...fake.adapter,
      async putObject() {
        uploading();
        await hold;
      },
    });
    const row = await prisma.dataExport.create({ data: { user_id: userId, status: 'pending' } });
    const processing = processExportJob({ data: { exportId: row.id, userId } } as any);
    await started;
    expect((await request(app).delete(`/me/data-export/${row.id}`)).status).toBe(204);
    expect(fake.deletes).toHaveLength(0);
    release();
    await processing;
    const after = await prisma.dataExport.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe('expired');
    expect(after.storage_key).toBeNull();
    expect(fake.deletes).toHaveLength(1);
  });

  it('delete outage keeps a retryable key and cleanup removes it after recovery', async () => {
    const fake = makeFakeStorage({ failDeleteOn: 'retry.zip' });
    __setObjectStorageAdapterForTests(fake.adapter);
    const row = await prisma.dataExport.create({
      data: {
        user_id: userId,
        status: 'ready',
        storage_key: 'retry.zip',
        completed_at: new Date(),
        expires_at: new Date(Date.now() + 100000),
      },
    });
    await request(app).delete(`/me/data-export/${row.id}`);
    expect((await prisma.dataExport.findUniqueOrThrow({ where: { id: row.id } })).storage_key).toBe(
      'retry.zip'
    );
    expect((await request(app).get(`/me/data-export/${row.id}/download`)).status).toBe(410);
    expect((await request(app).post('/me/data-export')).status).toBe(429);
    fake.setFailDeleteOn();
    await runDataExportCleanupSweep();
    expect(
      (await prisma.dataExport.findUniqueOrThrow({ where: { id: row.id } })).storage_key
    ).toBeNull();
  });

  it('reaps an abandoned pending request while preserving a fresh request', async () => {
    const old = await prisma.dataExport.create({
      data: {
        user_id: userId,
        status: 'pending',
        requested_at: new Date(Date.now() - 3 * 3600000),
      },
    });
    const fresh = await prisma.dataExport.create({ data: { user_id: userId, status: 'pending' } });
    await runDataExportCleanupSweep();
    expect((await prisma.dataExport.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(
      'failed'
    );
    expect((await prisma.dataExport.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe(
      'pending'
    );
  });
});

afterAll(async () => {
  const { prisma } = await import('../../lib/prisma.js');
  await prisma.$disconnect();
});
