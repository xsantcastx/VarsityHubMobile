import { describe } from '@jest/globals';

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const explicitlySkipDbTests = process.env.SKIP_SERVER_DB_TESTS === '1';

if (isCi && explicitlySkipDbTests) {
  throw new Error(
    'SKIP_SERVER_DB_TESTS=1 is forbidden under CI; DB-backed suites are release gates.'
  );
}

export const shouldSkipDbTests = explicitlySkipDbTests;
export const describeDb = shouldSkipDbTests ? describe.skip : describe;
