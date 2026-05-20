import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import type { ObjectStorageAdapter } from '../lib/objectStorage.js';
import { prisma } from '../lib/prisma.js';
import { describeDb } from './dbTestGuard.js';

class MockObjectStorageNotConfiguredError extends Error {}

let currentStorage: ObjectStorageAdapter = {
  isConfigured: () => false,
  async putObject() {
    throw new Error('storage not configured');
  },
  async getSignedDownloadUrl() {
    throw new Error('storage not configured');
  },
  async deleteObject() {
    return;
  },
};

jest.unstable_mockModule('../lib/objectStorage.js', () => ({
  getObjectStorageAdapter: () => currentStorage,
  ObjectStorageNotConfiguredError: MockObjectStorageNotConfiguredError,
}));

const { processExportJob } = await import('../workers/dataExportWorker.js');

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
function makeFakeStorage(opts: { configured?: boolean } = {}): {
  adapter: ObjectStorageAdapter;
  puts: Array<{ key: string; contentType: string; sizeBytes: number }>;
} {
  const puts: Array<{ key: string; contentType: string; sizeBytes: number }> = [];
  return {
    puts,
    adapter: {
      isConfigured: () => opts.configured !== false,
      async putObject(key: string, body: Buffer, contentType: string) {
        puts.push({
          key,
          contentType,
          sizeBytes: Buffer.isBuffer(body) ? body.byteLength : 0,
        });
      },
      async getSignedDownloadUrl(key: string, ttlSeconds = 300) {
        return `https://fake-storage.test/${key}?ttl=${ttlSeconds}&sig=fake`;
      },
      async deleteObject() {
        return;
      },
    } satisfies ObjectStorageAdapter,
  };
}

describeDb('GDPR data export — worker', () => {
  let userId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `export-worker-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Worker Test User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  afterEach(async () => {
    await (prisma as any).dataExport.deleteMany({ where: { user_id: userId } });
    currentStorage = makeFakeStorage({ configured: false }).adapter;
  });

  it('builds ZIP, uploads via storage adapter, flips row to ready', async () => {
    const fake = makeFakeStorage({ configured: true });
    currentStorage = fake.adapter;

    const row = await (prisma as any).dataExport.create({
      data: { user_id: userId, status: 'pending' },
    });

    await processExportJob({
      data: { exportId: row.id, userId },
    } as any);

    const after = await (prisma as any).dataExport.findUnique({
      where: { id: row.id },
    });
    expect(after.status).toBe('ready');
    expect(after.storage_key).toMatch(/^exports\/.+\.zip$/);
    expect(after.size_bytes).toBeGreaterThan(0);
    expect(after.completed_at).not.toBeNull();
    expect(after.expires_at).not.toBeNull();
    const ttlMs = new Date(after.expires_at).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
    expect(fake.puts.length).toBe(1);
    expect(fake.puts[0].contentType).toBe('application/zip');
    expect(fake.puts[0].sizeBytes).toBeGreaterThan(0);
    expect(fake.puts[0].key).toBe(after.storage_key);
  });

  it('flips to failed with storage_not_configured when adapter is unconfigured', async () => {
    const fake = makeFakeStorage({ configured: false });
    currentStorage = fake.adapter;

    const row = await (prisma as any).dataExport.create({
      data: { user_id: userId, status: 'pending' },
    });

    await processExportJob({
      data: { exportId: row.id, userId },
    } as any);

    const after = await (prisma as any).dataExport.findUnique({
      where: { id: row.id },
    });
    expect(after.status).toBe('failed');
    expect(after.error_category).toBe('storage_not_configured');
    expect(after.started_at).toBeNull();
    expect(fake.puts.length).toBe(0);
  });

  it('flips to failed with job_user_mismatch when payload user does not match row', async () => {
    const fake = makeFakeStorage({ configured: true });
    currentStorage = fake.adapter;

    const row = await (prisma as any).dataExport.create({
      data: { user_id: userId, status: 'pending' },
    });

    await processExportJob({
      data: { exportId: row.id, userId: `wrong-${userId}` },
    } as any);

    const after = await (prisma as any).dataExport.findUnique({
      where: { id: row.id },
    });
    expect(after.status).toBe('failed');
    expect(after.error_category).toBe('job_user_mismatch');
    expect(fake.puts.length).toBe(0);
  });

  it('is idempotent: a second invocation on a ready row does not rebuild or overwrite', async () => {
    const fake = makeFakeStorage({ configured: true });
    currentStorage = fake.adapter;

    const row = await (prisma as any).dataExport.create({
      data: { user_id: userId, status: 'pending' },
    });

    await processExportJob({
      data: { exportId: row.id, userId },
    } as any);
    const firstKey = (
      await (prisma as any).dataExport.findUnique({
        where: { id: row.id },
      })
    ).storage_key;

    await processExportJob({
      data: { exportId: row.id, userId },
    } as any);

    expect(fake.puts.length).toBe(1);
    const after = await (prisma as any).dataExport.findUnique({
      where: { id: row.id },
    });
    expect(after.storage_key).toBe(firstKey);
  });
});
