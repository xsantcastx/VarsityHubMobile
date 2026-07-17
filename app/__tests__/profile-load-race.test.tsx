/**
 * Regression test for the profile initial-load race.
 *
 * Tapping another user opened a screen showing the bare "Unable to load
 * profile" + Retry state for the WHOLE request, which read as a timeout but
 * reproduced on any network speed. Three effects race on mount in app/profile.tsx:
 * the username-sync effect had no mount guard, so it fired a `silent` load first
 * (lastUsernameRef starts null, so any signed-in username counts as "changed").
 * A silent load forces `loading` false and claims the in-flight guard, so the
 * deferred non-silent load never ran — leaving loading=false, me=null,
 * error=null, which falls through to the `!me` branch.
 *
 * The invariant: while the profile request is in flight and nothing has
 * resolved, the screen must NOT render the "Unable to load profile" state.
 */
import { render, waitFor } from '@testing-library/react-native';

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

// The initial load is deferred behind runAfterInteractions (so the push
// animation isn't competing with network parsing). Run it inline so the test
// doesn't depend on timer/interaction-queue flushing order.
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => {
  const actual = jest.requireActual('react-native/Libraries/Interaction/InteractionManager');
  return {
    ...actual,
    runAfterInteractions: (task: any) => {
      if (typeof task === 'function') task();
      return { cancel: () => {} };
    },
  };
});
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
}));

// Viewing SOMEONE ELSE's profile — the reported case. Your own profile resolves
// from the auth snapshot with no network, so it never showed the bug.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
  useLocalSearchParams: () => ({ id: 'other-user-1' }),
}));

// getPublic never settles: the screen is pinned in the in-flight state for the
// life of the test, which is exactly the window the bug rendered the error in.
const getPublic = jest.fn(() => new Promise(() => {}));
jest.mock('@/api/entities', () =>
  require('@/test-utils/screenMocks').apiEntitiesMock({
    User: { me: jest.fn().mockResolvedValue(null), getPublic },
  })()
);
jest.mock('@/api/upload', () => ({
  __esModule: true,
  default: { uploadFile: jest.fn() },
}));
jest.mock('../game-details/GameVerticalFeedScreen', () =>
  require('@/test-utils/screenMocks').childSentinelMock('GameVerticalFeedScreen')()
);

const mockUser = { id: 'me-1', username: 'me', display_name: 'Me' };
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

describe('profile.tsx initial-load race', () => {
  it('does not render "Unable to load profile" while the request is still in flight', async () => {
    const { queryByText } = render(
      <QueryWrapper>
        <ProfileScreen />
      </QueryWrapper>
    );

    // Let the mount effects (incl. InteractionManager.runAfterInteractions) run.
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(getPublic).toHaveBeenCalledWith('other-user-1');
    });

    // The request has not resolved. Showing the terminal error state here is
    // the bug: nothing has failed yet.
    expect(queryByText('Unable to load profile')).toBeNull();
  });
});
