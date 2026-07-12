import { describe, it, expect } from '@jest/globals';
import { buildGamesCacheKey } from '../routes/games.js';

/**
 * Regression: the client recomputes `from` with millisecond precision on every
 * feed load, which made the raw-URL cache key unique per request and defeated
 * the 120s games cache (every feed load re-ran the full query). The key must be
 * stable across sub-hour `from` differences so repeated loads hit the cache.
 */
describe('buildGamesCacheKey', () => {
  it('is stable across millisecond/sub-hour differences in `from`', () => {
    const a = buildGamesCacheKey('anon', '/games?sort=date&limit=30&from=2026-07-09T05%3A28%3A00.154Z');
    const b = buildGamesCacheKey('anon', '/games?sort=date&limit=30&from=2026-07-09T05%3A31%3A47.902Z');
    expect(a).toBe(b);
  });

  it('still separates across different hours', () => {
    const h5 = buildGamesCacheKey('anon', '/games?from=2026-07-09T05%3A59%3A00.000Z');
    const h6 = buildGamesCacheKey('anon', '/games?from=2026-07-09T06%3A01%3A00.000Z');
    expect(h5).not.toBe(h6);
  });

  it('still separates by viewer scope and other params', () => {
    const anon = buildGamesCacheKey('anon', '/games?sort=date&from=2026-07-09T05%3A00%3A00.000Z');
    const user = buildGamesCacheKey('user:123', '/games?sort=date&from=2026-07-09T05%3A00%3A00.000Z');
    const desc = buildGamesCacheKey('anon', '/games?sort=-date&from=2026-07-09T05%3A00%3A00.000Z');
    expect(anon).not.toBe(user);
    expect(anon).not.toBe(desc);
  });

  it('leaves a URL without a `from` param unchanged aside from the prefix', () => {
    expect(buildGamesCacheKey('anon', '/games?sort=date&limit=30')).toBe(
      'games:anon:/games?sort=date&limit=30'
    );
  });
});
