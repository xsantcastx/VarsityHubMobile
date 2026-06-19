/**
 * Reusable screen-render mock factories.
 *
 * Large screens (FeedScreen, ProfileScreen, …) pull in a wide surface of
 * native/Expo modules and heavy children that don't matter for a render smoke
 * test. Each factory below returns a jest module mock so a test can wire one in
 * with a single line:
 *
 *   jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
 *
 * The factory is `require`d *inside* the jest.mock callback so it respects
 * jest's hoisting rules (no out-of-scope variable capture). Keeping the factory
 * bodies here means the next screen test reuses them instead of re-deriving the
 * same 20-line mock block.
 */
import React from 'react';

/** A host component that renders its children under a named host element. */
export const hostPassthrough = (name: string) => (props: any) =>
  React.createElement(name, props, props?.children);

export const expoImageMock = () => ({ Image: hostPassthrough('Image') });

export const expoLinearGradientMock = () => ({
  LinearGradient: hostPassthrough('LinearGradient'),
});

export const safeAreaMock = () => ({
  SafeAreaView: hostPassthrough('SafeAreaView'),
  SafeAreaProvider: hostPassthrough('SafeAreaProvider'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
});

/**
 * Hook overrides for @react-navigation/native. MUST be spread over the real
 * module — expo-router internally needs createNavigatorFactory et al., so a
 * wholesale replacement breaks the global expo-router mock. Usage:
 *
 *   jest.mock('@react-navigation/native', () => ({
 *     ...jest.requireActual('@react-navigation/native'),
 *     ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
 *   }));
 */
export const reactNavigationOverrides = () => ({
  // Route the focus callback through useEffect so React runs the cleanup it
  // returns on unmount. Screens commonly start intervals/subscriptions in
  // useFocusEffect and clean them up in the returned function — discarding that
  // cleanup leaks an open handle and prevents Jest from exiting.
  useFocusEffect: (cb: () => void | (() => void)) => {
    React.useEffect(() => cb(), [cb]);
  },
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
});

export const expoImagePickerMock = () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
  MediaType: { Images: 'images', Videos: 'videos' },
});

export const expoImageManipulatorMock = () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'manip://out.jpg' }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
});

/**
 * Hook/Stack overrides for expo-router. Spread over the real module so the
 * navigator internals expo-router needs at import stay intact:
 *
 *   jest.mock('expo-router', () => ({
 *     ...jest.requireActual('expo-router'),
 *     ...require('@/test-utils/screenMocks').expoRouterOverrides(),
 *   }));
 */
export const expoRouterOverrides = () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  useUnstableGlobalHref: () => '',
  useSegments: () => [],
  usePathname: () => '/',
  Stack: Object.assign(hostPassthrough('Stack'), { Screen: () => null }),
  Link: hostPassthrough('Link'),
  Redirect: () => null,
});

/** Replace a heavy child screen/component with a named sentinel host element. */
export const childSentinelMock = (name: string) => () => ({
  __esModule: true,
  default: hostPassthrough(name),
});

/** Stub @/api/entities so its transitive @sentry/react-native import (which
 *  starts a leaking cleanup setInterval) never loads. Pass overrides for the
 *  entity methods a screen actually calls. */
export const apiEntitiesMock =
  (overrides: Record<string, any> = {}) =>
  () => ({
    __esModule: true,
    User: { me: jest.fn().mockResolvedValue(null), ...(overrides.User || {}) },
    Team: { managed: jest.fn().mockResolvedValue([]), ...(overrides.Team || {}) },
    Organization: { list: jest.fn().mockResolvedValue([]), ...(overrides.Organization || {}) },
    Post: { list: jest.fn().mockResolvedValue([]), ...(overrides.Post || {}) },
    Notification: {},
    ...overrides,
  });
