/**
 * team-page is the ONE canonical page for a sport (owner July-28). It no longer
 * redirects program teams to a separate program page — instead, when a team
 * belongs to a program with >1 sub-team, its Events tab renders a sub-team
 * picker (Boys Varsity, Boys JV, …) and tapping one shows that sub-team's
 * games. A lone-team program (or an ungrouped team) renders a plain team page.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('expo-linear-gradient', () =>
  require('@/test-utils/screenMocks').expoLinearGradientMock()
);
jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, any> = { id: 'team1' };

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
  useGlobalSearchParams: () => ({}),
  useUnstableGlobalHref: () => '',
  useSegments: () => [],
  usePathname: () => '/',
  Stack: Object.assign(require('@/test-utils/screenMocks').hostPassthrough('Stack'), {
    Screen: () => null,
  }),
  Link: require('@/test-utils/screenMocks').hostPassthrough('Link'),
  Redirect: () => null,
}));

jest.mock('../game-details/GameVerticalFeedScreen', () =>
  require('@/test-utils/screenMocks').childSentinelMock('GameVerticalFeed')()
);

const mockScreenSummary = jest.fn();
const mockProgramSummary = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: {
    screenSummary: (...args: any[]) => mockScreenSummary(...args),
    get: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    follow: jest.fn(),
    unfollow: jest.fn(),
    members: jest.fn().mockResolvedValue([]),
  },
  Program: { screenSummary: (...args: any[]) => mockProgramSummary(...args) },
  Game: { list: jest.fn().mockResolvedValue([]) },
  Post: { filter: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
jest.mock('@/hooks/useCustomColorScheme', () => ({
  useCustomColorScheme: () => 'light',
}));

import TeamScreen from '../team-page';
import { QueryWrapper } from '../../test-utils/screenMocks';

const baseTeam = { id: 'team1', name: 'Varsity Tigers', organization_id: 'org1' };

async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
}

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  mockScreenSummary.mockReset();
  mockProgramSummary
    .mockReset()
    .mockResolvedValue({ program: { id: 'prog1' }, levels: [], counts: {} });
  mockParams = { id: 'team1' };
});

describe('team-page is the canonical sport page (no redirect)', () => {
  it('a program team renders the sub-team picker in its Events tab — NO redirect', async () => {
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: 'prog1' },
      members: [],
      games: [],
      permissions: { can_manage: false },
    });
    mockProgramSummary.mockResolvedValue({
      program: { id: 'prog1', sport: 'basketball' },
      levels: [
        {
          level: 'varsity',
          team: { id: 'team1', gender: 'boys', name: 'Varsity Tigers' },
          games: [],
        },
        { level: 'jv', team: { id: 'team2', gender: 'boys', name: 'JV Tigers' }, games: [] },
      ],
      counts: { levels: 2, teams: 2, games: 0 },
    });

    render(
      <QueryWrapper>
        <TeamScreen />
      </QueryWrapper>
    );

    // Sub-team picker renders (no redirect to a separate program page).
    expect(await screen.findByTestId('team-subteam-team1')).toBeTruthy();
    expect(screen.getByTestId('team-subteam-team2')).toBeTruthy();
    await settle();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('an ungrouped team (no program_id) renders a plain team page, no picker, no redirect', async () => {
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: null },
      members: [],
      games: [],
      permissions: { can_manage: false },
    });

    render(
      <QueryWrapper>
        <TeamScreen />
      </QueryWrapper>
    );

    expect(await screen.findByText('Varsity Tigers')).toBeTruthy();
    expect(screen.queryByTestId('team-subteam-team1')).toBeNull();
    await settle();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
