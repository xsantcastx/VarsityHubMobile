import '../lib/load-env.js';

// Setup environment for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/varsityhub_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_test_test_test';
process.env.STRIPE_PUBLISHABLE_KEY =
  process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_test_test_test';

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
