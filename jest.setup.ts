import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'jest-device',
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[TEST]' }),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-application', () => ({
  applicationName: 'VarsityHub',
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

// Provide Expo OS for modules that expect it during import.
process.env.EXPO_OS = process.env.EXPO_OS || 'ios';

// Silence Expo Router warnings during tests where navigation isn't available.
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useSegments: () => [],
  };
});

// Prevent expo-router entry from trying to access dev server info in tests.
jest.mock('expo-router/entry', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', null),
  };
});

jest.mock('expo-router/entry-classic', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', null),
  };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const MockIcon = (props: any) => React.createElement('Icon', props);
  return { __esModule: true, default: MockIcon };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const gestureHandler = require('react-native-gesture-handler/jestSetup');

  const passthrough = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children);

  return {
    ...gestureHandler,
    GestureHandlerRootView: passthrough,
    PanGestureHandler: passthrough,
    TapGestureHandler: passthrough,
  };
});

// @sentry/react-native starts an AsyncExpiringMap cleanup setInterval at import
// time (utils/sentry.ts -> import * as Sentry). That timer is created before any
// test's fake-timers/beforeAll runs, so it leaks an open handle and prevents Jest
// from exiting cleanly. No client test asserts on Sentry behavior (EventMap mocks
// @/utils/sentry locally, which takes precedence), so stub the whole package with
// a Proxy of no-ops — any Sentry.x() / new Sentry.X() becomes a harmless no-op and
// the real timer never starts.
jest.mock('@sentry/react-native', () => {
  const noop = function () {} as any;
  return new Proxy(
    {},
    {
      get: () => noop,
    }
  );
});
