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
  globalSetup: '<rootDir>/src/__tests__/globalSetup.cjs',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.cjs'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '../lib/env\\.js$': '<rootDir>/src/lib/env.ts',
    '\\.\\./lib/env\\.js$': '<rootDir>/src/lib/env.ts',
    '\\./lib/env\\.js$': '<rootDir>/src/lib/env.ts',
    '../lib/prisma\\.js$': '<rootDir>/src/lib/prisma.ts',
    '../lib/jwt\\.js$': '<rootDir>/src/lib/jwt.ts',
    '../lib/geofencing\\.js$': '<rootDir>/src/lib/geofencing.ts',
    '../lib/notifications\\.js$': '<rootDir>/src/lib/notifications.ts',
    '../lib/messageHelpers\\.js$': '<rootDir>/src/lib/messageHelpers.ts',
    '../middleware/requireAdmin\\.js$': '<rootDir>/src/middleware/requireAdmin.ts',
    '../middleware/requireAuth\\.js$': '<rootDir>/src/middleware/requireAuth.ts',
    '\\./geofence-telemetry\\.js$': '<rootDir>/src/lib/geofence-telemetry.ts',
    '\\.\\./lib/geofence-telemetry\\.js$': '<rootDir>/src/lib/geofence-telemetry.ts',
    '../middleware/auth\\.js$': '<rootDir>/src/middleware/auth.ts',
    './load-env\\.js$': '<rootDir>/src/lib/load-env.ts',
    './prisma\\.js$': '<rootDir>/src/lib/prisma.ts',
    './email\\.js$': '<rootDir>/src/lib/email.ts',
    './debugLog\\.js$': '<rootDir>/src/lib/debugLog.ts',
    './notificationHelpers\\.js$': '<rootDir>/src/lib/notificationHelpers.ts',
    './gameStories\\.js$': '<rootDir>/src/routes/gameStories.ts',
    '\\.\\./src/__tests__/testApp\\.js$': '<rootDir>/src/__tests__/testApp.ts',
    '\\.\\./middleware/auth\\.js$': '<rootDir>/src/middleware/auth.ts',
    '\\.\\./routes/auth\\.js$': '<rootDir>/src/routes/auth.ts',
    '\\.\\./lib/appleAuth\\.js$': '<rootDir>/src/lib/appleAuth.ts',
    '\\./sentry\\.js$': '<rootDir>/src/lib/sentry-stub.ts',
    // Generic: resolve .js imports to .ts (Node ESM style) — required for tests/ and src/ ESM
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    // Transform ESM packages that break when run as CJS (default ignores all node_modules)
    'node_modules/(?!(supertest|undici)/)',
  ],
  testTimeout: 10000,
  verbose: true,
  watchman: false,
};

config.testPathIgnorePatterns = config.testPathIgnorePatterns ?? [];
config.testPathIgnorePatterns.push(
  '<rootDir>/src/__tests__/testApp.ts',
  '<rootDir>/src/__tests__/globalTeardown.cjs',
  '<rootDir>/src/__tests__/setup.cjs'
);
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
