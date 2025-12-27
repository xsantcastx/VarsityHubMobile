import '@testing-library/jest-native/extend-expect';

// Polyfill import.meta for Expo SDK 54
globalThis.import = globalThis.import || {};
// @ts-ignore
globalThis.import.meta = globalThis.import.meta || { url: 'file:///', env: {} };

// Expo winter runtime expects this registry
(global as any).__EXPO_IMPORT_META_REGISTRY = (global as any).__EXPO_IMPORT_META_REGISTRY || {};

// Ensure structuredClone is available in test env
if (typeof (global as any).structuredClone !== 'function') {
  const { structuredClone } = require('util');
  (global as any).structuredClone = structuredClone;
}

// Mock Expo's __ExpoImportMetaRegistry to prevent winter module errors
// @ts-ignore
global.__ExpoImportMetaRegistry = {
  get: () => ({ url: 'file:///', env: {} }),
  set: () => {},
};

// Polyfill structuredClone if not available (required by Expo SDK 54)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Silence Expo Router warnings during tests where navigation isn't available.
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useSegments: () => [],
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Icon', props),
  };
});

// Mock sentry-expo to avoid expo-application import issues
jest.mock('sentry-expo', () => ({
  init: jest.fn(),
  Native: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    setContext: jest.fn(),
  },
}));

// Mock expo-image to avoid ESM transform issues in Jest
jest.mock('expo-image', () => {
  const React = require('react');
  return {
    Image: (props: any) => React.createElement('Image', props),
  };
});

// Mock expo-linear-gradient to avoid native dependencies during tests
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: (props: any) => React.createElement('View', props),
  };
});

// Mock expo-image-manipulator used in profile tests
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string, actions: any[], saveOptions: any) => ({ uri, base64: undefined })),
  ImageManipulator: {},
  useImageManipulator: jest.fn(),
}));

// Mock expo-image-picker used in profile tests
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ cancelled: false, assets: [{ uri: 'mock://image.jpg' }] })),
  launchCameraAsync: jest.fn(async () => ({ cancelled: false, assets: [{ uri: 'mock://camera.jpg' }] })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock expo-image to avoid ESM issues
jest.mock('expo-image', () => {
  const React = require('react');
  return {
    Image: (props: any) => React.createElement('Image', props),
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: (props: any) => React.createElement('View', props),
  };
});
