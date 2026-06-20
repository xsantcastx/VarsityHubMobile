import { validateTeam, validateTeamArray, validateTeamScreenSummary } from '@/api/schemas/team';
import { captureException } from '@/utils/sentry';

jest.mock('@/utils/sentry', () => ({
  captureException: jest.fn(),
}));

const captureExceptionMock = captureException as jest.MockedFunction<typeof captureException>;

const baseTeam = {
  id: 'team_1',
  name: 'Varsity Tigers',
  description: 'Test team',
  status: 'active',
  sport: 'basketball',
  club_type: null,
  extracurricular_category: null,
  season: null,
  season_start: null,
  season_end: null,
  logo_url: null,
  avatar_url: null,
  primary_color: null,
  is_private: false,
  city: 'Raleigh',
  state: 'NC',
  league: null,
  venue_place_id: null,
  venue_lat: null,
  venue_lng: null,
  venue_address: null,
  organization_id: null,
  created_at: null,
};

describe('team response schema validation', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('preserves unknown fields on valid payloads', () => {
    const payload = {
      ...baseTeam,
      organization_name: 'School Org',
      nested_extra: { enabled: true },
    };

    const result = validateTeam('teams.get', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('reports schema drift and fails open on invalid payloads', () => {
    const payload = {
      ...baseTeam,
      is_private: 'nope',
      server_only_hint: 'keep me',
    };

    const result = validateTeam('teams.get', payload);

    expect(result).toBe(payload);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0]?.[1]).toMatchObject({
      tags: {
        context: 'response_shape_drift',
        entity: 'team',
        endpoint: 'teams.get',
      },
    });
  });

  it('validates team arrays without mutating items', () => {
    const payload = [{ ...baseTeam, adhoc_field: 'present' }];

    const result = validateTeamArray('teams.list', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  // Regression: the /screen-summary endpoint returns counts WITHOUT `followers`.
  // `followers` is now optional, so this must validate cleanly (was the source of
  // the recurring "Team response schema drift at teams.screenSummary" events).
  it('accepts a screen-summary payload whose counts omit followers (no drift)', () => {
    const payload = {
      team: baseTeam,
      permissions: { can_manage: true },
      counts: { members: 2, games: 3 },
      members: [],
      games: [],
    };

    const result = validateTeamScreenSummary('teams.screenSummary', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('still accepts a screen-summary payload that includes followers', () => {
    const payload = {
      team: baseTeam,
      permissions: { can_manage: false },
      counts: { members: 1, followers: 9, games: 0 },
      members: [],
      games: [],
    };

    const result = validateTeamScreenSummary('teams.screenSummary', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
