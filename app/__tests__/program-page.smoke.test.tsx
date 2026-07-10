/**
 * Render smoke test for the public program page (app/program-page.tsx).
 * Verifies the header renders the program label, both level folders render, the
 * first (default-expanded) folder's game title is visible while the second
 * (collapsed) folder's game title is not, and that levels:[] renders the empty
 * state.
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

import ProgramScreen from '../program-page';
import { QueryWrapper } from '../../test-utils/screenMocks';

const twoLevelSummary = {
  program: {
    id: 'prog1',
    organization_id: 'org1',
    sport: 'basketball',
    gender: 'girls',
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
      team: { id: 't1', name: 'Varsity Tigers', logo_url: null },
      games: [
        {
          id: 'g1',
          date: '2026-02-01T00:00:00.000Z',
          away_team: 'Lions',
          home_team_id: 't1',
          game_type: 'Game',
        },
      ],
    },
    {
      level: 'jv',
      team: { id: 't2', name: 'JV Tigers', logo_url: null },
      games: [
        {
          id: 'g2',
          date: '2026-02-05T00:00:00.000Z',
          away_team: 'Bears',
          home_team_id: 't2',
          game_type: 'Game',
        },
      ],
    },
  ],
  counts: { levels: 2, teams: 2, games: 2 },
};

beforeEach(() => {
  mockScreenSummary.mockReset().mockResolvedValue(twoLevelSummary);
});

describe('ProgramScreen (render smoke)', () => {
  it('renders the program title, both level folders, and only the first folder expanded', async () => {
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockScreenSummary).toHaveBeenCalledWith('prog1'));

    // Program label derived from sport + gender.
    expect(await screen.findByText('Girls Basketball')).toBeTruthy();

    // Both level headers render.
    expect(await screen.findByText('Varsity')).toBeTruthy();
    expect(await screen.findByText('JV')).toBeTruthy();

    // First folder expanded by default → its game is visible.
    expect(await screen.findByText('vs Lions')).toBeTruthy();

    // Second folder collapsed by default → its game is NOT rendered.
    expect(screen.queryByText('vs Bears')).toBeNull();
  });

  it('renders the empty state when the program has no level teams', async () => {
    mockScreenSummary.mockReset().mockResolvedValue({
      ...twoLevelSummary,
      levels: [],
      counts: { levels: 0, teams: 0, games: 0 },
    });

    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockScreenSummary).toHaveBeenCalledWith('prog1'));
    expect(await screen.findByText('No teams in this program yet')).toBeTruthy();
  });
});
