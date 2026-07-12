import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard for the "rate limiters silently fall back to in-process
 * MemoryStore in production" bug.
 *
 * Original defect: the dedicated rate-limit Redis client was built inside an
 * async function started with fire-and-forget. Its first `await import('ioredis')`
 * deferred the `redisStore` assignment to a microtask that ran AFTER every
 * limiter const was already constructed, so each limiter captured `store:
 * undefined` and fell back to express-rate-limit's per-process MemoryStore —
 * counters reset on every deploy and multiplied per replica.
 *
 * These are source-structure assertions (no Redis / prod env needed, so they
 * run in the normal suite without flakiness). They fail if someone reintroduces
 * the async-init pattern or drops the per-limiter prefixing.
 */
const rateLimitersSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'rateLimiters.ts'),
  'utf8'
);

describe('rate limiters are Redis-backed in production (no async-init regression)', () => {
  it('does NOT build the Redis client in a fire-and-forget async init', () => {
    // The exact shape of the original bug.
    expect(rateLimitersSrc).not.toMatch(/async function initializeRateLimitRedis/);
    expect(rateLimitersSrc).not.toMatch(/initializeRateLimitRedis\(\)\s*\.catch/);
  });

  it('creates the rate-limit Redis client synchronously, guarded by production + REDIS_URL', () => {
    expect(rateLimitersSrc).toMatch(
      /process\.env\.REDIS_URL\s*&&\s*process\.env\.NODE_ENV === 'production'/
    );
    expect(rateLimitersSrc).toMatch(/rateLimitRedis = new Redis\(process\.env\.REDIS_URL/);
    // Synchronous static import, not a dynamic import assignment. (Matches the
    // buggy `const X = await import('ioredis')` shape, not the doc comment that
    // references the old pattern in prose.)
    expect(rateLimitersSrc).toMatch(/^import \{ Redis \} from 'ioredis';/m);
    expect(rateLimitersSrc).not.toMatch(/=\s*await import\('ioredis'\)/);
  });

  it('gives each limiter its own RedisStore with a name-scoped prefix (no shared-counter collision)', () => {
    expect(rateLimitersSrc).toMatch(/function buildStore\(name: string\)/);
    // eslint-disable-next-line no-template-curly-in-string
    expect(rateLimitersSrc).toMatch(/prefix: `rl:\$\{name\}:`/);
  });

  it('every limiter routes its store through buildStore(name)', () => {
    expect(rateLimitersSrc).toMatch(/const store = buildStore\(name\)/);
    expect(rateLimitersSrc).toMatch(/\.\.\.\(store \? \{ store \} : \{\}\)/);
  });
});
