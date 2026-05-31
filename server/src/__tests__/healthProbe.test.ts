import { describe, expect, it, jest } from '@jest/globals';
import { runDatabaseHealthcheck } from '../lib/healthProbe.js';

describe('runDatabaseHealthcheck', () => {
  it('returns true when the query resolves before the timeout', async () => {
    const query = jest.fn(async () => 1);

    await expect(runDatabaseHealthcheck(query, 50)).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns false when the query rejects', async () => {
    const query = jest.fn(async () => {
      throw new Error('db down');
    });

    await expect(runDatabaseHealthcheck(query, 50)).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns false when the query hangs past the timeout', async () => {
    const query = jest.fn(
      () =>
        new Promise(() => {
          // Intentionally never resolves.
        })
    );

    const startedAt = Date.now();
    await expect(runDatabaseHealthcheck(query, 20)).resolves.toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(200);
  });
});
