/**
 * Render smoke test for ProfileScreen via the shared screen harness
 * (test-utils/screenMocks). Proves the 2.6k-line screen mounts and renders a
 * tree without crashing — catching import-time and render-time regressions that
 * tsc cannot see. Deep rendered-state assertions on a screen this size are
 * deliberately avoided: they are brittle and low-value relative to upkeep.
 */
import { render } from '@testing-library/react-native';

// Fake timers so any interval/timeout the screen starts never holds an open
// handle past the test.
beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('expo-linear-gradient', () =>
  require('@/test-utils/screenMocks').expoLinearGradientMock()
);
jest.mock('expo-image-picker', () => require('@/test-utils/screenMocks').expoImagePickerMock());
jest.mock('expo-image-manipulator', () =>
  require('@/test-utils/screenMocks').expoImageManipulatorMock()
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
jest.mock('@/api/upload', () => ({
  __esModule: true,
  default: { uploadFile: jest.fn() },
}));
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
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: mockUser, loading: false, error: null, refresh: jest.fn() }),
}));
jest.mock('@/hooks/useCustomColorScheme', () => ({
  useCustomColorScheme: () => 'light',
}));

import ProfileScreen from '../ProfileScreen';

describe('ProfileScreen (render smoke)', () => {
  it('mounts and renders a tree without crashing for an empty user', () => {
    mockUser = null;
    const { toJSON, unmount } = render(<ProfileScreen />);
    expect(toJSON()).toBeTruthy();
    // Explicit unmount so focus-effect cleanups run and no open handle leaks.
    unmount();
  });
});
