/**
 * Render smoke test for the react-query-migrated Manage Teams screen
 * (app/(tabs)/manage-teams.tsx). Verifies the useQuery wiring mounts and
 * renders the managed teams list, and that Team.managed() is called with the
 * expected mapping.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

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
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
  // The screen imports useFocusEffect from 'expo-router' (not
  // @react-navigation/native); expo-router's real implementation needs a live
  // navigationRef which doesn't exist in this render-only harness. Route it
  // through useEffect like reactNavigationOverrides() does, so the cleanup
  // function it returns still runs on unmount.
  useFocusEffect: (cb: () => void | (() => void)) => {
    require('react').useEffect(() => cb(), [cb]);
  },
}));

const mockManaged = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: { managed: (...args: any[]) => mockManaged(...args) },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    checkAuth: jest.fn().mockResolvedValue({ id: 'u1', preferences: {} }),
  }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// Team-management gate: mock as already resolved/allowed so the test exercises
// the react-query teams list rather than the guard's redirect placeholder.
jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => ({ canManage: true, loading: false }),
}));
jest.mock('@/utils/authState', () => ({
  getAuthSnapshot: jest.fn().mockResolvedValue({ id: 'u1', preferences: {} }),
}));

import ManageTeamsScreen from '../(tabs)/manage-teams';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleTeam = {
  id: 't1',
  name: 'Tigers',
  members: 12,
  status: 'active',
  sport: 'Basketball',
  season: '2026',
  avatar_url: null,
  my_role: 'coach',
  organization: null,
};

beforeEach(() => {
  mockManaged.mockReset().mockResolvedValue([sampleTeam]);
});

describe('ManageTeamsScreen (react-query render smoke)', () => {
  it('mounts, runs the managed-teams query, and renders the team', async () => {
    render(
      <QueryWrapper>
        <ManageTeamsScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockManaged).toHaveBeenCalled());
    expect(await screen.findByText('Tigers')).toBeTruthy();
  });
});
