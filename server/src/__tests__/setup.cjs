const path = require('node:path');
const fs = require('node:fs');
const { config } = require('dotenv');

// Mimic server/src/lib/load-env.ts without importing TS during tests.
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath });
  break;
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/varsityhub_test';

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
