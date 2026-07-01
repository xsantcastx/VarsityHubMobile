/**
 * Render smoke test for the react-query-migrated Team Admin screen
 * (app/team-admin.tsx). Verifies the useQuery wiring mounts and renders the
 * admin summary, and that Team.adminSummary() is called with the resolved
 * team id.
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
  useLocalSearchParams: () => ({ teamId: 't1' }),
  // The screen imports useFocusEffect from 'expo-router' (not
  // @react-navigation/native); expo-router's real implementation needs a live
  // navigationRef which doesn't exist in this render-only harness. Route it
  // through useEffect like reactNavigationOverrides() does, so the cleanup
  // function it returns still runs on unmount.
  useFocusEffect: (cb: () => void | (() => void)) => {
    require('react').useEffect(() => cb(), [cb]);
  },
}));

const mockAdminSummary = jest.fn();
const mockManaged = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: {
    managed: (...args: any[]) => mockManaged(...args),
    adminSummary: (...args: any[]) => mockAdminSummary(...args),
    cancelInvite: jest.fn(),
  },
  TeamMemberships: {
    update: jest.fn(),
    searchUsers: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// Team-management gate: mock as already resolved/allowed so the test exercises
// the react-query admin summary rather than the guard's redirect placeholder.
jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => ({ canManage: true, loading: false }),
}));

import TeamAdminScreen from '../team-admin';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleSummary = {
  team: {
    id: 't1',
    name: 'Tigers',
    sport: 'Basketball',
    season: '2026',
    description: null,
    organization: null,
  },
  permissions: { can_manage: true },
  counts: { members: 1, staff: 1, pending_invites: 0, upcoming_games: 0 },
  members: [
    {
      id: 'm1',
      role: 'player',
      status: 'active',
      user: { id: 'u1', display_name: 'Alex Player', username: 'alexp' },
    },
  ],
  pending_invites: [],
  upcoming_games: [],
};

beforeEach(() => {
  mockAdminSummary.mockReset().mockResolvedValue(sampleSummary);
  mockManaged.mockReset().mockResolvedValue([]);
});

describe('TeamAdminScreen (react-query render smoke)', () => {
  it('mounts, runs the admin-summary query, and renders the team', async () => {
    render(
      <QueryWrapper>
        <TeamAdminScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockAdminSummary).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(screen.getAllByText('Tigers').length).toBeGreaterThan(0));
  });
});
