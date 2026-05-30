#!/usr/bin/env npx tsx
/**
 * Read-only production route battery for an approved coach / organizer account.
 *
 * Safe shape:
 * - login
 * - read /auth/me
 * - verify approval-only coach access invariants
 * - read coach / organizer routes that should be accessible
 * - logout
 *
 * This intentionally does not create, approve, reject, or mutate production data.
 *
 * Usage:
 *   BASE_URL=https://api.example.com \
 *   COACH_ROUTE_BATTERY_EMAIL=coach@example.com \
 *   COACH_ROUTE_BATTERY_PASSWORD=secret \
 *   npm --prefix server run verify:coach-route-battery
 *
 * Localhost shortcut:
 *   When BASE_URL points at localhost/127.0.0.1 and no explicit battery
 *   credentials are set, this script prepares the seeded coach UAT fixtures
 *   and uses the deterministic approved rookie coach account automatically.
 */

import type { Server } from 'node:http';
import { writeFile } from 'node:fs/promises';
import {
  COACH_ROUTE_BATTERY_LOCAL_EMAIL,
  COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_EMAIL,
  COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_STATUS,
  COACH_ROUTE_BATTERY_LOCAL_MISSING_AGREEMENT_EMAIL,
  COACH_UAT_PASSWORD,
  disconnectCoachUatAccountsPrisma,
  prepareCoachUatAccounts,
} from './prepare-coach-uat-accounts.js';

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
  account_state?: string | null;
  next_step?: string | null;
  email_verified?: boolean;
  onboarding_completed?: boolean;
  organization_id?: string | null;
  coach_agreement_accepted_at?: string | null;
  proceeding_as_fan?: boolean;
  preferences?: {
    coach_agreement_accepted_at?: string | null;
    proceeding_as_fan?: boolean;
  } | null;
};

type RouteProbe = {
  path: string;
  required: boolean;
  status: number;
  ok: boolean;
  detail?: string;
};

type LocalVariantExpectation = {
  label: string;
  email: string;
  expectedAccountState: string;
  expectedNextStep: string;
  expectProceedingAsFan: boolean;
  protectedRoute: string;
  protectedRouteExpectedStatus: number;
  fanSafeRoute?: string;
  fanSafeRouteExpectedStatus?: number;
};

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const EXPLICIT_EMAIL = String(
  process.env.COACH_ROUTE_BATTERY_EMAIL || process.env.AUTH_CANARY_EMAIL || ''
)
  .trim()
  .toLowerCase();
const EXPLICIT_PASSWORD = String(
  process.env.COACH_ROUTE_BATTERY_PASSWORD || process.env.AUTH_CANARY_PASSWORD || ''
);
const REPORT_PATH = String(process.env.COACH_ROUTE_BATTERY_REPORT_PATH || '').trim();

const stepResults: StepResult[] = [];
let activeCredentials: CredentialResolution | null = null;
let embeddedLocalServer: Server | null = null;

type CredentialResolution = {
  email: string;
  password: string;
  source: 'explicit_env' | 'local_seeded_uat';
};

function record(step: string, ok: boolean, status?: number, detail?: string) {
  stepResults.push({ step, ok, status, detail });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(
    `[coach-route-battery] ${label} ${step}${status ? ` (${status})` : ''}${detail ? ` - ${detail}` : ''}`
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
    `[coach-route-battery] Started embedded local API on ${hostname}:${port} for localhost verification.`
  );
}

async function resolveCredentials(): Promise<CredentialResolution> {
  if (EXPLICIT_EMAIL && EXPLICIT_PASSWORD) {
    return {
      email: EXPLICIT_EMAIL,
      password: EXPLICIT_PASSWORD,
      source: 'explicit_env',
    };
  }

  if (EXPLICIT_EMAIL || EXPLICIT_PASSWORD) {
    throw new Error(
      'Both COACH_ROUTE_BATTERY_EMAIL and COACH_ROUTE_BATTERY_PASSWORD must be set together.'
    );
  }

  if (isLocalBaseUrl(BASE_URL)) {
    console.log(
      `[coach-route-battery] No explicit credentials set for ${BASE_URL}; preparing local coach UAT fixtures.`
    );
    await prepareCoachUatAccounts();
    return {
      email: COACH_ROUTE_BATTERY_LOCAL_EMAIL,
      password: COACH_UAT_PASSWORD,
      source: 'local_seeded_uat',
    };
  }

  throw new Error(
    'Missing required env vars: COACH_ROUTE_BATTERY_EMAIL, COACH_ROUTE_BATTERY_PASSWORD'
  );
}

async function disconnectLocalFixtureSeed() {
  if (!isLocalBaseUrl(BASE_URL)) return;
  await disconnectCoachUatAccountsPrisma().catch(() => {});
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

function requireLogin(body: LoginBody): { accessToken: string; refreshToken: string } {
  const accessToken = String(body?.access_token || '');
  const refreshToken = String(body?.refresh_token || '');
  if (!accessToken || !refreshToken) {
    throw new Error('login: missing token pair');
  }
  return { accessToken, refreshToken };
}

function summarizeBody(data: any): string | undefined {
  if (Array.isArray(data)) return `count=${data.length}`;
  if (Array.isArray(data?.items)) return `items=${data.items.length}`;
  if (Array.isArray(data?.members)) return `members=${data.members.length}`;
  if (data?.error) return `error=${String(data.error)}`;
  if (data?.message) return `message=${String(data.message)}`;
  return undefined;
}

function hasCoachAgreement(me: MeBody): boolean {
  return Boolean(me?.coach_agreement_accepted_at || me?.preferences?.coach_agreement_accepted_at);
}

function isProceedingAsFan(me: MeBody): boolean {
  return Boolean(me?.proceeding_as_fan ?? me?.preferences?.proceeding_as_fan);
}

function isLegacyBlockedCoachState(me: MeBody): boolean {
  const accountState = String(me?.account_state || '').trim();
  return (
    accountState === 'coach_agreement_required' ||
    accountState === 'coach_final_setup_required'
  );
}

async function verifyLocalVariant(
  variant: LocalVariantExpectation,
  routeResults: RouteProbe[],
) {
  const login = await api<LoginBody>('POST', '/auth/login', {
    email: variant.email,
    password: COACH_UAT_PASSWORD,
  });
  const loginOk = login.status === 200;
  record(`${variant.label} login`, loginOk, login.status, loginOk ? undefined : 'login failed');
  if (!loginOk) return false;

  const { accessToken, refreshToken } = requireLogin(login.data as LoginBody);
  const meRes = await api<MeBody>('GET', '/auth/me', undefined, accessToken);
  const me = (meRes.data || null) as MeBody | null;
  const meOk = meRes.status === 200;
  record(`${variant.label} auth/me`, meOk, meRes.status, meOk ? undefined : 'unexpected /auth/me response');
  if (!meOk) return false;

  const meChecks: Array<{ step: string; ok: boolean; detail?: string }> = [
    {
      step: `${variant.label} account_state`,
      ok: String(me?.account_state || '').trim() === variant.expectedAccountState,
      detail: `account_state=${String(me?.account_state || '')}`,
    },
    {
      step: `${variant.label} next_step`,
      ok: String(me?.next_step || '').trim() === variant.expectedNextStep,
      detail: `next_step=${String(me?.next_step || '')}`,
    },
    {
      step: `${variant.label} proceeding_as_fan`,
      ok: isProceedingAsFan(me || {}) === variant.expectProceedingAsFan,
      detail: `proceeding_as_fan=${String(isProceedingAsFan(me || {}))}`,
    },
  ];

  for (const check of meChecks) {
    record(check.step, check.ok, meRes.status, check.ok ? undefined : check.detail);
  }

  const protectedRes = await api('GET', variant.protectedRoute, undefined, accessToken);
  const protectedOk = protectedRes.status === variant.protectedRouteExpectedStatus;
  const protectedDetail =
    summarizeBody(protectedRes.data) || `expected ${variant.protectedRouteExpectedStatus}`;
  routeResults.push({
    path: `[${variant.label}] ${variant.protectedRoute}`,
    required: true,
    status: protectedRes.status,
    ok: protectedOk,
    detail: protectedDetail,
  });
  record(
    `${variant.label} route ${variant.protectedRoute}`,
    protectedOk,
    protectedRes.status,
    protectedOk ? protectedDetail : `expected ${variant.protectedRouteExpectedStatus}, got ${protectedRes.status}`
  );

  if (variant.fanSafeRoute) {
    const fanSafeRes = await api('GET', variant.fanSafeRoute, undefined, accessToken);
    const expectedStatus = variant.fanSafeRouteExpectedStatus ?? 200;
    const fanSafeOk = fanSafeRes.status === expectedStatus;
    const fanSafeDetail = summarizeBody(fanSafeRes.data) || `expected ${expectedStatus}`;
    routeResults.push({
      path: `[${variant.label}] ${variant.fanSafeRoute}`,
      required: true,
      status: fanSafeRes.status,
      ok: fanSafeOk,
      detail: fanSafeDetail,
    });
    record(
      `${variant.label} route ${variant.fanSafeRoute}`,
      fanSafeOk,
      fanSafeRes.status,
      fanSafeOk ? fanSafeDetail : `expected ${expectedStatus}, got ${fanSafeRes.status}`
    );
  }

  const logout = await api('POST', '/auth/logout', { refresh_token: refreshToken });
  const logoutOk = logout.status === 200 && (logout.data as any)?.ok === true;
  record(`${variant.label} logout`, logoutOk, logout.status);

  return meChecks.every((check) => check.ok) && protectedOk && logoutOk;
}

async function writeReport(
  ok: boolean,
  routeResults: RouteProbe[],
  me?: MeBody | null,
  credentials?: CredentialResolution | null
) {
  const payload = {
    ok,
    baseUrl: BASE_URL,
    email: credentials?.email || EXPLICIT_EMAIL,
    credentialSource: credentials?.source || null,
    ranAt: new Date().toISOString(),
    me: me
      ? {
          email: me.email,
          role: me.role,
          approval_status: me.approval_status,
          account_state: me.account_state || null,
          next_step: me.next_step || null,
          email_verified: me.email_verified,
          onboarding_completed: me.onboarding_completed,
          organization_id: me.organization_id || null,
          coach_agreement_accepted: hasCoachAgreement(me),
          proceeding_as_fan: isProceedingAsFan(me),
        }
      : null,
    stepResults,
    routeResults,
  };

  if (REPORT_PATH) {
    await writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[coach-route-battery] Wrote report to ${REPORT_PATH}`);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  let credentials: CredentialResolution | null = null;
  let accessToken = '';
  let refreshToken = '';
  let me: MeBody | null = null;
  const routeResults: RouteProbe[] = [];
  try {
    await ensureLocalServer();
    credentials = await resolveCredentials();
    activeCredentials = credentials;

    const login = await api<LoginBody>('POST', '/auth/login', {
      email: credentials.email,
      password: credentials.password,
    });
    if (login.status !== 200) {
      record('login', false, login.status, 'initial login failed');
      await writeReport(false, routeResults, me, credentials);
      return 1;
    }
    ({ accessToken, refreshToken } = requireLogin(login.data as LoginBody));
    record('login', true, login.status);

    const meRes = await api<MeBody>('GET', '/auth/me', undefined, accessToken);
    if (meRes.status !== 200) {
      record('auth/me', false, meRes.status, 'unexpected /auth/me response');
      await writeReport(false, routeResults, me, credentials);
      return 1;
    }
    me = (meRes.data || null) as MeBody | null;
    record('auth/me', true, meRes.status);

    const meChecks: Array<{ step: string; ok: boolean; detail?: string }> = [
      {
        step: 'me role coach',
        ok: String(me?.role || '').toLowerCase() === 'coach',
        detail: `role=${String(me?.role || '')}`,
      },
      {
        step: 'me approval approved',
        ok: String(me?.approval_status || '').toUpperCase() === 'APPROVED',
        detail: `approval_status=${String(me?.approval_status || '')}`,
      },
      {
        step: 'me email verified',
        ok: me?.email_verified === true,
        detail: `email_verified=${String(me?.email_verified)}`,
      },
      {
        step: 'me onboarding completed',
        ok: me?.onboarding_completed === true,
        detail: `onboarding_completed=${String(me?.onboarding_completed)}`,
      },
      {
        step: 'me organization present',
        ok: Boolean(String(me?.organization_id || '').trim()),
        detail: `organization_id=${String(me?.organization_id || '')}`,
      },
      {
        step: 'me no legacy blocked state',
        ok: isLegacyBlockedCoachState(me || {}) === false,
        detail: `account_state=${String(me?.account_state || '')}`,
      },
      {
        step: 'me next_step not onboarding gate',
        ok:
          String(me?.next_step || '').trim() === '' ||
          String(me?.next_step || '').trim() === '/(tabs)',
        detail: `next_step=${String(me?.next_step || '')}`,
      },
      {
        step: 'me not proceeding as fan',
        ok: isProceedingAsFan(me || {}) === false,
        detail: `proceeding_as_fan=${String(isProceedingAsFan(me || {}))}`,
      },
    ];

    for (const check of meChecks) {
      record(check.step, check.ok, meRes.status, check.ok ? undefined : check.detail);
    }

    if (meChecks.some(check => !check.ok)) {
      await writeReport(false, routeResults, me, credentials);
      return 1;
    }

    const orgId = String(me?.organization_id || '').trim();
    const routes = [
      '/events/pending',
      '/events/my-events',
      '/teams/managed',
      '/organizations/invites/me',
      '/organizations/join-requests/me',
      `/organizations/${encodeURIComponent(orgId)}/members`,
      `/organizations/${encodeURIComponent(orgId)}/admin-summary`,
      `/organizations/${encodeURIComponent(orgId)}/pending-coaches`,
      `/organizations/${encodeURIComponent(orgId)}/join-requests`,
    ];

    for (const path of routes) {
      const response = await api('GET', path, undefined, accessToken);
      const ok = response.status === 200;
      const detail =
        ok ? summarizeBody(response.data) : summarizeBody(response.data) || 'route failed';
      routeResults.push({ path, required: true, status: response.status, ok, detail });
      record(`route ${path}`, ok, response.status, detail);
    }

    if (credentials.source === 'local_seeded_uat') {
      const localVariants: LocalVariantExpectation[] = [
        {
          label: 'missing-agreement',
          email: COACH_ROUTE_BATTERY_LOCAL_MISSING_AGREEMENT_EMAIL,
          expectedAccountState: 'coach_agreement_required',
          expectedNextStep: '/onboarding/coach-agreement',
          expectProceedingAsFan: false,
          protectedRoute: '/events/pending',
          protectedRouteExpectedStatus: 403,
        },
        {
          label:
            COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_STATUS === 'PENDING'
              ? 'pending-fan-mode'
              : 'rejected-fan-mode',
          email: COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_EMAIL,
          expectedAccountState:
            COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_STATUS === 'PENDING'
              ? 'coach_pending_approval'
              : 'coach_pending_approval',
          expectedNextStep: '/(tabs)',
          expectProceedingAsFan: true,
          protectedRoute: '/events/pending',
          protectedRouteExpectedStatus: 403,
          fanSafeRoute: '/feed/bundle',
          fanSafeRouteExpectedStatus: 200,
        },
      ];

      for (const variant of localVariants) {
        await verifyLocalVariant(variant, routeResults);
      }
    }

    const logout = await api('POST', '/auth/logout', { refresh_token: refreshToken });
    const logoutOk = logout.status === 200 && (logout.data as any)?.ok === true;
    record('logout', logoutOk, logout.status);

    const ok = stepResults.every(result => result.ok) && routeResults.every(result => result.ok);
    await writeReport(ok, routeResults, me, credentials);
    return ok ? 0 : 1;
  } finally {
    await disconnectLocalFixtureSeed();
    await shutdownEmbeddedLocalServer();
  }
}

main().catch(async error => {
  record('fatal', false, undefined, error instanceof Error ? error.message : String(error));
  await writeReport(false, [], null, activeCredentials).catch(() => {});
  await disconnectLocalFixtureSeed().catch(() => {});
  await shutdownEmbeddedLocalServer().catch(() => {});
  console.error('[coach-route-battery] fatal:', error);
  process.exit(1);
}).then(code => {
  if (typeof code === 'number') {
    process.exit(code);
  }
});
