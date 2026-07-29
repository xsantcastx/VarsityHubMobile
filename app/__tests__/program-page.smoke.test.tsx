/**
 * Render test for app/program-page.tsx, now a thin redirect shim (Phase 2,
 * owner July-28: ONE sport page = team-page). A program opens by redirecting to
 * its level/gender-first sub-team's team-page (Boys Varsity first), carrying
 * from=program. A program with no visible sub-teams shows a graceful empty state
 * instead of redirecting. There is NO rendering surface of its own anymore.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
  useLocalSearchParams: () => ({ id: 'prog1' }),
}));
jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('expo-linear-gradient', () =>
  require('@/test-utils/screenMocks').expoLinearGradientMock()
);
jest.mock('@/hooks/useCustomColorScheme', () => ({
  useCustomColorScheme: () => 'light',
  useColorScheme: () => 'light',
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

const mockScreenSummary = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Program: {
    screenSummary: (...args: any[]) => mockScreenSummary(...args),
    follow: jest.fn().mockResolvedValue({}),
    unfollow: jest.fn().mockResolvedValue({}),
  },
}));

// Spy on the single-team redirect while keeping safeGoBack real.
const mockReplaceAsRedirect = jest.fn();
jest.mock('@/utils/navigation', () => ({
  ...jest.requireActual('@/utils/navigation'),
  replaceAsRedirect: (...args: any[]) => mockReplaceAsRedirect(...args),
}));

import ProgramScreen from '../program-page';
import { QueryWrapper } from '../../test-utils/screenMocks';

const twoGenderSummary = {
  program: {
    id: 'prog1',
    organization_id: 'org1',
    sport: 'basketball',
    name: null,
    logo_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    followers_count: 3,
    is_following: false,
    organization: { id: 'org1', name: 'Test Org' },
  },
  levels: [
    {
      level: 'varsity',
      team: { id: 't2', name: 'Girls Varsity', gender: 'girls', logo_url: null },
      games: [
        {
          id: 'g2',
          date: '2026-02-05T00:00:00.000Z',
          away_team: 'Lions',
          home_team_id: 't2',
          game_type: 'Game',
        },
      ],
    },
    {
      level: 'varsity',
      team: { id: 't1', name: 'Boys Varsity', gender: 'boys', logo_url: null },
      games: [
        {
          id: 'g1',
          date: '2026-02-01T00:00:00.000Z',
          away_team: 'Hawks',
          home_team_id: 't1',
          game_type: 'Game',
        },
      ],
    },
    {
      level: 'jv',
      team: { id: 't3', name: 'Boys JV', gender: 'boys', logo_url: null },
      games: [
        {
          id: 'g3',
          date: '2026-02-08T00:00:00.000Z',
          away_team: 'Bears',
          home_team_id: 't3',
          game_type: 'Game',
        },
      ],
    },
  ],
  counts: { levels: 3, teams: 3, games: 3 },
};

const singleTeamSummary = {
  ...twoGenderSummary,
  levels: [
    {
      level: 'other',
      team: { id: 't9', name: 'Soccer', gender: 'coed', logo_url: null },
      games: [
        {
          id: 'g9',
          date: '2026-07-12T00:00:00.000Z',
          away_team: 'Vacation',
          home_team_id: 't9',
          game_type: 'Game',
        },
      ],
    },
  ],
  counts: { levels: 1, teams: 1, games: 1 },
};

beforeEach(() => {
  mockScreenSummary.mockReset().mockResolvedValue(twoGenderSummary);
});

describe('program-page redirect shim (Phase 2: ONE sport page = team-page)', () => {
  it('a multi-team sport redirects to the level/gender-first sub-team’s team-page (Boys Varsity)', async () => {
    mockScreenSummary.mockReset().mockResolvedValue(twoGenderSummary);
    mockReplaceAsRedirect.mockClear();
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockReplaceAsRedirect).toHaveBeenCalled());
    const href = mockReplaceAsRedirect.mock.calls[0][1];
    expect(href.pathname).toBe('/team-page');
    // Boys Varsity (t1) sorts first (varsity before jv; boys before girls) — the
    // deterministic landing sub-team. from=program marks the deliberate open.
    expect(href.params).toMatchObject({ id: 't1', name: 'Boys Varsity', from: 'program' });
  });

  it('a single-team sport redirects to that team’s team-page', async () => {
    mockScreenSummary.mockReset().mockResolvedValue(singleTeamSummary);
    mockReplaceAsRedirect.mockClear();
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockReplaceAsRedirect).toHaveBeenCalled());
    const href = mockReplaceAsRedirect.mock.calls[0][1];
    expect(href.pathname).toBe('/team-page');
    expect(href.params).toMatchObject({ id: 't9', from: 'program' });
  });

  it('a program with no visible sub-teams shows a graceful empty state, no redirect', async () => {
    mockScreenSummary.mockReset().mockResolvedValue({
      ...twoGenderSummary,
      levels: [],
      counts: { levels: 0, teams: 0, games: 0 },
    });
    mockReplaceAsRedirect.mockClear();
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockScreenSummary).toHaveBeenCalledWith('prog1'));
    expect(await screen.findByText('This program isn’t available.')).toBeTruthy();
    expect(mockReplaceAsRedirect).not.toHaveBeenCalled();
  });
});
