import { describe, expect, it } from '@jest/globals';
import { withDistributedLock } from '../lib/distributedLock.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('withDistributedLock (local fallback)', () => {
  it('deduplicates concurrent calls for the same key', async () => {
    const localLocks = new Map<string, Promise<any>>();
    let runs = 0;

    const task = async () => {
      runs += 1;
      await wait(40);
      return runs;
    };

    const [a, b, c] = await Promise.all([
      withDistributedLock(
        { namespace: 'payments', key: 'session_1', localLocks, forceLocal: true },
        task
      ),
      withDistributedLock(
        { namespace: 'payments', key: 'session_1', localLocks, forceLocal: true },
        task
      ),
      withDistributedLock(
        { namespace: 'payments', key: 'session_1', localLocks, forceLocal: true },
        task
      ),
    ]);

    expect(runs).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
  });

  it('allows separate keys to execute independently', async () => {
    const localLocks = new Map<string, Promise<any>>();
    let runs = 0;

    const runKey = (key: string) =>
      withDistributedLock(
        { namespace: 'payments', key, localLocks, forceLocal: true },
        async () => {
          runs += 1;
          await wait(10);
          return key;
        }
      );

    const [a, b] = await Promise.all([runKey('session_a'), runKey('session_b')]);

    expect(runs).toBe(2);
    expect(a).toBe('session_a');
    expect(b).toBe('session_b');
  });

  it('releases lock after failure so retries can proceed', async () => {
    const localLocks = new Map<string, Promise<any>>();
    let attempts = 0;

    await expect(
      withDistributedLock(
        { namespace: 'payments', key: 'session_fail', localLocks, forceLocal: true },
        async () => {
          attempts += 1;
          throw new Error('boom');
        }
      )
    ).rejects.toThrow('boom');

    const result = await withDistributedLock(
      { namespace: 'payments', key: 'session_fail', localLocks, forceLocal: true },
      async () => {
        attempts += 1;
        return 'ok';
      }
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });
});
