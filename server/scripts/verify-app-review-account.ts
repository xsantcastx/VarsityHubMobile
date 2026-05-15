#!/usr/bin/env npx tsx
/**
 * Read-only verification for the App Review login and seeded review surfaces.
 *
 * Usage:
 *   BASE_URL=https://api-production-8ac3.up.railway.app \
 *   APP_REVIEW_PASSWORD='...' \
 *   npm --prefix server run verify:app-review
 */
import {
  APP_REVIEW_AD_NAME,
  APP_REVIEW_EMAIL,
  APP_REVIEW_PLAN,
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
  approval_status?: string;
  email_verified?: boolean;
  onboarding_completed?: boolean;
  organization_id?: string | null;
  proceeding_as_fan?: boolean;
  plan?: string | null;
  subscription_tier?: string | null;
  paid_by_owner?: boolean | null;
};

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const PASSWORD = String(
  process.env.APP_REVIEW_PASSWORD || process.env.DEMO_ACCOUNT_PASSWORD || ''
).trim();

const results: StepResult[] = [];

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
  requirePassword();

  const login = await api<LoginBody>('POST', '/auth/login', {
    email: APP_REVIEW_EMAIL,
    password: PASSWORD,
  });
  if (login.status !== 200) {
    record('login', false, login.status, 'review account login failed');
    process.exit(1);
  }

  const { accessToken, refreshToken } = requireLogin(login.data as LoginBody);
  record('login', true, login.status);

  const meRes = await api<MeBody>('GET', '/auth/me', undefined, accessToken);
  if (meRes.status !== 200) {
    record('auth/me', false, meRes.status, 'unexpected /auth/me response');
    process.exit(1);
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
      step: 'review approval approved',
      ok: String(me.approval_status || '').toUpperCase() === 'APPROVED',
      detail: `approval_status=${String(me.approval_status || '')}`,
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

  const ok = results.every(result => result.ok);
  if (!ok) process.exit(1);
}

main().catch(error => {
  record('fatal', false, undefined, error instanceof Error ? error.message : String(error));
  console.error('[app-review-verify] fatal:', error);
  process.exit(1);
});
