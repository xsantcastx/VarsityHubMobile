#!/usr/bin/env npx tsx
/**
 * Read-only verification for the App Review login and seeded review surfaces.
 *
 * Usage:
 *   BASE_URL=https://api-production-8ac3.up.railway.app \
 *   APP_REVIEW_PASSWORD='...' \
 *   npm --prefix server run verify:app-review
 *
 * Localhost convenience:
 *   When BASE_URL points at localhost and APP_REVIEW_PASSWORD is omitted, the
 *   script seeds the local fixture with a deterministic test password.
 */
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import {
  APP_REVIEW_AD_NAME,
  APP_REVIEW_EMAIL,
  APP_REVIEW_PLAN,
  ensureAppReviewFixture,
  APP_REVIEW_SUBSCRIPTION_TIER,
} from '../src/lib/appReviewFixture.js';

type StepResult = {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

type LoginBody = {
  access_token?: string;
  refresh_token?: string;
};

type MeBody = {
  email?: string;
  role?: string;
  is_admin?: boolean;
  approval_status?: string;
  account_state?: string;
  next_step?: string | null;
  email_verified?: boolean;
  onboarding_completed?: boolean;
  organization_id?: string | null;
  proceeding_as_fan?: boolean;
  plan?: string | null;
  subscription_tier?: string | null;
  paid_by_owner?: boolean | null;
};

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const EXPLICIT_PASSWORD = String(
  process.env.APP_REVIEW_PASSWORD || process.env.DEMO_ACCOUNT_PASSWORD || ''
).trim();
const LOCALHOST_FALLBACK_PASSWORD = 'LocalAppReview123!';
const PASSWORD =
  EXPLICIT_PASSWORD || (isLocalBaseUrl(BASE_URL) ? LOCALHOST_FALLBACK_PASSWORD : '');

const results: StepResult[] = [];
let embeddedLocalServer: Server | null = null;

function record(step: string, ok: boolean, status?: number, detail?: string) {
  results.push({ step, ok, status, detail });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(
    `[app-review-verify] ${label} ${step}${status ? ` (${status})` : ''}${detail ? ` - ${detail}` : ''}`
  );
}

async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: T | string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }
  return { status: res.status, data };
}

function isLocalBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function getBaseUrlAddress(url: string): { hostname: string; port: number } {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80,
  };
}

async function isBaseUrlReachable(url: string): Promise<boolean> {
  try {
    await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureLocalServer() {
  if (!isLocalBaseUrl(BASE_URL)) return;
  if (await isBaseUrlReachable(BASE_URL)) return;

  const { hostname, port } = getBaseUrlAddress(BASE_URL);
  process.env.NODE_ENV = 'test';
  const { app } = await import('../src/testApp.js');

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, hostname, () => {
      embeddedLocalServer = server;
      resolve();
    });
    server.on('error', reject);
  });

  console.log(
    `[app-review-verify] Started embedded local API on ${hostname}:${port} for localhost verification.`
  );
}

async function ensureLocalFixture() {
  if (!isLocalBaseUrl(BASE_URL)) return;
  if (EXPLICIT_PASSWORD) return;

  const prisma = new PrismaClient();
  try {
    await ensureAppReviewFixture(prisma, LOCALHOST_FALLBACK_PASSWORD);
    console.log('[app-review-verify] Seeded local App Review fixture with fallback password.');
  } finally {
    await prisma.$disconnect();
  }
}

async function shutdownEmbeddedLocalServer() {
  if (!embeddedLocalServer) return;
  const server = embeddedLocalServer;
  embeddedLocalServer = null;
  await new Promise<void>((resolve, reject) => {
    server.close(err => {
      if (err) reject(err);
      else resolve();
    });
  }).catch(() => {});
}

function requirePassword() {
  if (!PASSWORD) {
    throw new Error('Missing APP_REVIEW_PASSWORD');
  }
}

function requireLogin(body: LoginBody): { accessToken: string; refreshToken: string } {
  const accessToken = String(body?.access_token || '');
  const refreshToken = String(body?.refresh_token || '');
  if (!accessToken || !refreshToken) {
    throw new Error('login: missing token pair');
  }
  return { accessToken, refreshToken };
}

async function main() {
  try {
    await ensureLocalServer();
    await ensureLocalFixture();
    requirePassword();

    const login = await api<LoginBody>('POST', '/auth/login', {
      email: APP_REVIEW_EMAIL,
      password: PASSWORD,
    });
    if (login.status !== 200) {
      record('login', false, login.status, 'review account login failed');
      return 1;
    }

    const { accessToken, refreshToken } = requireLogin(login.data as LoginBody);
    record('login', true, login.status);

    const meRes = await api<MeBody>('GET', '/auth/me', undefined, accessToken);
    if (meRes.status !== 200) {
      record('auth/me', false, meRes.status, 'unexpected /auth/me response');
      return 1;
    }
    record('auth/me', true, meRes.status);

    const me = (meRes.data || {}) as MeBody;
    const meChecks: Array<{ step: string; ok: boolean; detail?: string }> = [
      {
        step: 'review role coach',
        ok: String(me.role || '').toLowerCase() === 'coach',
        detail: `role=${String(me.role || '')}`,
      },
      {
        step: 'review has admin access',
        ok: me.is_admin === true,
        detail: `is_admin=${String(me.is_admin)}`,
      },
      {
        step: 'review approval approved',
        ok: String(me.approval_status || '').toUpperCase() === 'APPROVED',
        detail: `approval_status=${String(me.approval_status || '')}`,
      },
      {
        step: 'review account_state coach_active',
        ok: String(me.account_state || '') === 'coach_active',
        detail: `account_state=${String(me.account_state || '')}`,
      },
      {
        step: 'review next_step tabs',
        ok: String(me.next_step || '') === '/(tabs)',
        detail: `next_step=${String(me.next_step || '')}`,
      },
      {
        step: 'review email verified',
        ok: me.email_verified === true,
        detail: `email_verified=${String(me.email_verified)}`,
      },
      {
        step: 'review onboarding complete',
        ok: me.onboarding_completed === true,
        detail: `onboarding_completed=${String(me.onboarding_completed)}`,
      },
      {
        step: 'review organization attached',
        ok: Boolean(String(me.organization_id || '').trim()),
        detail: `organization_id=${String(me.organization_id || '')}`,
      },
      {
        step: 'review not proceeding as fan',
        ok: me.proceeding_as_fan !== true,
        detail: `proceeding_as_fan=${String(me.proceeding_as_fan)}`,
      },
      {
        step: 'review plan rookie',
        ok: String(me.plan || '').toLowerCase() === APP_REVIEW_PLAN,
        detail: `plan=${String(me.plan || '')}`,
      },
      {
        step: 'review subscription tier free',
        ok: String(me.subscription_tier || '').toLowerCase() === APP_REVIEW_SUBSCRIPTION_TIER,
        detail: `subscription_tier=${String(me.subscription_tier || '')}`,
      },
      {
        step: 'review not owner-paid',
        ok: me.paid_by_owner !== true,
        detail: `paid_by_owner=${String(me.paid_by_owner)}`,
      },
    ];

    for (const check of meChecks) {
      record(check.step, check.ok, meRes.status, check.ok ? undefined : check.detail);
    }

    const paymentsConfig = await api<any>('GET', '/payments/config', undefined, accessToken);
    const paymentsReady =
      paymentsConfig.status === 200 &&
      Boolean((paymentsConfig.data as any)?.payments_enabled) &&
      typeof (paymentsConfig.data as any)?.stripe_publishable_key === 'string';
    record(
      'payments config reachable',
      paymentsReady,
      paymentsConfig.status,
      paymentsReady ? undefined : 'payments/config missing readiness fields'
    );

    const eventsPending = await api<any>('GET', '/events/pending', undefined, accessToken);
    record('events pending route', eventsPending.status === 200, eventsPending.status);

    const managedTeams = await api<any>('GET', '/teams/managed', undefined, accessToken);
    record('teams managed route', managedTeams.status === 200, managedTeams.status);

    const myAds = await api<any>('GET', '/ads?mine=1', undefined, accessToken);
    const adVisible =
      myAds.status === 200 &&
      Array.isArray(myAds.data) &&
      myAds.data.some((ad: any) => String(ad?.business_name || '') === APP_REVIEW_AD_NAME);
    record(
      'review ad visible',
      adVisible,
      myAds.status,
      adVisible ? undefined : `expected ${APP_REVIEW_AD_NAME}`
    );

    const logout = await api<any>('POST', '/auth/logout', { refresh_token: refreshToken });
    record('logout', logout.status === 200 && (logout.data as any)?.ok === true, logout.status);

    return results.every(result => result.ok) ? 0 : 1;
  } finally {
    await shutdownEmbeddedLocalServer();
  }
}

main().catch(error => {
  record('fatal', false, undefined, error instanceof Error ? error.message : String(error));
  void shutdownEmbeddedLocalServer();
  console.error('[app-review-verify] fatal:', error);
  process.exit(1);
}).then(code => {
  if (typeof code === 'number') {
    process.exit(code);
  }
});
