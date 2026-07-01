/**
 * Render smoke test for the react-query-migrated Manage Users screen
 * (app/manage-users.tsx). Verifies the useQuery wiring mounts, runs the
 * org/team aggregation fan-out, and renders a member row.
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
}));

const mockReviewSummaries = jest.fn();
const mockOrgAdminSummary = jest.fn();
const mockManaged = jest.fn();
const mockTeamAdminSummary = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Organization: {
    reviewSummaries: (...args: any[]) => mockReviewSummaries(...args),
    adminSummary: (...args: any[]) => mockOrgAdminSummary(...args),
  },
  Team: {
    managed: (...args: any[]) => mockManaged(...args),
    adminSummary: (...args: any[]) => mockTeamAdminSummary(...args),
  },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// Team-management gate: mock as already resolved/allowed so the test exercises
// the react-query users list rather than the guard's redirect placeholder.
jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => ({ canManage: true, loading: false }),
}));

import ManageUsersScreen from '../manage-users';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleTeam = { id: 't1', name: 'Tigers' };
const sampleTeamSummary = {
  team: sampleTeam,
  members: [
    {
      id: 'm1',
      role: 'coach',
      status: 'active',
      user: { id: 'user1', display_name: 'Jane Coach', email: 'jane@example.com' },
    },
  ],
  pending_invites: [],
};

beforeEach(() => {
  mockReviewSummaries.mockReset().mockResolvedValue([]);
  mockOrgAdminSummary.mockReset().mockResolvedValue(null);
  mockManaged.mockReset().mockResolvedValue([sampleTeam]);
  mockTeamAdminSummary.mockReset().mockResolvedValue(sampleTeamSummary);
});

describe('ManageUsersScreen (react-query render smoke)', () => {
  it('mounts, runs the aggregation query, and renders a member row', async () => {
    render(
      <QueryWrapper>
        <ManageUsersScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockManaged).toHaveBeenCalled());
    expect(await screen.findByText('Jane Coach')).toBeTruthy();
  });
});
