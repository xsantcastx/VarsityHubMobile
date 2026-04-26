import crypto from 'node:crypto';
import { signJwt, verifyJwt } from './jwt.js';
import { captureException, captureMessage } from './sentry.js';

type RedisClient = import('ioredis').default;

const DEFAULT_REVIEW_TOKEN_TTL_SECONDS = 48 * 60 * 60;
const REDIS_DB = 3;
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;

let redisClientPromise: Promise<RedisClient | null> | null = null;
let warnedAboutRedis = false;
const inMemoryConsumedTokens = new Map<string, number>();

export type ReviewTokenPayload = {
  jti?: string;
  exp?: number;
  iat?: number;
};

export type ConsumeReviewTokenResult = 'consumed' | 'already_used' | 'store_unavailable';

function shouldRequireDurableStore(): boolean {
  return process.env.NODE_ENV === 'production' && !isTestEnv;
}

function buildReplayKey(token: string, payload: ReviewTokenPayload): string {
  const jti = typeof payload.jti === 'string' ? payload.jti.trim() : '';
  if (jti) return `review-token:jti:${jti}`;
  const fingerprint = crypto.createHash('sha256').update(token).digest('hex');
  return `review-token:sha256:${fingerprint}`;
}

function getReplayTtlSeconds(payload: ReviewTokenPayload): number {
  if (typeof payload.exp === 'number') {
    const secondsRemaining = payload.exp - Math.floor(Date.now() / 1000);
    if (secondsRemaining > 0) return secondsRemaining;
  }
  return DEFAULT_REVIEW_TOKEN_TTL_SECONDS;
}

function pruneExpiredInMemoryTokens(nowMs: number) {
  for (const [key, expiresAtMs] of inMemoryConsumedTokens.entries()) {
    if (expiresAtMs <= nowMs) {
      inMemoryConsumedTokens.delete(key);
    }
  }
}

function consumeInMemoryReplayKey(key: string, ttlSeconds: number): ConsumeReviewTokenResult {
  const nowMs = Date.now();
  pruneExpiredInMemoryTokens(nowMs);

  const existingExpiry = inMemoryConsumedTokens.get(key);
  if (existingExpiry && existingExpiry > nowMs) {
    return 'already_used';
  }

  inMemoryConsumedTokens.set(key, nowMs + ttlSeconds * 1000);
  return 'consumed';
}

async function getRedisClient(): Promise<RedisClient | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!redisClientPromise) {
    redisClientPromise = import('ioredis')
      .then(({ default: Redis }) => {
        const RedisCtor = Redis as unknown as new (
          url: string,
          options?: {
            maxRetriesPerRequest?: number;
            enableReadyCheck?: boolean;
            lazyConnect?: boolean;
            db?: number;
          }
        ) => RedisClient;
        return new RedisCtor(redisUrl, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: true,
          db: REDIS_DB,
        });
      })
      .catch((error) => {
        if (!warnedAboutRedis) {
          warnedAboutRedis = true;
          console.warn('[review-tokens] Failed to initialize Redis client:', (error as Error)?.message || error);
        }
        return null;
      });
  }

  const client = await redisClientPromise;
  if (!client) return null;

  try {
    if (client.status !== 'ready') {
      await client.connect();
    }
    return client;
  } catch (error) {
    if (!warnedAboutRedis) {
      warnedAboutRedis = true;
      console.warn('[review-tokens] Redis unavailable:', (error as Error)?.message || error);
    }
    return null;
  }
}

export function signReviewToken<T extends Record<string, unknown>>(
  payload: T,
  expiresIn = '48h'
): string {
  return signJwt({ ...payload, jti: crypto.randomUUID() }, expiresIn);
}

export function verifyReviewToken<T extends Record<string, unknown>>(
  token: string
): (T & ReviewTokenPayload) | null {
  return verifyJwt<T & ReviewTokenPayload>(token);
}

export async function consumeReviewToken(
  token: string,
  payload: ReviewTokenPayload
): Promise<ConsumeReviewTokenResult> {
  const key = buildReplayKey(token, payload);
  const ttlSeconds = getReplayTtlSeconds(payload);
  const redis = await getRedisClient();
  const replayKeyKind = key.includes(':jti:') ? 'jti' : 'sha256';

  if (redis) {
    try {
      const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      if (result === 'OK') return 'consumed';
      captureMessage('Review token replay blocked', 'warning', {
        context: 'review_token_replay_blocked',
        replay_key_kind: replayKeyKind,
      });
      return 'already_used';
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'review_token_replay_guard_failed',
        replay_key_kind: replayKeyKind,
      });
      if (shouldRequireDurableStore()) return 'store_unavailable';
    }
  } else if (shouldRequireDurableStore()) {
    return 'store_unavailable';
  }

  const result = consumeInMemoryReplayKey(key, ttlSeconds);
  if (result === 'already_used') {
    captureMessage('Review token replay blocked', 'warning', {
      context: 'review_token_replay_blocked',
      replay_key_kind: replayKeyKind,
      replay_store: 'memory',
    });
  }
  return result;
}

export function __resetReviewTokenStateForTests() {
  redisClientPromise = null;
  warnedAboutRedis = false;
  inMemoryConsumedTokens.clear();
}
