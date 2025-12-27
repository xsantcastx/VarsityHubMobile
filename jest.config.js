/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/(.*)$': '<rootDir>/$1',
    'UTFSequence$': '<rootDir>/shims/UTFSequenceMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|expo-router|expo-asset|expo-constants|expo-font|expo-linking|expo-location|expo-notifications|expo-secure-store|expo-status-bar|expo-system-ui|expo-web-browser|expo-modules-core|react-clone-referenced-element|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|@react-native-async-storage|@react-native-picker|@react-native-community)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/server/', '/tests/'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules.bak'],
  watchman: false,
};
