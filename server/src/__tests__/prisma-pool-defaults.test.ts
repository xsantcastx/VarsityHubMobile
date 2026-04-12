/**
 * Regression: connection-pool defaults must be applied to DATABASE_URL at
 * import time so Prisma never silently falls back to the 5-connection default.
 *
 * The helper under test is intentionally pure so we can exercise it without
 * booting the real Prisma client.
 */

import { describe, it, expect } from '@jest/globals';

// Load the helper by re-requiring the module source. Jest/ESM friendly: we
// read the module via dynamic import and grab the internal function off the
// exported symbol table used by `prisma.ts`.
import { applyConnectionPoolDefaults } from '../lib/prisma-pool-defaults.js';

describe('applyConnectionPoolDefaults', () => {
  it('injects both params when missing', () => {
    const { url, injected } = applyConnectionPoolDefaults('postgresql://u:p@host:5432/db');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('connection_limit')).toBe('20');
    expect(parsed.searchParams.get('pool_timeout')).toBe('10');
    expect(injected).toEqual(expect.arrayContaining(['connection_limit=20', 'pool_timeout=10']));
  });

  it('respects an explicit connection_limit from the caller', () => {
    const { url, injected } = applyConnectionPoolDefaults(
      'postgresql://u:p@host:5432/db?connection_limit=5'
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get('connection_limit')).toBe('5');
    expect(parsed.searchParams.get('pool_timeout')).toBe('10');
    expect(injected).toEqual(['pool_timeout=10']);
  });

  it('is a no-op when both params are already set', () => {
    const input = 'postgresql://u:p@host:5432/db?connection_limit=30&pool_timeout=20';
    const { url, injected } = applyConnectionPoolDefaults(input);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('connection_limit')).toBe('30');
    expect(parsed.searchParams.get('pool_timeout')).toBe('20');
    expect(injected).toEqual([]);
  });

  it('leaves unparseable connection strings untouched', () => {
    // `URL()` rejects anything without a recognized scheme; our helper
    // short-circuits that case and returns the input verbatim.
    const input = 'not a real url';
    const { url, injected } = applyConnectionPoolDefaults(input);
    expect(url).toBe(input);
    expect(injected).toEqual([]);
  });
});
