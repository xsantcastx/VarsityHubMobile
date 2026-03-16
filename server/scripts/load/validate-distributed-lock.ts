#!/usr/bin/env npx tsx
/**
 * Validates distributed lock behavior across multiple Node processes.
 *
 * Requires REDIS_URL. If missing, script exits successfully with SKIP message.
 *
 * Usage:
 *   npm --prefix server run load:validate-lock
 *   LOCK_WORKERS=12 LOCK_HOLD_MS=300 npm --prefix server run load:validate-lock
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withDistributedLock } from '../../src/lib/distributedLock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoServerRoot = path.resolve(__dirname, '..', '..');

const REDIS_URL = process.env.REDIS_URL || '';
const RUN_ID = process.env.LOCK_TEST_RUN_ID || `run_${Date.now()}`;
const WORKERS = Number(process.env.LOCK_WORKERS || '8');
const HOLD_MS = Number(process.env.LOCK_HOLD_MS || '250');
const LOCK_KEY = 'finalize-session-lock-check';

const activeKey = `locktest:${RUN_ID}:active`;
const maxKey = `locktest:${RUN_ID}:max`;
const violationKey = `locktest:${RUN_ID}:violations`;
const doneKey = `locktest:${RUN_ID}:done`;

async function getRedis() {
  const { default: Redis } = await import('ioredis');
  const RedisCtor = Redis as unknown as new (url: string) => any;
  return new RedisCtor(REDIS_URL);
}

async function runWorker() {
  const redis = await getRedis();
  try {
    await withDistributedLock(
      {
        namespace: 'payments:finalize-session',
        key: LOCK_KEY,
        localLocks: new Map<string, Promise<any>>(),
        ttlMs: 60_000,
        acquireTimeoutMs: 30_000,
      },
      async () => {
        await redis.eval(
          `
          local active = redis.call("incr", KEYS[1])
          local maxv = tonumber(redis.call("get", KEYS[2]) or "0")
          if active > maxv then redis.call("set", KEYS[2], active) end
          if active > 1 then redis.call("incr", KEYS[3]) end
          return active
          `,
          3,
          activeKey,
          maxKey,
          violationKey
        );

        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
        await redis.decr(activeKey);
        await redis.incr(doneKey);
      }
    );
  } finally {
    await redis.quit();
  }
}

function runChildWorkers(count: number) {
  return Promise.all(
    Array.from({ length: count }, () => {
      return new Promise<void>((resolve, reject) => {
        const child = spawn(
          'npm',
          ['exec', '--', 'tsx', 'scripts/load/validate-distributed-lock.ts', 'worker'],
          {
            cwd: repoServerRoot,
            env: {
              ...process.env,
              LOCK_TEST_RUN_ID: RUN_ID,
              LOCK_HOLD_MS: String(HOLD_MS),
            },
            stdio: 'ignore',
          }
        );
        child.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`worker exited with code ${code}`));
        });
        child.on('error', reject);
      });
    })
  );
}

async function runParent() {
  if (!REDIS_URL) {
    console.log('[SKIP] REDIS_URL is not set. Distributed lock multi-process validation skipped.');
    return;
  }

  const redis = await getRedis();
  try {
    await redis.del(activeKey, maxKey, violationKey, doneKey);
    await redis.set(activeKey, '0');
    await redis.set(maxKey, '0');
    await redis.set(violationKey, '0');
    await redis.set(doneKey, '0');

    console.log(`Running distributed lock validation with ${WORKERS} workers...`);
    await runChildWorkers(WORKERS);

    const [maxActiveRaw, violationsRaw, doneRaw] = await Promise.all([
      redis.get(maxKey),
      redis.get(violationKey),
      redis.get(doneKey),
    ]);
    const maxActive = Number(maxActiveRaw || '0');
    const violations = Number(violationsRaw || '0');
    const done = Number(doneRaw || '0');

    console.log(`max_active=${maxActive} violations=${violations} done=${done}/${WORKERS}`);
    const pass = maxActive <= 1 && violations === 0 && done === WORKERS;
    if (!pass) {
      throw new Error('Distributed lock validation failed: overlapping critical sections detected.');
    }
    console.log('[PASS] Distributed lock validation succeeded.');
  } finally {
    await redis.del(activeKey, maxKey, violationKey, doneKey).catch(() => {});
    await redis.quit();
  }
}

async function main() {
  const mode = process.argv[2] || 'parent';
  if (mode === 'worker') {
    await runWorker();
    return;
  }
  await runParent();
}

main().catch((err) => {
  console.error('validate-distributed-lock failed:', err);
  process.exit(1);
});
