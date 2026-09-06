const explicitlySkipDbTests = process.env.SKIP_SERVER_DB_TESTS === '1';

if (explicitlySkipDbTests) {
  throw new Error('SKIP_SERVER_DB_TESTS=1 is forbidden; DB-backed suites are release gates.');
}

export const shouldSkipDbTests = false;
export const describeDb = describe;
