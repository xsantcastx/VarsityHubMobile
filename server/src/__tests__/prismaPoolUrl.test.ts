import { afterEach, describe, expect, it } from '@jest/globals';
import { withPoolLimits } from '../lib/prismaPoolUrl.js';

const BASE = 'postgresql://user:pass@host:5432/db';
const prod = { isTest: false, isProduction: true };
const test = { isTest: true, isProduction: false };
const dev = { isTest: false, isProduction: false };

const params = (url: string) => Object.fromEntries(new URL(url).searchParams.entries());

afterEach(() => {
  delete process.env.PRISMA_CONNECTION_LIMIT;
  delete process.env.PRISMA_POOL_TIMEOUT;
});

describe('withPoolLimits', () => {
  it('applies recommended production defaults when the URL has none', () => {
    expect(params(withPoolLimits(BASE, prod))).toEqual({
      connection_limit: '20',
      pool_timeout: '10',
    });
  });

  it('respects explicit params already in the URL (never overrides)', () => {
    const url = `${BASE}?connection_limit=8&pool_timeout=3`;
    expect(params(withPoolLimits(url, prod))).toEqual({
      connection_limit: '8',
      pool_timeout: '3',
    });
  });

  it('honors PRISMA_CONNECTION_LIMIT / PRISMA_POOL_TIMEOUT overrides in production', () => {
    process.env.PRISMA_CONNECTION_LIMIT = '30';
    process.env.PRISMA_POOL_TIMEOUT = '15';
    expect(params(withPoolLimits(BASE, prod))).toEqual({
      connection_limit: '30',
      pool_timeout: '15',
    });
  });

  it('caps test clients to a single connection', () => {
    expect(params(withPoolLimits(BASE, test))).toEqual({
      connection_limit: '1',
      pool_timeout: '20',
    });
  });

  it('leaves the URL untouched in development', () => {
    expect(withPoolLimits(BASE, dev)).toBe(BASE);
  });

  it('returns the raw string when it is not a parseable URL', () => {
    const dsn = 'not a url';
    expect(withPoolLimits(dsn, prod)).toBe(dsn);
  });
});
