#!/usr/bin/env npx tsx
/**
 * P0 load smoke runner for core endpoints.
 *
 * Usage:
 *   BASE_URL=http://localhost:4000 npm --prefix server run load:smoke
 *   BASE_URL=https://api.example.com LOAD_TEST_TOKEN=... npm --prefix server run load:smoke
 */

type Scenario = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  requiresAuth?: boolean;
  expectedStatuses: number[];
};

type RequestResult = {
  status: number;
  durationMs: number;
};

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN = process.env.LOAD_TEST_TOKEN || '';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || '10');
const REQUESTS_PER_SCENARIO = Number(process.env.LOAD_REQUESTS || '50');

const scenarios: Scenario[] = [
  {
    name: 'auth/login-invalid',
    method: 'POST',
    path: '/auth/login',
    body: { email: 'load-test-invalid@example.com', password: 'bad-password' },
    expectedStatuses: [401, 429],
  },
  {
    name: 'feed/read',
    method: 'GET',
    path: '/posts',
    expectedStatuses: [200, 401],
  },
  {
    name: 'upload/sign',
    method: 'GET',
    path: '/uploads/sign?path=/uploads/load-smoke.png',
    requiresAuth: true,
    expectedStatuses: [200, 401, 429],
  },
  {
    name: 'messages/list',
    method: 'GET',
    path: '/messages',
    requiresAuth: true,
    expectedStatuses: [200, 401, 429],
  },
  {
    name: 'payments/finalize-session',
    method: 'POST',
    path: '/payments/finalize-session',
    requiresAuth: true,
    body: { session_id: 'sess_load_smoke_fake' },
    expectedStatuses: [400, 401, 403, 404, 429, 500],
  },
  {
    name: 'payments/webhook-signature-check',
    method: 'POST',
    path: '/payments/webhook',
    body: { ping: true },
    expectedStatuses: [400],
  },
  // Wiring smoke: ensure mount paths exist (auth required; 401 acceptable without token)
  { name: 'wiring/me', method: 'GET', path: '/me', requiresAuth: true, expectedStatuses: [200, 401, 429] },
  { name: 'wiring/events-pending', method: 'GET', path: '/events/pending', requiresAuth: true, expectedStatuses: [200, 401, 429] },
  { name: 'wiring/payments-config', method: 'GET', path: '/payments/config', requiresAuth: true, expectedStatuses: [200, 401, 404, 429] },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function runRequest(scenario: Scenario): Promise<RequestResult> {
  const url = `${BASE_URL}${scenario.path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (scenario.requiresAuth && TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }

  const started = Date.now();
  const response = await fetch(url, {
    method: scenario.method,
    headers,
    body: scenario.method === 'POST' ? JSON.stringify(scenario.body || {}) : undefined,
  });
  return { status: response.status, durationMs: Date.now() - started };
}

async function runScenario(scenario: Scenario) {
  const durations: number[] = [];
  const statuses = new Map<number, number>();
  let failed = 0;
  let launched = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      if (launched >= REQUESTS_PER_SCENARIO) return;
      launched += 1;
      try {
        const result = await runRequest(scenario);
        durations.push(result.durationMs);
        statuses.set(result.status, (statuses.get(result.status) || 0) + 1);
        if (!scenario.expectedStatuses.includes(result.status)) failed += 1;
      } catch {
        failed += 1;
      } finally {
        completed += 1;
      }
      await sleep(5);
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker());
  await Promise.all(workers);

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const avg = durations.length ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;
  const statusSummary = [...statuses.entries()].sort((a, b) => a[0] - b[0]).map(([code, count]) => `${code}:${count}`).join(', ');

  const ok = failed === 0 && completed === REQUESTS_PER_SCENARIO;
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${scenario.name}`);
  console.log(`  requests=${completed}/${REQUESTS_PER_SCENARIO} concurrency=${CONCURRENCY} failed=${failed}`);
  console.log(`  latency_ms avg=${avg} p50=${p50} p95=${p95} p99=${p99}`);
  console.log(`  statuses ${statusSummary || 'none'}`);

  return ok;
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`CONCURRENCY=${CONCURRENCY} REQUESTS_PER_SCENARIO=${REQUESTS_PER_SCENARIO}`);
  if (!TOKEN) {
    console.log('LOAD_TEST_TOKEN is not set. Auth-required scenarios may return 401 (accepted).');
  }

  let allPass = true;
  for (const scenario of scenarios) {
    const ok = await runScenario(scenario);
    allPass = allPass && ok;
  }

  if (!allPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('p0-load-smoke failed:', err);
  process.exit(1);
});
