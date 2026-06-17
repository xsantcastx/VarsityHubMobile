import { describe, expect, it } from '@jest/globals';
import { withDistributedLock, runClusterOnce } from '../lib/distributedLock.js';

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

describe('runClusterOnce (no Redis = single instance)', () => {
  it('runs the task and reports it ran when there is no Redis', async () => {
    let ran = false;
    const result = await runClusterOnce('backfill-x', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(result).toBe(true);
  });

  it('propagates errors thrown by the task (does not swallow them as skips)', async () => {
    await expect(
      runClusterOnce('failing-task', async () => {
        throw new Error('task blew up');
      })
    ).rejects.toThrow('task blew up');
  });
});
