/**
 * Simple Redis cache-aside helper.
 * Falls back silently to no-cache if Redis is unavailable.
 */

type RedisClient = import('ioredis').default;

let redisClientPromise: Promise<RedisClient | null> | null = null;
let warned = false;

async function getClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!redisClientPromise) {
    redisClientPromise = import('ioredis')
      .then(({ default: Redis }) => {
        const RedisCtor = Redis as unknown as new (
          url: string,
          opts?: {
            maxRetriesPerRequest?: number;
            enableReadyCheck?: boolean;
            lazyConnect?: boolean;
            db?: number;
          }
        ) => RedisClient;
        // Use Redis DB 2 for cache (DB 0 = BullMQ, DB 1 = rate limiting)
        return new RedisCtor(url, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: true,
          db: 2,
        });
      })
      .catch(err => {
        if (!warned) {
          warned = true;
          console.warn('[cache] Failed to initialize Redis client:', (err as any)?.message || err);
        }
        return null;
      });
  }

  const client = await redisClientPromise;
  if (!client) return null;

  try {
    if (client.status !== 'ready') await client.connect();
    return client;
  } catch {
    return null;
  }
}

/**
 * Get a value from cache. Returns null on miss or Redis unavailability.
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  try {
    const client = await getClient();
    if (!client) return null;
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set a value in cache with TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Silently fail — cache is optional
  }
}

/**
 * Delete a cache key (e.g. on write/mutation).
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await client.del(key);
  } catch {
    // Silently fail
  }
}

/**
 * Delete all keys matching a pattern (e.g. "user:*" on profile update).
 * Use sparingly — SCAN is O(N) on keyspace.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== '0');
  } catch {
    // Silently fail
  }
}
