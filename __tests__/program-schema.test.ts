import { validateProgramScreenSummary } from '@/api/schemas/program';
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

function buildPayload(overrides: Record<string, any> = {}) {
  return {
    program: {
      id: 'program_1',
      organization_id: 'org_1',
      sport: 'basketball',
      gender: 'boys',
      name: null,
      logo_url: null,
      created_at: '2026-07-01T00:00:00.000Z',
      followers_count: 4,
      is_following: false,
      organization: { id: 'org_1', name: 'Central High' },
    },
    levels: [
      {
        level: 'varsity',
        team: { ...baseTeam, level: 'varsity' },
        games: [],
      },
      {
        level: null,
        team: { ...baseTeam, id: 'team_2', level: null },
        games: [],
      },
    ],
    counts: { levels: 2, teams: 2, games: 0 },
    ...overrides,
  };
}

describe('program response schema validation', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('accepts the real server screen-summary shape, including a null level and a null organization', () => {
    const payload = buildPayload({
      program: {
        ...buildPayload().program,
        organization: null,
      },
    });

    const result = validateProgramScreenSummary('program.screenSummary', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('preserves unknown extra fields on valid payloads (passthrough)', () => {
    const payload = buildPayload();
    (payload as any).program.future_field = 'keep me';
    (payload as any).extra_top_level = { enabled: true };

    const result = validateProgramScreenSummary('program.screenSummary', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('reports schema drift and fails open (returns payload unchanged) on invalid payloads', () => {
    const payload = buildPayload();
    (payload as any).program.followers_count = 'not-a-number';

    const result = validateProgramScreenSummary('program.screenSummary', payload);

    expect(result).toBe(payload);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0]?.[1]).toMatchObject({
      tags: {
        context: 'response_shape_drift',
        entity: 'program',
        endpoint: 'program.screenSummary',
      },
    });
  });
});
