import { describe, expect, it, jest } from '@jest/globals';
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

jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: jest.fn() },
}));

jest.unstable_mockModule('../lib/debugLog.js', () => ({
  debugLog: jest.fn(),
}));

jest.unstable_mockModule('../lib/billingLifecycle.js', () => ({
  runStripeSubscriptionReconciliation: jest.fn(async () => ({ fixed: 0, checked: 0 })),
}));

jest.unstable_mockModule('../jobs/queues.js', () => ({
  emailQueue: null,
}));

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: jest.fn(),
}));

jest.unstable_mockModule('../lib/accountDeletion.js', () => ({
  hardDeleteAnonymizedUsers: jest.fn(async () => ({ purged: 0, skipped: 0, failed: 0 })),
  ANONYMIZED_USER_RETENTION_DAYS_DEFAULT: 30,
}));

const { runDataExportCleanupSweep } = await import('../cron/overnightTasks.js');

const PASSWORD = 'TestPassword123!';
const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkip = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkip ? describe.skip : describe;

describeDb('GDPR data export — cleanup cron', () => {
  const { getUserId } = setupDataExportUserLifecycle({
    emailPrefix: 'export-cleanup',
    displayName: 'Cleanup Test User',
    password: PASSWORD,
  });

  it('flips building rows older than 2h to failed with stuck_build_reaped', async () => {
    const fake = makeFakeStorage({ configured: true });
    storageState.current = fake.adapter;
    const userId = getUserId();

    const stuck = await (prisma as any).dataExport.create({
      data: {
        user_id: userId,
        status: 'building',
        started_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });
    const fresh = await (prisma as any).dataExport.create({
      data: {
        user_id: userId,
        status: 'building',
        started_at: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

    const result = await runDataExportCleanupSweep();
    expect(result.stuckReaped).toBeGreaterThanOrEqual(1);

    const stuckAfter = await (prisma as any).dataExport.findUnique({
      where: { id: stuck.id },
    });
    expect(stuckAfter.status).toBe('failed');
    expect(stuckAfter.error_category).toBe('stuck_build_reaped');

    const freshAfter = await (prisma as any).dataExport.findUnique({
      where: { id: fresh.id },
    });
    expect(freshAfter.status).toBe('building');
    expect(freshAfter.error_category).toBeNull();
  });

  it('deletes storage objects and flips status to expired, preserving row', async () => {
    const fake = makeFakeStorage({ configured: true });
    storageState.current = fake.adapter;
    const userId = getUserId();

    const oldReady = await (prisma as any).dataExport.create({
      data: {
        user_id: userId,
        status: 'ready',
        completed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        storage_key: 'exports/ab/userCleanup/old-expired.zip',
        size_bytes: 9999,
      },
    });
    const freshReady = await (prisma as any).dataExport.create({
      data: {
        user_id: userId,
        status: 'ready',
        completed_at: new Date(),
        expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        storage_key: 'exports/ab/userCleanup/fresh.zip',
        size_bytes: 8888,
      },
    });

    const result = await runDataExportCleanupSweep();
    expect(result.expiredCleaned).toBeGreaterThanOrEqual(1);
    expect(fake.deletes).toContain('exports/ab/userCleanup/old-expired.zip');
    expect(fake.deletes).not.toContain('exports/ab/userCleanup/fresh.zip');

    const oldAfter = await (prisma as any).dataExport.findUnique({
      where: { id: oldReady.id },
    });
    expect(oldAfter).not.toBeNull();
    expect(oldAfter.status).toBe('expired');
    expect(oldAfter.storage_key).toBeNull();
    expect(oldAfter.size_bytes).toBeNull();

    const freshAfter = await (prisma as any).dataExport.findUnique({
      where: { id: freshReady.id },
    });
    expect(freshAfter.status).toBe('ready');
    expect(freshAfter.storage_key).toBe('exports/ab/userCleanup/fresh.zip');
  });

  it('continues the sweep and still flips status when storage delete fails', async () => {
    const fake = makeFakeStorage({ configured: true });
    fake.setFailDeleteOn('exports/ab/userCleanup/will-fail.zip');
    storageState.current = fake.adapter;
    const userId = getUserId();

    const row = await (prisma as any).dataExport.create({
      data: {
        user_id: userId,
        status: 'ready',
        completed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        storage_key: 'exports/ab/userCleanup/will-fail.zip',
        size_bytes: 7777,
      },
    });

    const result = await runDataExportCleanupSweep();
    expect(result.storageDeleteFailed).toBeGreaterThanOrEqual(1);

    const after = await (prisma as any).dataExport.findUnique({
      where: { id: row.id },
    });
    expect(after.status).toBe('expired');
  });
});
