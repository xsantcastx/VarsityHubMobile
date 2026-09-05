/**
 * Render smoke test for the LIVE profile screen (app/profile.tsx — routed via
 * /profile and /(tabs)/profile/index.tsx). Proves the screen mounts and renders
 * a tree without crashing, via the shared screen harness (test-utils/screenMocks).
 *
 * (Replaces the former ProfileScreen.smoke.test.tsx, which exercised the now-deleted
 *  orphaned app/features/navigation/screens/ProfileScreen.tsx.)
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
const mockPostsFailure = jest.fn().mockRejectedValue(new Error('AUDIT_NETWORK_DOWN'));

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
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  ...jest.requireActual('react-native/Libraries/Interaction/InteractionManager'),
  runAfterInteractions: (task: any) => {
    task();
    return { cancel: () => {} };
  },
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
}));
jest.mock('@/api/entities', () =>
  require('@/test-utils/screenMocks').apiEntitiesMock({
    User: { postsForProfile: mockPostsFailure, interactionsForProfile: mockPostsFailure },
    Team: { list: jest.fn().mockResolvedValue([]) },
  })()
);
jest.mock('@/api/upload', () => ({
  __esModule: true,
  default: { uploadFile: jest.fn() },
}));
jest.mock('../game-details/GameVerticalFeedScreen', () =>
  require('@/test-utils/screenMocks').childSentinelMock('GameVerticalFeedScreen')()
);

let mockUser: any = null;
const mockCheckAuth = jest.fn(async () => mockUser);
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    checkAuth: mockCheckAuth,
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

describe('Profile content request failure recovery', () => {
  it.each(['posts', 'replies', 'upvotes'])(
    'shows an error and successfully retries %s',
    async tab => {
      mockPostsFailure.mockReset().mockRejectedValue(new Error('AUDIT_NETWORK_DOWN'));
      mockUser = {
        id: 'audit-profile-user',
        username: 'audit',
        display_name: 'Audit Fan',
        role: 'fan',
        preferences: {},
      };
      const screen = render(
        <QueryWrapper>
          <ProfileScreen />
        </QueryWrapper>
      );
      await act(async () => {
        jest.runOnlyPendingTimers();
      });
      if (tab !== 'posts')
        fireEvent.press(screen.getByText(tab === 'replies' ? 'Replies' : 'Upvotes'));
      await waitFor(() => expect(mockPostsFailure).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText(`Unable to load ${tab}`)).toBeTruthy());
      expect(screen.queryByText(`No ${tab} yet`)).toBeNull();
      expect(screen.queryByText('AUDIT_NETWORK_DOWN')).toBeNull();
      mockPostsFailure.mockResolvedValueOnce({ items: [], nextCursor: null });
      fireEvent.press(screen.getByText('Retry'));
      await waitFor(() => expect(screen.queryByText(`No ${tab} yet`)).toBeTruthy());
      expect(screen.queryByText(`Unable to load ${tab}`)).toBeNull();
    }
  );
});
