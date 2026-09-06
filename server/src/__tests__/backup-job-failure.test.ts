import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
const sync = jest.fn<() => Promise<any>>();
jest.unstable_mockModule('../lib/dbBackupSync.js', () => ({ syncDatabaseBackup: sync }));
jest.useFakeTimers();
const { SCHEDULED_JOBS } = await import('../jobs/scheduler.js');
const job = SCHEDULED_JOBS.find(job => job.name === 'db-backup-sync')!;
afterAll(() => jest.useRealTimers());
beforeEach(() => sync.mockReset());
describe('backup scheduler outcome', () => {
  it('fails the job when sync returns a failure instead of logging a green completion', async () => {
    sync.mockResolvedValue({ success: false, error: 'backup rolled back' });
    await expect(job.handler()).rejects.toThrow('backup rolled back');
  });
  it('propagates thrown failures to the worker', async () => {
    sync.mockRejectedValue(new Error('database unavailable'));
    await expect(job.handler()).rejects.toThrow('database unavailable');
  });
  it('allows successful sync and intentional unconfigured skip', async () => {
    sync
      .mockResolvedValueOnce({ success: true, tablesSync: 58, totalRows: 100 })
      .mockResolvedValueOnce({ success: false, error: 'DATABASE_BACKUP_URL not configured' });
    await expect(job.handler()).resolves.toBeUndefined();
    await expect(job.handler()).resolves.toBeUndefined();
  });
});
