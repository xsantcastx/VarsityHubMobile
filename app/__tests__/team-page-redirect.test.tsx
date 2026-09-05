/**
 * team-page is the ONE canonical page for a sport (owner July-28). It no longer
 * redirects program teams to a separate program page — instead, when a team
 * belongs to a program with >1 sub-team, its Events tab renders a sub-team
 * picker (Boys Varsity, Boys JV, …) and tapping one shows that sub-team's
 * games. A lone-team program (or an ungrouped team) renders a plain team page.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
const mockProgramFollow = jest.fn();
const mockTeamFollow = jest.fn();
const mockProgramUnfollow = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: {
    screenSummary: (...args: any[]) => mockScreenSummary(...args),
    get: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    follow: (...args: any[]) => mockTeamFollow(...args),
    unfollow: jest.fn(),
    members: jest.fn().mockResolvedValue([]),
  },
  Program: {
    screenSummary: (...args: any[]) => mockProgramSummary(...args),
    follow: (...args: any[]) => mockProgramFollow(...args),
    unfollow: (...args: any[]) => mockProgramUnfollow(...args),
  },
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
  mockTeamFollow.mockReset().mockResolvedValue({});
  mockProgramFollow.mockReset().mockResolvedValue({});
  mockProgramUnfollow.mockReset().mockResolvedValue({});
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

  it('Follow on a program team follows the whole SPORT (Program.follow, not Team.follow)', async () => {
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: 'prog1' },
      members: [],
      games: [],
      permissions: { can_manage: false },
    });
    mockProgramSummary.mockResolvedValue({
      program: { id: 'prog1', sport: 'basketball', is_following: false, followers_count: 5 },
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

    const followBtn = await screen.findByLabelText('Follow sport');
    await act(async () => {
      fireEvent.press(followBtn);
    });
    await waitFor(() => expect(mockProgramFollow).toHaveBeenCalledWith('prog1'));
  });

  it('waits for delayed program metadata before allowing follow, then follows the whole sport', async () => {
    let resolveProgram!: (value: any) => void;
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: 'prog1' },
      members: [],
      games: [],
      permissions: { can_manage: false },
    });
    mockProgramSummary.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveProgram = resolve;
        })
    );
    render(
      <QueryWrapper>
        <TeamScreen />
      </QueryWrapper>
    );
    const button = await screen.findByTestId('team-page-follow-button');
    await waitFor(() => expect(mockProgramSummary).toHaveBeenCalledWith('prog1'));
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);
    // Invoke the component callback directly too: the handler must guard the
    // race independently of the native disabled-button behavior.
    const followPressable = screen.UNSAFE_root.findAll(
      (element: { props: { testID?: string; onPress?: () => Promise<void> } }) =>
        element.props.testID === 'team-page-follow-button' &&
        typeof element.props.onPress === 'function'
    )[0];
    expect(followPressable).toBeTruthy();
    await act(async () => {
      await followPressable.props.onPress();
    });
    expect(mockTeamFollow).not.toHaveBeenCalled();
    expect(mockProgramFollow).not.toHaveBeenCalled();
    await act(async () =>
      resolveProgram({
        program: { id: 'prog1', is_following: false },
        levels: [
          { level: 'varsity', team: { id: 'team1', gender: 'boys' }, games: [] },
          { level: 'jv', team: { id: 'team2', gender: 'boys' }, games: [] },
        ],
        counts: {},
      })
    );
    fireEvent.press(await screen.findByLabelText('Follow sport'));
    await waitFor(() => expect(mockProgramFollow).toHaveBeenCalledWith('prog1'));
    expect(mockTeamFollow).not.toHaveBeenCalled();
  });

  it('retries failed program metadata before allowing a single-level team follow', async () => {
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: 'prog1' },
      members: [],
      games: [],
      permissions: { can_manage: false },
    });
    mockProgramSummary.mockRejectedValue(new Error('Program unavailable'));
    render(
      <QueryWrapper>
        <TeamScreen />
      </QueryWrapper>
    );
    const retry = await screen.findByLabelText('Retry follow status');
    expect(screen.getByText('Could not load follow status. Tap to retry.')).toBeTruthy();
    expect(mockTeamFollow).not.toHaveBeenCalled();
    mockProgramSummary.mockResolvedValue({
      program: { id: 'prog1', is_following: false },
      levels: [{ level: 'varsity', team: { id: 'team1', gender: 'boys' }, games: [] }],
      counts: {},
    });
    fireEvent.press(retry);
    fireEvent.press(await screen.findByLabelText('Follow team'));
    await waitFor(() => expect(mockTeamFollow).toHaveBeenCalledWith('team1'));
    expect(mockProgramFollow).not.toHaveBeenCalled();
  });

  it.each([{ program: { id: 'prog1' } }, { program: { id: 'wrong-program' }, levels: [] }])(
    'retries malformed program metadata without falling through to Team.follow',
    async payload => {
      mockScreenSummary.mockResolvedValue({
        team: { ...baseTeam, program_id: 'prog1' },
        members: [],
        games: [],
        permissions: { can_manage: false },
      });
      mockProgramSummary.mockResolvedValue(payload);
      render(
        <QueryWrapper>
          <TeamScreen />
        </QueryWrapper>
      );
      fireEvent.press(await screen.findByLabelText('Retry follow status'));
      await waitFor(() => expect(mockProgramSummary.mock.calls.length).toBeGreaterThan(1));
      expect(mockTeamFollow).not.toHaveBeenCalled();
      expect(mockProgramFollow).not.toHaveBeenCalled();
    }
  );

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
