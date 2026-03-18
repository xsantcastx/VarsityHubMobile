/**
 * Redis-backed rate limiting counters with in-memory fallback.
 *
 * Provides simple increment/get/delete operations keyed by string,
 * with TTL-based auto-expiry. Falls back to in-memory Maps when
 * Redis is unavailable (dev, no REDIS_URL, connection failure).
 */

import { debugLog } from './debugLog.js';

type RedisClient = import('ioredis').default;

let redisClient: RedisClient | null = null;
let initAttempted = false;

const KEY_PREFIX = 'authrl:';

async function getRedis(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;
  if (initAttempted) return null;
  initAttempted = true;

  const url = process.env.REDIS_URL;
  if (!url || process.env.NODE_ENV !== 'production') {
    debugLog('[redisRateLimit] No REDIS_URL or non-production — using in-memory fallback');
    return null;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const RedisCtor = Redis as unknown as new (url: string, opts?: any) => RedisClient;
    redisClient = new RedisCtor(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      lazyConnect: true,
    });
    await redisClient.connect();
    debugLog('[redisRateLimit] Redis connected for auth rate limiting');
    redisClient.on('error', (err) => {
      console.warn('[redisRateLimit] Redis error, falling back to memory:', err.message);
      redisClient = null;
    });
    return redisClient;
  } catch (err) {
    console.warn('[redisRateLimit] Failed to connect Redis, using in-memory fallback:', (err as Error).message);
    redisClient = null;
    return null;
  }
}

// In-memory fallback store: key -> { value: string (JSON), expiresAt: number }
const memStore = new Map<string, { value: string; expiresAt: number }>();
const MAX_MEM_KEYS = 10_000;

function memPrune() {
  if (memStore.size <= MAX_MEM_KEYS) return;
  const now = Date.now();
  for (const [k, v] of memStore) {
    if (v.expiresAt <= now) memStore.delete(k);
  }
  // If still too large, drop oldest
  if (memStore.size > MAX_MEM_KEYS) {
    const entries = [...memStore.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const remove = memStore.size - Math.floor(MAX_MEM_KEYS * 0.8);
    for (let i = 0; i < remove; i++) memStore.delete(entries[i][0]);
  }
}

/**
 * Get a JSON value from Redis (or memory fallback).
 * Returns null if key doesn't exist or is expired.
 */
export async function rlGet(key: string): Promise<string | null> {
  const fullKey = KEY_PREFIX + key;
  const redis = await getRedis();
  if (redis) {
    try {
      return await redis.get(fullKey);
    } catch {
      // fall through to memory
    }
  }
  const entry = memStore.get(fullKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(fullKey);
    return null;
  }
  return entry.value;
}

/**
 * Set a JSON value with TTL (milliseconds).
 */
export async function rlSet(key: string, value: string, ttlMs: number): Promise<void> {
  const fullKey = KEY_PREFIX + key;
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(fullKey, value, 'PX', ttlMs);
      return;
    } catch {
      // fall through to memory
    }
  }
  memPrune();
  memStore.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Delete a key.
 */
export async function rlDel(key: string): Promise<void> {
  const fullKey = KEY_PREFIX + key;
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(fullKey);
    } catch {
      // fall through
    }
  }
  memStore.delete(fullKey);
}

/**
 * Increment a counter stored as JSON field "attempts" with TTL.
 * Returns the new attempt count. Sets key if it doesn't exist.
 * Uses a Lua script for atomicity in Redis.
 */
export async function rlIncr(key: string, ttlMs: number): Promise<number> {
  const fullKey = KEY_PREFIX + key;
  const redis = await getRedis();
  if (redis) {
    try {
      // Atomic increment-or-create with TTL preservation
      const result = await redis.eval(
        `local c = redis.call('incr', KEYS[1])
         if c == 1 then redis.call('pexpire', KEYS[1], ARGV[1]) end
         return c`,
        1,
        fullKey,
        String(ttlMs),
      ) as number;
      return result;
    } catch {
      // fall through to memory
    }
  }
  memPrune();
  const entry = memStore.get(fullKey);
  const now = Date.now();
  if (!entry || entry.expiresAt <= now) {
    memStore.set(fullKey, { value: '1', expiresAt: now + ttlMs });
    return 1;
  }
  const newVal = parseInt(entry.value, 10) + 1;
  entry.value = String(newVal);
  return newVal;
}
