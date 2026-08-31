/**
 * Render smoke test for the react-query-migrated Discover/Community screen
 * (app/(tabs)/discover/mobile-community.tsx). Verifies the games +
 * personalization queries mount after the InteractionManager deferral and an
 * upcoming game row renders.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('expo-linear-gradient', () =>
  require('@/test-utils/screenMocks').expoLinearGradientMock()
);
jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
}));
// Heavy children irrelevant to the query wiring under test.
jest.mock('@/components/EventMap', () =>
  require('@/test-utils/screenMocks').childSentinelMock('EventMap')()
);
jest.mock('@/components/PostCard', () =>
  require('@/test-utils/screenMocks').childSentinelMock('PostCard')()
);
jest.mock('@/components/QuickAddGameModal', () =>
  require('@/test-utils/screenMocks').childSentinelMock('QuickAddGameModal')()
);
jest.mock('@/components/SwipeBackContainer', () =>
  require('@/test-utils/screenMocks').childSentinelMock('SwipeBackContainer')()
);
jest.mock('react-native-calendars', () => ({
  Calendar: require('@/test-utils/screenMocks').hostPassthrough('Calendar'),
}));
jest.mock('../game-details/GameVerticalFeedScreen', () => ({
  __esModule: true,
  default: require('@/test-utils/screenMocks').hostPassthrough('GameVerticalFeedScreen'),
}));
jest.mock('@/hooks/useDeviceLocation', () => ({
  useDeviceLocation: () => ({
    location: null,
    loading: false,
    error: null,
    permissionGranted: false,
    requestPermission: jest.fn(),
    needsPreciseAccuracy: false,
    openSettings: jest.fn(),
  }),
}));

const mockGameList = jest.fn();
const mockEventFilter = jest.fn();
const mockTrendingPage = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Game: { list: (...args: any[]) => mockGameList(...args), create: jest.fn() },
  Event: { filter: (...args: any[]) => mockEventFilter(...args) },
  Post: {
    trendingPage: (...args: any[]) => mockTrendingPage(...args),
    listPage: jest.fn().mockResolvedValue({ items: [] }),
    list: jest.fn().mockResolvedValue([]),
  },
  Team: { allMembers: jest.fn().mockResolvedValue([]) },
  User: {
    listAll: jest.fn().mockResolvedValue([]),
    suggested: jest.fn().mockResolvedValue({ items: [] }),
    follow: jest.fn(),
    unfollow: jest.fn(),
  },
  Search: { unified: jest.fn().mockResolvedValue({}) },
  Organization: { list: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    checkAuth: jest.fn().mockResolvedValue({ id: 'u1', preferences: {} }),
  }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/authState', () => ({
  ...jest.requireActual('@/utils/authState'),
  getAuthSnapshot: jest.fn().mockResolvedValue({ id: 'u1', preferences: {} }),
  getCanonicalOrganizationId: jest.fn().mockReturnValue(null),
}));
jest.mock('@/utils/analytics', () => ({
  analytics: { track: jest.fn() },
  ANALYTICS_EVENTS: new Proxy({}, { get: (_t, p) => String(p) }),
}));

import MobileCommunityScreen from '../(tabs)/discover/mobile-community';
import { QueryWrapper } from '../../test-utils/screenMocks';

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const sampleGame = {
  id: 'g1',
  title: 'Tigers vs Sharks',
  date: tomorrow,
  location: 'Main Gym',
  home_team: 'Tigers',
  away_team: 'Sharks',
};

beforeEach(() => {
  mockGameList.mockReset().mockResolvedValue([sampleGame]);
  mockEventFilter.mockReset().mockResolvedValue([]);
  mockTrendingPage.mockReset().mockResolvedValue({ items: [] });
});

describe('MobileCommunityScreen (react-query render smoke)', () => {
  it('mounts, runs the games + personalization queries, and renders a game row', async () => {
    render(
      <QueryWrapper>
        <MobileCommunityScreen />
      </QueryWrapper>
    );
    // Queries are gated behind InteractionManager.runAfterInteractions.
    jest.runOnlyPendingTimers();
    await waitFor(() =>
      expect(mockGameList).toHaveBeenCalledWith(
        'date',
        expect.objectContaining({ dateFrom: expect.any(String), limit: 100 })
      )
    );
    await waitFor(() => expect(mockEventFilter).toHaveBeenCalled());
    await waitFor(() => expect(mockTrendingPage).toHaveBeenCalled());
    expect(await screen.findByText('Tigers vs Sharks')).toBeTruthy();
  });
});
