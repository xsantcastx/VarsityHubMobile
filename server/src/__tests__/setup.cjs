const path = require('node:path');
const fs = require('node:fs');
const { config } = require('dotenv');

// Mimic server/src/lib/load-env.ts without importing TS during tests.
const candidatePaths = [path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '../../.env')];
for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath });
  break;
}

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/varsityhub_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-test-jwt-secret-test-jwt-secret';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-test-refresh-secret';

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

afterAll(async () => {
  try {
    const mod = await import('../lib/prisma.js');
    await mod.prisma.$disconnect();
  } catch (_error) {
    // Ignore cleanup errors in test teardown.
  }
});
