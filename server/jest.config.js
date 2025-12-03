export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true, tsconfig: { isolatedModules: true } }],
  },
  roots: ['<rootDir>/src'],
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
    '../middleware/requireAdmin\\.js$': '<rootDir>/src/middleware/requireAdmin.ts',
    '../middleware/requireAuth\\.js$': '<rootDir>/src/middleware/requireAuth.ts',
    './load-env\\.js$': '<rootDir>/src/lib/load-env.ts',
    './gameStories\\.js$': '<rootDir>/src/routes/gameStories.ts',
  },
  testTimeout: 10000,
  verbose: true,
};
