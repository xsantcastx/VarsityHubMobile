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
const mockPrograms = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: { managed: (...args: any[]) => mockManaged(...args) },
  Organization: { programs: (...args: any[]) => mockPrograms(...args) },
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
import { groupTeamsByProgram } from '@/constants/programs';
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

const sampleOrg = { id: 'org1', name: 'Test Org' };

const groupedTeamA = {
  id: 't1',
  name: 'Varsity Tigers',
  members: 12,
  status: 'active',
  sport: 'Basketball',
  season: '2026',
  avatar_url: null,
  my_role: 'coach',
  level: 'varsity',
  program_id: 'prog1',
  organization: sampleOrg,
};

const groupedTeamB = {
  id: 't2',
  name: 'JV Tigers',
  members: 10,
  status: 'active',
  sport: 'Basketball',
  season: '2026',
  avatar_url: null,
  my_role: 'coach',
  level: 'jv',
  program_id: 'prog1',
  organization: sampleOrg,
};

const ungroupedTeam = {
  id: 't3',
  name: 'Club Squad',
  members: 8,
  status: 'active',
  sport: 'Soccer',
  season: '2026',
  avatar_url: null,
  my_role: 'coach',
  level: null,
  program_id: null,
  organization: sampleOrg,
};

beforeEach(() => {
  mockManaged.mockReset().mockResolvedValue([sampleTeam]);
  mockPrograms.mockReset().mockResolvedValue({
    programs: [{ id: 'prog1', sport: 'basketball', gender: 'girls', name: null, teams: [] }],
  });
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
    // Fully ungrouped org (no program_id on any team) keeps today's flat look —
    // no program section headers, no "Other teams" header.
    expect(screen.queryByText('Other teams')).toBeNull();
  });

  it('groups teams by program with a program header and an "Other teams" section', async () => {
    mockManaged.mockReset().mockResolvedValue([groupedTeamA, groupedTeamB, ungroupedTeam]);

    render(
      <QueryWrapper>
        <ManageTeamsScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockManaged).toHaveBeenCalled());

    expect(await screen.findByText('Girls Basketball')).toBeTruthy();
    expect(await screen.findByText('Varsity Tigers')).toBeTruthy();
    expect(await screen.findByText('JV Tigers')).toBeTruthy();
    expect(await screen.findByText('Other teams')).toBeTruthy();
    expect(await screen.findByText('Club Squad')).toBeTruthy();
  });
});

describe('groupTeamsByProgram', () => {
  it('orders grouped programs first (stable by first appearance) and ungrouped last', () => {
    const teams = [
      { id: 'a', program_id: 'p2' },
      { id: 'b', program_id: null },
      { id: 'c', program_id: 'p1' },
      { id: 'd', program_id: 'p2' },
      { id: 'e', program_id: null },
    ];

    const groups = groupTeamsByProgram(teams);

    expect(groups.map(g => g.programId)).toEqual(['p2', 'p1', null]);
    expect(groups[0].teams.map(t => t.id)).toEqual(['a', 'd']);
    expect(groups[1].teams.map(t => t.id)).toEqual(['c']);
    expect(groups[2].teams.map(t => t.id)).toEqual(['b', 'e']);
  });
});
