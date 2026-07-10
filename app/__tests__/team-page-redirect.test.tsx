/**
 * Phase 3 Task 6 — team-page redirects legacy team links to the canonical
 * program page once the team's program is known.
 *
 * Rule under test (app/team-page.tsx): after the team loads, if
 * `team.program_id` is set AND the route did not arrive with `from=program`
 * (which would create a redirect loop back from program-page's own "Team
 * page" link), replace the current screen with `/program-page?id=<program>`.
 * The redirect must fire at most once per mount (useRef latch) and must
 * never fire while the query has no data yet, or when `program_id` is
 * null/undefined (legacy + ungrouped teams, and the OTA-safe default when
 * the server predates the Phase 0+1 program rollout).
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

// Stable mock fns (module scope) so calls made across re-renders accumulate
// on the same jest.fn() — the default expoRouterOverrides() factory mints a
// fresh useRouter() object (and therefore fresh jest.fn()s) on every render,
// which would make it impossible to assert "called exactly once" across the
// several renders a real query lifecycle produces.
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

// Heavy media child pulls in expo-video, which can't load under jest.
jest.mock('../game-details/GameVerticalFeedScreen', () =>
  require('@/test-utils/screenMocks').childSentinelMock('GameVerticalFeed')()
);

const mockScreenSummary = jest.fn();
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

const baseTeam = {
  id: 'team1',
  name: 'Varsity Tigers',
  organization_id: 'org1',
};

async function settle() {
  // Give the screen several async turns so the query resolves and the
  // mirror/redirect effects run.
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
  mockParams = { id: 'team1' };
});

describe('team-page → program-page redirect', () => {
  it('redirects to the program page when the team has a program_id', async () => {
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: 'prog1' },
      members: [],
      games: [],
      permissions: { can_manage: false },
    });

    render(
      <QueryWrapper>
        <TeamScreen />
      </QueryWrapper>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/program-page',
      params: { id: 'prog1' },
    });

    // Latch: further render churn (query settling, focus effects, etc.) must
    // not fire the redirect a second time.
    await settle();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('does not redirect and renders the team page when program_id is null', async () => {
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

    await settle();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect when from=program even if program_id is set (no loop)', async () => {
    mockParams = { id: 'team1', from: 'program' };
    mockScreenSummary.mockResolvedValue({
      team: { ...baseTeam, program_id: 'prog1' },
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

    await settle();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
