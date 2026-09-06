/**
 * Regression: getBlockedUserIds with a per-request cache must dedupe
 * concurrent + sequential lookups for the same viewer to a single DB hit.
 *
 * Pure unit-style — mocks `prisma.blockedUser.findMany` to count invocations.
 */

import { describe, it, expect, jest } from '@jest/globals';

const findManyMock = jest.fn(async () => [
  { blocker_id: 'viewer-1', blocked_id: 'blocked-a' },
  { blocker_id: 'blocked-b', blocked_id: 'viewer-1' },
]);

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    blockedUser: {
      findMany: findManyMock,
    },
  },
}));

// Keep the unit pure: no real Redis — distributed cache always misses.
jest.unstable_mockModule('../lib/cache.js', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
  cacheDel: jest.fn(async () => undefined),
}));

const { getBlockedUserIds, getRequestBlockedCache, invalidateBlockedIdsCache } =
  await import('../lib/privacyUtils.js');

describe('getBlockedUserIds — request-scoped cache', () => {
  beforeEach(() => {
    findManyMock.mockClear();
    // Cross-request in-process fallback persists at module scope — reset
    // between tests so each test observes its own DB hit pattern.
    invalidateBlockedIdsCache('viewer-1');
    invalidateBlockedIdsCache('viewer-2');
  });

  it('hits the DB once per request when called multiple times for the same viewer', async () => {
    const req = {} as { _blockedCache?: Map<string, Promise<string[]>> };
    const cache = getRequestBlockedCache(req);

    const a = await getBlockedUserIds('viewer-1', cache);
    const b = await getBlockedUserIds('viewer-1', cache);
    const c = await getBlockedUserIds('viewer-1', cache);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.sort()).toEqual(['blocked-a', 'blocked-b']);
  });

  it('dedupes concurrent lookups via the in-flight promise (no race)', async () => {
    const req = {} as { _blockedCache?: Map<string, Promise<string[]>> };
    const cache = getRequestBlockedCache(req);

    const [a, b, c] = await Promise.all([
      getBlockedUserIds('viewer-1', cache),
      getBlockedUserIds('viewer-1', cache),
      getBlockedUserIds('viewer-1', cache),
    ]);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('separate requests read fresh block state without a process TTL', async () => {
    const req1 = {} as { _blockedCache?: Map<string, Promise<string[]>> };
    const req2 = {} as { _blockedCache?: Map<string, Promise<string[]>> };

    await getBlockedUserIds('viewer-1', getRequestBlockedCache(req1));
    await getBlockedUserIds('viewer-1', getRequestBlockedCache(req2));

    expect(findManyMock).toHaveBeenCalledTimes(2);
  });

  it('invalidation forces the next lookup back to the DB', async () => {
    await getBlockedUserIds('viewer-1');
    invalidateBlockedIdsCache('viewer-1');
    await getBlockedUserIds('viewer-1');

    expect(findManyMock).toHaveBeenCalledTimes(2);
  });

  it('returns [] without hitting the DB when viewerId is null', async () => {
    const req = {} as { _blockedCache?: Map<string, Promise<string[]>> };
    const result = await getBlockedUserIds(null, getRequestBlockedCache(req));

    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('separates different viewers in the same request', async () => {
    const req = {} as { _blockedCache?: Map<string, Promise<string[]>> };
    const cache = getRequestBlockedCache(req);

    await getBlockedUserIds('viewer-1', cache);
    await getBlockedUserIds('viewer-2', cache);
    await getBlockedUserIds('viewer-1', cache); // cached
    await getBlockedUserIds('viewer-2', cache); // cached

    expect(findManyMock).toHaveBeenCalledTimes(2);
  });
});
