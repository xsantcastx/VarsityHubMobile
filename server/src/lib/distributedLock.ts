import crypto from 'crypto';
type RedisClient = import('ioredis').default;

export interface DistributedLockOptions {
  namespace: string;
  key: string;
  ttlMs?: number;
  acquireTimeoutMs?: number;
  retryDelayMs?: number;
  localLocks?: Map<string, Promise<any>>;
  forceLocal?: boolean;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ACQUIRE_TIMEOUT_MS = 30 * 1000; // 30 seconds
const DEFAULT_RETRY_DELAY_MS = 150;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`;

let redisClientPromise: Promise<RedisClient | null> | null = null;
let redisWarned = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRedisClient(): Promise<RedisClient | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!redisClientPromise) {
    redisClientPromise = import('ioredis')
      .then(({ default: Redis }) => {
        const RedisCtor = Redis as unknown as new (
          url: string,
          options?: { maxRetriesPerRequest?: number; enableReadyCheck?: boolean; lazyConnect?: boolean }
        ) => RedisClient;
        return new RedisCtor(redisUrl, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: true,
        });
      })
      .catch((err) => {
        if (!redisWarned) {
          redisWarned = true;
          console.warn('[distributed-lock] Failed to initialize Redis client, falling back to local lock:', (err as any)?.message || err);
        }
        return null;
      });
  }

  const client = await redisClientPromise;
  if (!client) return null;

  try {
    if ((client as any).status === 'wait') {
      await (client as any).connect();
    }
    return client;
  } catch (err) {
    if (!redisWarned) {
      redisWarned = true;
      console.warn('[distributed-lock] Redis unavailable, falling back to local lock:', (err as any)?.message || err);
    }
    return null;
  }
}

async function releaseRedisLock(client: RedisClient, lockKey: string, token: string) {
  try {
    await (client as any).eval(RELEASE_SCRIPT, 1, lockKey, token);
  } catch (err) {
    console.warn('[distributed-lock] Failed to release Redis lock:', (err as any)?.message || err);
  }
}

async function renewRedisLock(client: RedisClient, lockKey: string, token: string, ttlMs: number) {
  try {
    await (client as any).eval(RENEW_SCRIPT, 1, lockKey, token, String(ttlMs));
  } catch (err) {
    console.warn('[distributed-lock] Failed to renew Redis lock:', (err as any)?.message || err);
  }
}

async function withLocalLock<T>(
  localLocks: Map<string, Promise<any>>,
  localKey: string,
  task: () => Promise<T>
): Promise<T> {
  const existing = localLocks.get(localKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => task())();
  localLocks.set(localKey, promise as Promise<any>);
  try {
    return await promise;
  } finally {
    localLocks.delete(localKey);
  }
}

async function executeWithOptionalRedisLock<T>(
  options: DistributedLockOptions,
  namespacedKey: string,
  task: () => Promise<T>
): Promise<T> {
  if (options.forceLocal) return task();

  const redis = await getRedisClient();
  if (!redis) return task();

  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const acquireTimeoutMs = options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const lockKey = `lock:${namespacedKey}`;
  const token = crypto.randomUUID();
  const deadline = Date.now() + acquireTimeoutMs;
  let acquired = false;

  while (Date.now() < deadline) {
    try {
      const result = await (redis as any).set(lockKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        acquired = true;
        break;
      }
    } catch (err) {
      if (!redisWarned) {
        redisWarned = true;
        console.warn('[distributed-lock] Redis set lock failed, falling back to local lock:', (err as any)?.message || err);
      }
      return task();
    }
    await sleep(retryDelayMs);
  }

  if (!acquired) {
    throw new Error(`Failed to acquire distributed lock for ${namespacedKey} within ${acquireTimeoutMs}ms`);
  }

  const renewEveryMs = Math.max(1000, Math.floor(ttlMs / 3));
  const renewTimer = setInterval(() => {
    void renewRedisLock(redis, lockKey, token, ttlMs);
  }, renewEveryMs);

  try {
    return await task();
  } finally {
    clearInterval(renewTimer);
    await releaseRedisLock(redis, lockKey, token);
  }
}

export async function withDistributedLock<T>(
  options: DistributedLockOptions,
  task: () => Promise<T>
): Promise<T> {
  const namespacedKey = `${options.namespace}:${options.key}`;

  if (options.localLocks) {
    return withLocalLock(options.localLocks, namespacedKey, () =>
      executeWithOptionalRedisLock(options, namespacedKey, task)
    );
  }

  return executeWithOptionalRedisLock(options, namespacedKey, task);
}

/**
 * Run `task` at most once per cluster: the first replica to acquire the lock
 * runs it; the others skip immediately (no wait, no throw) and return false.
 *
 * For startup-once work that must NOT run concurrently across Railway replicas
 * (scheduler repeatable-job reconfiguration, data backfills). With no Redis
 * (local dev) the task always runs — there's only one instance anyway.
 *
 * Returns true if this replica ran the task, false if another replica held the
 * lock and it was skipped.
 */
export async function runClusterOnce(
  key: string,
  task: () => Promise<void>,
  opts?: { namespace?: string; ttlMs?: number }
): Promise<boolean> {
  try {
    await withDistributedLock(
      {
        namespace: opts?.namespace ?? 'startup-once',
        key,
        ttlMs: opts?.ttlMs ?? 5 * 60 * 1000,
        // Try once and give up — a losing replica must not block startup.
        acquireTimeoutMs: 1,
      },
      task
    );
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Failed to acquire distributed lock')) {
      return false;
    }
    throw err;
  }
}

export function __resetDistributedLockStateForTests() {
  redisClientPromise = null;
  redisWarned = false;
}
