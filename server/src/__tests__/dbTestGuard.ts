import { describe } from '@jest/globals';

const isCi = String(process.env.CI ?? '').toLowerCase() === 'true';
export const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
export const describeDb = shouldSkipDbTests ? describe.skip : describe;
