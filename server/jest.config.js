export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  resolver: '<rootDir>/jest.resolver.cjs',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        isolatedModules: true,
        module: 'ESNext',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  roots: ['<rootDir>/src'],
  // 2 workers is the sweet spot for this suite (140+ ESM tests):
  // - more than 1 keeps suites isolated enough that Node's VM-modules registry
  //   doesn't collide on dynamic-imported modules (the "module is already
  //   linked" error pattern that surfaces with one shared registry).
  // - 2 keeps Postgres connection pressure bounded for the small subset of
  //   suites that actually touch Prisma.
  // Override with `--maxWorkers=N` if needed.
  // Do NOT pass `--runInBand` for the full sweep — it forces everything into
  // the same Jest process and re-introduces the cross-suite ESM collisions
  // that this config is specifically working around.
  maxWorkers: 2,
  testMatch: ['**/__tests__/**/*.(spec|test).ts', '**/?(*.)+(spec|test).ts'],
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
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.cjs',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^zod$': '<rootDir>/node_modules/zod/index.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 10000,
  verbose: true,
};
