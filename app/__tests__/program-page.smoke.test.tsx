/**
 * Render test for the public program page (app/program-page.tsx) —
 * one-page-per-sport spec: a gender toggle appears only when both genders
 * exist, level chips only when the selected gender spans multiple levels,
 * games render as ONE merged level-tagged feed (no collapsible folders), and
 * there is no public "Team page" link. A single-team program renders a plain
 * feed with no controls.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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

describe('ProgramScreen (one page per sport)', () => {
  it('renders a gender toggle + level chips and one merged boys feed by default', async () => {
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockScreenSummary).toHaveBeenCalledWith('prog1'));
    expect(await screen.findByText('Basketball')).toBeTruthy();

    // A multi-team program keeps the PROGRAM badge (it aggregates >1 team).
    expect(screen.getByText('PROGRAM')).toBeTruthy();

    // Both genders exist → toggle renders, Boys selected first.
    expect(screen.getByTestId('program-gender-boys')).toBeTruthy();
    expect(screen.getByTestId('program-gender-girls')).toBeTruthy();

    // Boys span varsity + jv → chips render.
    expect(screen.getByTestId('program-level-chip-all')).toBeTruthy();
    expect(screen.getByTestId('program-level-chip-varsity')).toBeTruthy();
    expect(screen.getByTestId('program-level-chip-jv')).toBeTruthy();

    // Merged boys feed: BOTH boys games visible at once, level-tagged; the
    // girls game is not. No folders, no public team-page link.
    expect(await screen.findByText('vs Hawks')).toBeTruthy();
    expect(screen.getByText('vs Bears')).toBeTruthy();
    expect(screen.queryByText('vs Lions')).toBeNull();
    expect(screen.getByText('Varsity · Game')).toBeTruthy();
    expect(screen.getByText('JV · Game')).toBeTruthy();
    expect(screen.queryByText('Team page')).toBeNull();
  });

  it('switching gender swaps the feed; a level chip narrows it', async () => {
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );
    await screen.findByText('vs Hawks');

    fireEvent.press(screen.getByTestId('program-gender-girls'));
    expect(await screen.findByText('vs Lions')).toBeTruthy();
    expect(screen.queryByText('vs Hawks')).toBeNull();
    // Girls have a single level → no chips.
    expect(screen.queryByTestId('program-level-chip-all')).toBeNull();

    fireEvent.press(screen.getByTestId('program-gender-boys'));
    fireEvent.press(screen.getByTestId('program-level-chip-jv'));
    expect(await screen.findByText('vs Bears')).toBeTruthy();
    expect(screen.queryByText('vs Hawks')).toBeNull();
  });

  it('a single-team program renders a plain feed with no toggle and no chips', async () => {
    mockScreenSummary.mockReset().mockResolvedValue(singleTeamSummary);
    render(
      <QueryWrapper>
        <ProgramScreen />
      </QueryWrapper>
    );

    expect(await screen.findByText('vs Vacation')).toBeTruthy();
    expect(screen.queryByTestId('program-gender-coed')).toBeNull();
    expect(screen.queryByTestId('program-level-chip-all')).toBeNull();
    // Single team → plain schedule, so the PROGRAM badge is dropped.
    expect(screen.queryByText('PROGRAM')).toBeNull();
    // Single level → row subtitle is just the game type, no level tag.
    expect(screen.getByText('Game')).toBeTruthy();
  });

  it('renders the empty state when the program has no level teams', async () => {
    mockScreenSummary.mockReset().mockResolvedValue({
      ...twoGenderSummary,
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
