import { describe, expect, it, jest } from '@jest/globals';
import { describeDb } from './helpers/dbTestSuite.js';
import { prisma } from '../lib/prisma.js';
import {
  makeFakeStorage,
  MockObjectStorageNotConfiguredError,
  setupDataExportUserLifecycle,
  storageState,
} from './helpers/dataExportTestUtils.js';

jest.unstable_mockModule('../lib/objectStorage.js', () => ({
  getObjectStorageAdapter: () => storageState.current,
  ObjectStorageNotConfiguredError: MockObjectStorageNotConfiguredError,
}));

const { processExportJob } = await import('../workers/dataExportWorker.js');

const PASSWORD = 'TestPassword123!';

describeDb('GDPR data export — worker', () => {
  const { getUserId } = setupDataExportUserLifecycle({
    emailPrefix: 'export-worker',
    displayName: 'Worker Test User',
    password: PASSWORD,
  });

  const createPendingExport = async (userId: string) =>
    (prisma as any).dataExport.create({
      data: { user_id: userId, status: 'pending' },
    });

  const setupExportJob = async (configured: boolean) => {
    const fake = makeFakeStorage({ configured });
    storageState.current = fake.adapter;
    const userId = getUserId();
    const row = await createPendingExport(userId);
    return { fake, userId, row };
  };

  it('builds ZIP, uploads via storage adapter, flips row to ready', async () => {
    const { fake, userId, row } = await setupExportJob(true);

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
    const { fake, userId, row } = await setupExportJob(false);

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
    const { fake, userId, row } = await setupExportJob(true);

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
    const { fake, userId, row } = await setupExportJob(true);

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
