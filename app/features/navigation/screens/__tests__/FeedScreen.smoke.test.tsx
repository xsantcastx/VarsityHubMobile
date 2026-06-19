/**
 * Render smoke test for FeedScreen via the shared screen harness
 * (test-utils/screenMocks). Proves the ~2.9k-line feed screen mounts and
 * renders a tree without crashing. Deep state assertions are intentionally
 * avoided — see ProfileScreen.smoke.test.tsx for the rationale.
 */
import { render } from '@testing-library/react-native';

// Fake timers so the screen's setInterval/setTimeout fallbacks (unread-count
// poll, fetch timeout races) never hold an open handle past the test.
beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

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
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
}));
jest.mock('@/api/entities', () => require('@/test-utils/screenMocks').apiEntitiesMock()());

// FeedScreen-specific deps.
jest.mock('@react-navigation/bottom-tabs', () => ({
  ...jest.requireActual('@react-navigation/bottom-tabs'),
  useBottomTabBarHeight: () => 0,
}));
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  Accuracy: { Balanced: 3 },
}));
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  createURL: jest.fn((p: string) => `vh://${p}`),
}));
jest.mock('@/components/BannerAd', () =>
  require('@/test-utils/screenMocks').childSentinelMock('BannerAd')()
);
jest.mock('@/components/PostCard', () =>
  require('@/test-utils/screenMocks').childSentinelMock('PostCard')()
);
jest.mock('../../../../game-details/GameVerticalFeedScreen', () =>
  require('@/test-utils/screenMocks').childSentinelMock('GameVerticalFeedScreen')()
);

let mockUser: any = null;
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    checkAuth: jest.fn().mockResolvedValue(mockUser),
  }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

import FeedScreen from '../FeedScreen';

describe('FeedScreen (render smoke)', () => {
  it('mounts and renders a tree without crashing for an empty user', () => {
    mockUser = null;
    const { toJSON, unmount } = render(<FeedScreen />);
    expect(toJSON()).toBeTruthy();
    // Explicit unmount so focus-effect cleanups (e.g. the unread-count
    // setInterval) run and no open handle leaks past the test.
    unmount();
  });
});
