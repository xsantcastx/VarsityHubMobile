import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { runEgressProbe } from '../lib/egressProbe.js';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('runEgressProbe', () => {
  it('reports every target reachable when connections resolve', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204 }) as unknown as typeof fetch;

    const { reachable, total, results } = await runEgressProbe(100);

    expect(total).toBeGreaterThanOrEqual(3); // google_maps, cloudinary, stripe (+ sentry if DSN set)
    expect(reachable).toBe(total);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('reports zero reachable (total egress loss) when every connection times out', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('fetch failed'), { cause: { code: 'ETIMEDOUT' } })
      ) as unknown as typeof fetch;

    const { reachable, results } = await runEgressProbe(100);

    expect(reachable).toBe(0);
    expect(results.every(r => !r.ok)).toBe(true);
    // The connect error code is preserved so the diagnostic detail is useful.
    expect(results[0].error).toContain('ETIMEDOUT');
  });

  it('reports partial degradation when only some targets fail', async () => {
    global.fetch = jest.fn().mockImplementation((url: unknown) =>
      String(url).includes('cloudinary')
        ? Promise.reject(new Error('connection refused'))
        : Promise.resolve({ status: 200 })
    ) as unknown as typeof fetch;

    const { reachable, total } = await runEgressProbe(100);

    expect(reachable).toBeGreaterThan(0);
    expect(reachable).toBeLessThan(total);
  });
});
