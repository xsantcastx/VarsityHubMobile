/**
 * Render + interaction smoke test for the react-query-migrated Team Join
 * Requests screen. Verifies the useQuery list renders and the approve
 * useMutation fires and optimistically drops the row from the cache.
 */
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

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
  useLocalSearchParams: () => ({ teamId: 'team-1', teamName: 'Tigers' }),
}));

const getJoinRequests = jest.fn();
const approveJoinRequest = jest.fn().mockResolvedValue({ ok: true });
const rejectJoinRequest = jest.fn().mockResolvedValue({ ok: true });
jest.mock('@/api/entities', () => ({
  __esModule: true,
  TeamMemberships: {
    getJoinRequests: (...a: any[]) => getJoinRequests(...a),
    approveJoinRequest: (...a: any[]) => approveJoinRequest(...a),
    rejectJoinRequest: (...a: any[]) => rejectJoinRequest(...a),
  },
}));
jest.mock('@/hooks/useCustomColorScheme', () => ({ useCustomColorScheme: () => 'light' }));
// Staff-only screen is gated by the membership-aware useRequireTeamManagement
// (role-barrier model: reviewing join requests is an authorized-user function,
// so manager/assistant_coach memberships are admitted, not just coaches).
// Mock it to "allowed" so this smoke test exercises the react-query
// list/approve behavior it targets rather than the redirect placeholder.
jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => ({ canManage: true, loading: false }),
}));

import TeamJoinRequestsScreen from '../team-join-requests';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleRequest = {
  id: 'req-1',
  status: 'pending',
  created_at: '2026-06-01T00:00:00.000Z',
  user: { id: 'u9', display_name: 'Jamie Athlete', username: 'jamie' },
};

beforeEach(() => {
  getJoinRequests.mockReset().mockResolvedValue([sampleRequest]);
  approveJoinRequest.mockClear();
  rejectJoinRequest.mockClear();
});

describe('TeamJoinRequestsScreen (react-query)', () => {
  it('fetches with the team id and renders a pending request', async () => {
    render(
      <QueryWrapper>
        <TeamJoinRequestsScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(getJoinRequests).toHaveBeenCalledWith('team-1'));
    expect(await screen.findByText('Jamie Athlete')).toBeTruthy();
  });

  it('approving fires the mutation and drops the row from the cache', async () => {
    render(
      <QueryWrapper>
        <TeamJoinRequestsScreen />
      </QueryWrapper>
    );
    const approveBtn = await screen.findByLabelText('Approve Jamie Athlete');
    fireEvent.press(approveBtn);
    await waitFor(() => expect(approveJoinRequest).toHaveBeenCalledWith('req-1'));
    await waitFor(() => expect(screen.queryByText('Jamie Athlete')).toBeNull());
  });
});
