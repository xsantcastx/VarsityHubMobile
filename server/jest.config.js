const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const skipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const skipIntegrationTests = isCi || process.env.SKIP_SERVER_INTEGRATION_TESTS === '1';

const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true, tsconfig: { isolatedModules: true } }],
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.cjs'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '../lib/prisma\\.js$': '<rootDir>/src/lib/prisma.ts',
    '../lib/notifications\\.js$': '<rootDir>/src/lib/notifications.ts',
    '../lib/messageHelpers\\.js$': '<rootDir>/src/lib/messageHelpers.ts',
    '../middleware/requireAdmin\\.js$': '<rootDir>/src/middleware/requireAdmin.ts',
    '../middleware/requireAuth\\.js$': '<rootDir>/src/middleware/requireAuth.ts',
    './load-env\\.js$': '<rootDir>/src/lib/load-env.ts',
    './prisma\\.js$': '<rootDir>/src/lib/prisma.ts',
    './email\\.js$': '<rootDir>/src/lib/email.ts',
    './debugLog\\.js$': '<rootDir>/src/lib/debugLog.ts',
    './notificationHelpers\\.js$': '<rootDir>/src/lib/notificationHelpers.ts',
    './gameStories\\.js$': '<rootDir>/src/routes/gameStories.ts',
  },
  testTimeout: 10000,
  verbose: true,
  watchman: false,
};

config.testPathIgnorePatterns = config.testPathIgnorePatterns ?? [];
if (skipDbTests) {
  config.testPathIgnorePatterns.push(
    '<rootDir>/tests/organizations.test.ts',
    '<rootDir>/src/__tests__/adminReports.test.ts',
    '<rootDir>/src/__tests__/email-queue.test.ts'
  );
}
if (skipIntegrationTests) {
  config.testPathIgnorePatterns.push('<rootDir>/tests/auth-signin.integration.test.ts');
}

export default config;
