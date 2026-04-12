import '../lib/load-env.js';

// Setup environment for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/varsityhub_test';

// Suppress console logs during tests unless in verbose mode
if (!process.env.VERBOSE) {
  // Only mock console if jest is available (test context)
  if (typeof jest !== 'undefined') {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }
}
