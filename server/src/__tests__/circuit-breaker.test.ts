/**
 * Unit tests for the outbound circuit breaker (server/src/lib/circuitBreaker.ts).
 * Pure unit — no DB, no network.
 */
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  CircuitOpenError,
  runWithBreaker,
  getCircuitStats,
  __resetCircuitBreakersForTest,
} from '../lib/circuitBreaker.js';

afterEach(() => {
  __resetCircuitBreakersForTest();
});

describe('runWithBreaker', () => {
  it('returns the wrapped function result on success', async () => {
    const result = await runWithBreaker('ok-upstream', async () => 42);
    expect(result).toBe(42);
  });

  it('propagates the underlying error when the breaker is closed', async () => {
    await expect(
      runWithBreaker('err-upstream', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });

  it('opens the circuit after repeated failures and then fails fast with CircuitOpenError', async () => {
    const name = 'flaky-upstream';
    const fail = () =>
      runWithBreaker(
        name,
        async () => {
          throw new Error('upstream down');
        },
        { volumeThreshold: 2, errorThresholdPercentage: 50, resetTimeout: 10_000 }
      ).catch((e) => e);

    // Drive enough failures through the rolling window to trip the breaker.
    let lastError: any;
    for (let i = 0; i < 6; i++) {
      lastError = await fail();
    }

    // Once open, calls fail fast with CircuitOpenError (not the raw error).
    expect(lastError).toBeInstanceOf(CircuitOpenError);
    expect(lastError.isCircuitOpen).toBe(true);
    expect(lastError.circuit).toBe(name);

    const stats = getCircuitStats().find((s) => s.name === name);
    expect(stats?.open).toBe(true);
  });

  it('does not trip the breaker for errors excluded by errorFilter (e.g. 4xx)', async () => {
    const name = 'business-error-upstream';
    const callWith4xx = () =>
      runWithBreaker(
        name,
        async () => {
          const err: any = new Error('invalid recipient');
          err.code = 422;
          throw err;
        },
        {
          volumeThreshold: 2,
          errorThresholdPercentage: 50,
          resetTimeout: 10_000,
          // 4xx => expected business failure, must not open the circuit.
          errorFilter: (err: any) => typeof err?.code === 'number' && err.code >= 400 && err.code < 500,
        }
      ).catch((e) => e);

    let lastError: any;
    for (let i = 0; i < 6; i++) {
      lastError = await callWith4xx();
    }

    // The raw 422 keeps propagating — the breaker never opens.
    expect(lastError).not.toBeInstanceOf(CircuitOpenError);
    expect(lastError.code).toBe(422);

    const stats = getCircuitStats().find((s) => s.name === name);
    expect(stats?.open).toBe(false);
  });
});
