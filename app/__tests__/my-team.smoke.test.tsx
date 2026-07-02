/**
 * Render smoke test for the react-query-migrated My Team screen
 * (app/(tabs)/my-team.tsx). Verifies the chained queries mount — managed
 * teams resolve, the first team auto-selects, and its roster renders.
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
const mockMembers = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: {
    managed: (...args: any[]) => mockManaged(...args),
    members: (...args: any[]) => mockMembers(...args),
  },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// Team-management gate: mock as already resolved/allowed so the test exercises
// the react-query roster rather than the guard's redirect placeholder.
jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => ({ canManage: true, loading: false }),
}));

import MyTeamScreen from '../(tabs)/my-team';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleTeam = {
  id: 't1',
  name: 'Tigers',
  members: 1,
  status: 'active',
  sport: 'Basketball',
  season: '2026',
  avatar_url: null,
  my_role: 'coach',
  organization: null,
};

const sampleMember = {
  id: 'm1',
  role: 'player',
  status: 'active',
  position: 'Guard',
  jersey_number: '23',
  user: {
    id: 'user1',
    email: 'jane@example.com',
    display_name: 'Jane Player',
    avatar_url: null,
    username: 'janep',
    is_parent: false,
  },
};

beforeEach(() => {
  mockManaged.mockReset().mockResolvedValue([sampleTeam]);
  mockMembers.mockReset().mockResolvedValue([sampleMember]);
});

describe('MyTeamScreen (react-query render smoke)', () => {
  it('mounts, selects the first managed team, and renders its roster', async () => {
    render(
      <QueryWrapper>
        <MyTeamScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockManaged).toHaveBeenCalled());
    await waitFor(() => expect(mockMembers).toHaveBeenCalledWith('t1'));
    expect(await screen.findByText('Jane Player')).toBeTruthy();
  });
});
