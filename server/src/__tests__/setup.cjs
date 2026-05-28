const path = require('node:path');
const fs = require('node:fs');
const { config } = require('dotenv');

// Mimic server/src/lib/load-env.ts without importing TS during tests.
const explicitEnvPath = process.env.VARSITYHUB_ENV_PATH
  ? path.resolve(process.env.VARSITYHUB_ENV_PATH)
  : path.resolve(__dirname, '../../.env');
if (fs.existsSync(explicitEnvPath)) {
  config({ path: explicitEnvPath });
}

process.env.NODE_ENV = 'test';
// Disable Redis in tests — the 60s TTL cache causes stale reads when tests
// mutate the DB directly (bypassing cache-invalidating API endpoints).
process.env.REDIS_URL = '';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/varsityhub_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum';
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || 'sk_test_test_test_test';
process.env.STRIPE_PUBLISHABLE_KEY =
  process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_test_test_test';
process.env.APP_URL = 'https://varsityhub.app';
process.env.APP_BASE_URL = 'https://varsityhub.app';

// Quiet console noise unless explicitly enabled.
if (!process.env.VERBOSE) {
  const noop = jest.fn();
  global.console = {
    ...console,
    log: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}

// Each Jest test file loads its own environment and may import ../lib/prisma.js.
// Relying only on globalTeardown leaves those Prisma clients open until the very
// end of the full run, which can exhaust Postgres connections before later specs
// start. Disconnect after every file so connection usage stays bounded.
afterAll(async () => {
  try {
    const prisma = globalThis.__VARSITYHUB_TEST_PRISMA__;
    if (prisma?.$disconnect) {
      await prisma.$disconnect();
    }
  } catch (_error) {
    // Ignore cleanup failures for specs that never touched Prisma.
  }
});
