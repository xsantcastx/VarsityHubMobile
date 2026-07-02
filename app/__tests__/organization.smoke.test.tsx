/**
 * Render smoke test for the react-query-migrated Organization screen
 * (app/(tabs)/organization.tsx). Verifies the org-page aggregation query
 * mounts (org -> teams -> games) and renders the org name and a team row,
 * and that the dependent admin-summary query fires for admins.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
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
  useLocalSearchParams: () => ({ id: 'org1' }),
  useUnstableGlobalHref: () => '/organization?id=org1',
}));

const mockOrgGet = jest.fn();
const mockAdminSummary = jest.fn();
const mockTeamList = jest.fn();
const mockGameList = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Organization: {
    get: (...args: any[]) => mockOrgGet(...args),
    adminSummary: (...args: any[]) => mockAdminSummary(...args),
    reviewSummaries: jest.fn().mockResolvedValue([]),
  },
  Team: { list: (...args: any[]) => mockTeamList(...args) },
  Game: { list: (...args: any[]) => mockGameList(...args) },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
jest.mock('@/hooks/useCustomColorScheme', () => ({
  useCustomColorScheme: () => 'light',
}));

import OrganizationScreen from '../(tabs)/organization';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleOrg = {
  id: 'org1',
  name: 'Westside Athletics',
  is_following: false,
  can_manage: true,
  can_edit: true,
  followers_count: 3,
};

beforeEach(() => {
  mockOrgGet.mockReset().mockResolvedValue(sampleOrg);
  mockAdminSummary.mockReset().mockResolvedValue({
    counts: { pending_coach_requests: 2, pending_authorized_invites: 0 },
    requests: { authorized_invites: [] },
  });
  mockTeamList
    .mockReset()
    .mockResolvedValue([
      { id: 't1', name: 'Tigers', sport: 'Basketball', season: '2026', organization_id: 'org1' },
    ]);
  mockGameList.mockReset().mockResolvedValue([]);
});

describe('OrganizationScreen (react-query render smoke)', () => {
  it('mounts, runs the org-page query, renders org + team, and fetches the admin summary', async () => {
    render(
      <QueryWrapper>
        <OrganizationScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockOrgGet).toHaveBeenCalledWith('org1'));
    expect(await screen.findByText('Westside Athletics')).toBeTruthy();
    expect(await screen.findByText('Tigers')).toBeTruthy();
    // Dependent admin-summary query fires once the page payload marks the
    // viewer as an org admin.
    await waitFor(() => expect(mockAdminSummary).toHaveBeenCalledWith('org1'));
  });
});
