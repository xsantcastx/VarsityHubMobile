import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTeamFindMany = jest.fn();
const mockTeamCreateMany = jest.fn();
const mockTeamUpdate = jest.fn();
const mockIngestFixtures = jest.fn();
const mockIngestLeague = jest.fn();
const mockEspnAdapter = jest.fn();
const mockGetWindowDays = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    proTeam: {
      findMany: mockTeamFindMany,
      createMany: mockTeamCreateMany,
      update: mockTeamUpdate,
    },
  },
}));

jest.unstable_mockModule('../lib/proSchedule/ingest.js', () => ({
  ingestFixtures: mockIngestFixtures,
  ingestLeague: mockIngestLeague,
}));

jest.unstable_mockModule('../lib/proSchedule/espnAdapter.js', () => ({
  espnAdapter: mockEspnAdapter,
}));

jest.unstable_mockModule('../lib/proSchedule/window.js', () => ({
  getProScheduleWindowDays: mockGetWindowDays,
}));

const { runProSportsBootstrap } = await import('../startup/proSportsBootstrap.js');

describe('runProSportsBootstrap conservative loading', () => {
  beforeEach(() => {
    mockTeamFindMany.mockReset();
    mockTeamCreateMany.mockReset();
    mockTeamUpdate.mockReset();
    mockIngestFixtures.mockReset();
    mockIngestLeague.mockReset();
    mockEspnAdapter.mockReset();
    mockGetWindowDays.mockReset();
    mockGetWindowDays.mockReturnValue(30);
    mockEspnAdapter.mockReturnValue({ name: 'mock-espn' });
    mockIngestFixtures.mockResolvedValue({
      league: 'wwe',
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failures: [],
    });
    mockIngestLeague.mockResolvedValue({
      league: 'nfl',
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failures: [],
    });
  });

  afterEach(() => {
    delete process.env.PRO_SPORTS_BOOTSTRAP;
  });

  it('does not run when the bootstrap flag is disabled', async () => {
    process.env.PRO_SPORTS_BOOTSTRAP = '0';
    await runProSportsBootstrap();
    expect(mockTeamFindMany).not.toHaveBeenCalled();
    expect(mockIngestFixtures).not.toHaveBeenCalled();
    expect(mockIngestLeague).not.toHaveBeenCalled();
  });

  it('batches new seed inserts with createMany', async () => {
    process.env.PRO_SPORTS_BOOTSTRAP = '1';
    mockTeamFindMany.mockResolvedValue([]);
    mockTeamCreateMany.mockResolvedValue({ count: 0 });
    mockTeamUpdate.mockResolvedValue({});

    await runProSportsBootstrap();

    expect(mockTeamFindMany).toHaveBeenCalledTimes(1);
    expect(mockTeamCreateMany).toHaveBeenCalledTimes(1);
    expect(mockTeamUpdate).not.toHaveBeenCalled();
    expect(mockIngestFixtures).toHaveBeenCalledTimes(1);
    expect(mockIngestLeague).toHaveBeenCalledTimes(4);
  });
});
