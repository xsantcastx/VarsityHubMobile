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

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Icon', props),
  };
});
