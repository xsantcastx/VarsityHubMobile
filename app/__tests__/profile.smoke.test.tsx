/**
 * Render smoke test for the LIVE profile screen (app/profile.tsx — routed via
 * /profile and /(tabs)/profile/index.tsx). Proves the screen mounts and renders
 * a tree without crashing, via the shared screen harness (test-utils/screenMocks).
 *
 * (Replaces the former ProfileScreen.smoke.test.tsx, which exercised the now-deleted
 *  orphaned app/features/navigation/screens/ProfileScreen.tsx.)
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
jest.mock('../game-details/GameVerticalFeedScreen', () =>
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

import ProfileScreen from '../profile';
import { QueryWrapper } from '../../test-utils/screenMocks';

describe('profile.tsx (render smoke)', () => {
  it('mounts and renders a tree without crashing for an empty user', () => {
    mockUser = null;
    const { toJSON } = render(
      <QueryWrapper>
        <ProfileScreen />
      </QueryWrapper>
    );
    expect(toJSON()).toBeTruthy();
  });
});
