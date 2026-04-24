/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.env.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/ui/(.*)$': '<rootDir>/components/ui/$1',
    '^@/components/ui/(.*)$': '<rootDir>/components/ui/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^@mocks$': '<rootDir>/__tests__/__mocks__',
    UTFSequence$: '<rootDir>/shims/UTFSequenceMock.js',
  },
  // Use ts-jest for TypeScript files (better ESM support), babel-jest for JS/JSX
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    // Allow all expo + expo-* packages plus react-native-* — these ship
    // their build outputs as ESM and Jest needs them transformed.
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|expo-[a-z-]+|@expo|@expo-google-fonts|react-clone-referenced-element|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-svg|react-native-web|react-native-worklets|@react-native-async-storage|@react-native-picker|@react-native-community|@sentry)/)',
  ],
  roots: [
    '<rootDir>/app',
    '<rootDir>/components',
    '<rootDir>/hooks',
    '<rootDir>/utils',
    '<rootDir>/api',
    '<rootDir>/context',
    '<rootDir>/constants',
    '<rootDir>/__tests__',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/server/',
    '/tests/',
    '/__tests__/__mocks__/',
    'onboarding.e2e.test.tsx',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules_corrupt/',
    '<rootDir>/node_modules_retry2/',
    '<rootDir>/node_modules_broken3/',
  ],
  watchman: false,
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false,
    },
  },
};
