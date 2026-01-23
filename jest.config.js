/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    'UTFSequence$': '<rootDir>/shims/UTFSequenceMock.js',
  },
  // Use ts-jest for TypeScript files (better ESM support), babel-jest for JS/JSX
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|expo-router|expo-asset|expo-constants|expo-font|expo-linking|expo-location|expo-notifications|expo-secure-store|expo-status-bar|expo-system-ui|expo-web-browser|expo-modules-core|@expo|@expo-google-fonts|react-clone-referenced-element|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-svg|react-native-web|react-native-worklets|@react-native-async-storage|@react-native-picker|@react-native-community|@sentry)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/server/', '/tests/'],
  watchman: false,
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false
    },
  },
};
