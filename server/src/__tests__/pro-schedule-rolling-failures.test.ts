import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const ingest = jest.fn<(...args: any[]) => Promise<any>>();
const createRun = jest.fn(async () => ({ id: 'run' }));
const updateRun = jest.fn(async () => ({}));
let adapterName = 'espn';
jest.unstable_mockModule('../lib/proSchedule/adapters.js', () => ({
  NO_ADAPTER_MESSAGE: 'disabled',
  resolveConfiguredAdapter: () => ({ name: adapterName, leagues: ['ncaaf', 'nfl'] }),
}));
jest.unstable_mockModule('../lib/proSchedule/ingest.js', () => ({ ingestLeague: ingest }));
jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    sportsLeague: { findUnique: async () => ({ id: 'league' }) },
    sportsIngestRun: { create: createRun, update: updateRun },
  },
}));
const { runRollingScheduleIngest } = await import('../cron/pro-schedule-rolling.js');
const success = { fetched: 3, created: 2, updated: 1, skipped: 0, failures: [] };

describe('rolling schedule worker outcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adapterName = 'espn';
    createRun.mockReset().mockResolvedValue({ id: 'run' });
    ingest.mockReset().mockResolvedValue(success);
    updateRun.mockReset().mockResolvedValue({});
  });

  it('continues other leagues then rejects when a provider fails', async () => {
    ingest.mockRejectedValueOnce(new Error('provider down'));
    await expect(runRollingScheduleIngest({ apply: true })).rejects.toThrow('ncaaf');
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(updateRun.mock.calls.map(call => (call as any)[0].data.status)).toEqual([
      'failed',
      'success',
    ]);
  });

  it('records quarantined fixtures as partial and rejects the job', async () => {
    ingest.mockResolvedValueOnce({ ...success, failures: [{ reason: 'NO_VENUE_COORDS' }] });
    await expect(runRollingScheduleIngest({ apply: true })).rejects.toThrow('ncaaf');
    expect(updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'partial', fetched_count: 3, failure_count: 1 }),
      })
    );
  });

  it('does not write a run ledger during a dry run', async () => {
    await runRollingScheduleIngest({ apply: false });
    expect(createRun).not.toHaveBeenCalled();
    expect(updateRun).not.toHaveBeenCalled();
  });

  it('does not hide monitoring persistence failure', async () => {
    updateRun.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(runRollingScheduleIngest({ apply: true })).rejects.toThrow('ncaaf');
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('records file provider identity without storing an overlong private file path', async () => {
    adapterName = `json:/private/schedule-imports/${'season-export-'.repeat(10)}.json`;
    await runRollingScheduleIngest({ apply: true });
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'json' }),
      })
    );
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('skips an unrecordable league but still imports independently recordable leagues', async () => {
    createRun.mockRejectedValueOnce(new Error('run ledger unavailable'));
    await expect(runRollingScheduleIngest({ apply: true })).rejects.toThrow('ncaaf');
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledWith(
      expect.anything(),
      'nfl',
      expect.any(Date),
      expect.any(Date),
      { dryRun: false }
    );
    expect(updateRun).toHaveBeenCalledTimes(1);
  });
});
