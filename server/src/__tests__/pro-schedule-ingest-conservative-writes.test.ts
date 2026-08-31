import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTeamFindMany = jest.fn();
const mockTeamUpsert = jest.fn();
const mockEventFindMany = jest.fn();
const mockEventCreateMany = jest.fn();
const mockEventCreate = jest.fn();
const mockEventUpdate = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    proTeam: {
      findMany: mockTeamFindMany,
      upsert: mockTeamUpsert,
    },
    event: {
      findMany: mockEventFindMany,
      createMany: mockEventCreateMany,
      create: mockEventCreate,
      update: mockEventUpdate,
    },
  },
}));

const { ingestFixtures } = await import('../lib/proSchedule/ingest.js');

describe('ingestFixtures conservative writes', () => {
  beforeEach(() => {
    mockTeamFindMany.mockReset();
    mockTeamUpsert.mockReset();
    mockEventFindMany.mockReset();
    mockEventCreateMany.mockReset();
    mockEventCreate.mockReset();
    mockEventUpdate.mockReset();
  });

  it('skips updates when provider-owned fields are unchanged', async () => {
    mockTeamFindMany.mockResolvedValue([
      {
        id: 'team-1',
        external_ref: 'nfl:home',
        name: 'Home Team',
        short_name: 'Home',
        venue_name: 'Home Stadium',
        venue_address: '1 Main St',
        venue_lat: 33.1,
        venue_lng: -112.2,
        timezone: 'America/Phoenix',
      },
      {
        id: 'team-2',
        external_ref: 'nfl:away',
        name: 'Away Team',
        short_name: 'Away',
        venue_name: 'Away Stadium',
        venue_address: '2 Main St',
        venue_lat: 34.1,
        venue_lng: -113.2,
        timezone: 'America/Phoenix',
      },
    ]);
    const startsAt = new Date('2026-09-09T00:00:00.000Z');
    mockEventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        pro_external_ref: 'nfl:game-1',
        title: 'Away at Home',
        date: startsAt,
        timezone: 'America/Phoenix',
        location: 'Home Stadium, 1 Main St',
        latitude: 33.1,
        longitude: -112.2,
        pro_home_team_id: 'team-1',
        pro_away_team_id: 'team-2',
        live_window_hours_after_start: 4,
        status: 'approved',
      },
    ]);

    const stats = await ingestFixtures('nfl', [
      {
        external_ref: 'nfl:game-1',
        league: 'nfl',
        starts_at: startsAt,
        home_team_ref: 'nfl:home',
        away_team_ref: 'nfl:away',
        status: 'scheduled',
      },
    ]);

    expect(stats.updated).toBe(1);
    expect(stats.created).toBe(0);
    expect(stats.skipped).toBe(0);
    expect(mockEventUpdate).not.toHaveBeenCalled();
    expect(mockEventCreateMany).not.toHaveBeenCalled();
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it('batches creates with createMany for new fixtures', async () => {
    mockTeamFindMany.mockResolvedValue([
      {
        id: 'team-1',
        external_ref: 'nfl:home',
        name: 'Home Team',
        short_name: 'Home',
        venue_name: 'Home Stadium',
        venue_address: '1 Main St',
        venue_lat: 33.1,
        venue_lng: -112.2,
        timezone: 'America/Phoenix',
      },
    ]);
    mockEventFindMany.mockResolvedValue([]);
    mockEventCreateMany.mockResolvedValue({ count: 2 });

    const stats = await ingestFixtures('nfl', [
      {
        external_ref: 'nfl:game-1',
        league: 'nfl',
        starts_at: new Date('2026-09-09T00:00:00.000Z'),
        home_team_ref: 'nfl:home',
        away_team_ref: null,
        title: 'Home Team Special',
        status: 'scheduled',
      },
      {
        external_ref: 'nfl:game-2',
        league: 'nfl',
        starts_at: new Date('2026-09-10T00:00:00.000Z'),
        home_team_ref: 'nfl:home',
        away_team_ref: null,
        title: 'Home Team Special 2',
        status: 'scheduled',
      },
    ]);

    expect(stats.created).toBe(2);
    expect(stats.updated).toBe(0);
    expect(stats.skipped).toBe(0);
    expect(mockEventCreateMany).toHaveBeenCalledTimes(1);
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it('upserts provider NCAA teams before resolving college fixtures', async () => {
    mockTeamFindMany.mockResolvedValueOnce([
      {
        id: 'ncaaf:espn-1',
        external_ref: 'ncaaf:espn-1',
        name: 'Home University',
        short_name: 'Home',
        venue_name: null,
        venue_address: null,
        venue_lat: null,
        venue_lng: null,
        timezone: null,
      },
      {
        id: 'ncaaf:espn-2',
        external_ref: 'ncaaf:espn-2',
        name: 'Away University',
        short_name: 'Away',
        venue_name: null,
        venue_address: null,
        venue_lat: null,
        venue_lng: null,
        timezone: null,
      },
    ]);
    mockTeamUpsert.mockResolvedValue({});
    mockEventFindMany.mockResolvedValue([]);
    mockEventCreateMany.mockResolvedValue({ count: 1 });

    const stats = await ingestFixtures('ncaaf', [
      {
        external_ref: 'ncaaf:game-1',
        league: 'ncaaf',
        starts_at: new Date('2026-09-09T00:00:00.000Z'),
        home_team_ref: 'ncaaf:espn-1',
        away_team_ref: 'ncaaf:espn-2',
        home_team: {
          external_ref: 'ncaaf:espn-1',
          name: 'Home University',
          short_name: 'Home',
          abbreviation: 'HOM',
          city: 'Home',
          state: null,
          conference: null,
          division: null,
          venue_name: null,
          venue_address: null,
          venue_lat: null,
          venue_lng: null,
          timezone: null,
          primary_color: '#112233',
        },
        away_team: {
          external_ref: 'ncaaf:espn-2',
          name: 'Away University',
          short_name: 'Away',
          abbreviation: 'AWY',
          city: 'Away',
          state: null,
          conference: null,
          division: null,
          venue_name: null,
          venue_address: null,
          venue_lat: null,
          venue_lng: null,
          timezone: null,
          primary_color: '#445566',
        },
        venue_name: 'College Stadium',
        venue_address: 'College Stadium, Home, ST',
        venue_lat: 35.1,
        venue_lng: -80.2,
        venue_is_neutral: true,
        status: 'scheduled',
      },
    ]);

    expect(mockTeamUpsert).toHaveBeenCalledTimes(2);
    expect(stats.created).toBe(1);
    expect(stats.skipped).toBe(0);
    expect(mockEventCreateMany).toHaveBeenCalledTimes(1);
  });
});
