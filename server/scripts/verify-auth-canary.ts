#!/usr/bin/env npx tsx
/**
 * Lightweight auth canary for overnight / scheduled validation.
 *
 * Safe shape:
 * - login
 * - read /auth/me
 * - rotate refresh token
 * - assert old refresh token is dead
 * - logout current session
 * - assert logged-out refresh token is dead
 * - relogin and verify /auth/me again
 * - final logout
 *
 * This only invalidates the sessions minted by this canary run. It does not
 * call revoke-all-tokens or password-change, so it is safe for a dedicated
 * monitoring account.
 *
 * Usage:
 *   BASE_URL=https://api.example.com \
 *   AUTH_CANARY_EMAIL=monitor@example.com \
 *   AUTH_CANARY_PASSWORD=secret \
 *   npm --prefix server run verify:auth-canary
 */

type StepResult = {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

type LoginBody = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

const BASE_URL = (process.env.BASE_URL || process.env.AUTH_CANARY_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = String(process.env.AUTH_CANARY_EMAIL || '').trim().toLowerCase();
const PASSWORD = String(process.env.AUTH_CANARY_PASSWORD || '');
const REPORT_PATH = String(process.env.AUTH_CANARY_REPORT_PATH || '').trim();

const results: StepResult[] = [];

function record(step: string, ok: boolean, status?: number, detail?: string) {
  const entry = { step, ok, status, detail };
  results.push(entry);
  const label = ok ? 'PASS' : 'FAIL';
  console.log(`[auth-canary] ${label} ${step}${status ? ` (${status})` : ''}${detail ? ` - ${detail}` : ''}`);
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

function requireEnv() {
  const missing: string[] = [];
  if (!EMAIL) missing.push('AUTH_CANARY_EMAIL');
  if (!PASSWORD) missing.push('AUTH_CANARY_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function requireLogin(body: LoginBody, step: string): { accessToken: string; refreshToken: string } {
  const accessToken = String(body?.access_token || '');
  const refreshToken = String(body?.refresh_token || '');
  if (!accessToken || !refreshToken) {
    throw new Error(`${step}: missing token pair`);
  }
  return { accessToken, refreshToken };
}

async function writeReport(ok: boolean) {
  const payload = {
    ok,
    baseUrl: BASE_URL,
    email: EMAIL,
    ranAt: new Date().toISOString(),
    results,
  };

  if (REPORT_PATH) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[auth-canary] Wrote report to ${REPORT_PATH}`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

async function main() {
  requireEnv();

  let accessToken = '';
  let refreshToken = '';

  const login = await api<LoginBody>('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  if (login.status !== 200) {
    record('login', false, login.status, 'initial login failed');
    await writeReport(false);
    process.exit(1);
  }
  ({ accessToken, refreshToken } = requireLogin(login.data as LoginBody, 'login'));
  record('login', true, login.status);

  const me = await api('GET', '/auth/me', undefined, accessToken);
  const meOk = me.status === 200 && (me.data as any)?.email === EMAIL;
  record('auth/me', meOk, me.status, meOk ? undefined : 'unexpected /auth/me response');
  if (!meOk) {
    await writeReport(false);
    process.exit(1);
  }

  const oldRefreshToken = refreshToken;
  const refresh = await api<LoginBody>('POST', '/auth/refresh', {
    refresh_token: refreshToken,
  });
  if (refresh.status !== 200) {
    record('refresh', false, refresh.status, 'refresh failed');
    await writeReport(false);
    process.exit(1);
  }
  ({ accessToken, refreshToken } = requireLogin(refresh.data as LoginBody, 'refresh'));
  record('refresh', true, refresh.status);

  const reusedOldRefresh = await api('POST', '/auth/refresh', { refresh_token: oldRefreshToken });
  const oldRefreshDead = reusedOldRefresh.status === 401;
  record('old refresh rejected', oldRefreshDead, reusedOldRefresh.status);
  if (!oldRefreshDead) {
    await writeReport(false);
    process.exit(1);
  }

  const logout = await api('POST', '/auth/logout', { refresh_token: refreshToken });
  const logoutOk = logout.status === 200 && (logout.data as any)?.ok === true;
  record('logout', logoutOk, logout.status);
  if (!logoutOk) {
    await writeReport(false);
    process.exit(1);
  }

  const refreshAfterLogout = await api('POST', '/auth/refresh', { refresh_token: refreshToken });
  const loggedOutRefreshDead = refreshAfterLogout.status === 401;
  record('logged out refresh rejected', loggedOutRefreshDead, refreshAfterLogout.status);
  if (!loggedOutRefreshDead) {
    await writeReport(false);
    process.exit(1);
  }

  const relogin = await api<LoginBody>('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  if (relogin.status !== 200) {
    record('relogin', false, relogin.status, 'relogin failed');
    await writeReport(false);
    process.exit(1);
  }
  ({ accessToken, refreshToken } = requireLogin(relogin.data as LoginBody, 'relogin'));
  record('relogin', true, relogin.status);

  const meAfterRelogin = await api('GET', '/auth/me', undefined, accessToken);
  const reloginMeOk = meAfterRelogin.status === 200 && (meAfterRelogin.data as any)?.email === EMAIL;
  record('auth/me after relogin', reloginMeOk, meAfterRelogin.status);

  const finalLogout = await api('POST', '/auth/logout', { refresh_token: refreshToken });
  record('final logout', finalLogout.status === 200, finalLogout.status);

  const ok = results.every(entry => entry.ok);
  await writeReport(ok);
  if (!ok) process.exit(1);
}

main().catch(async error => {
  record('fatal', false, undefined, error instanceof Error ? error.message : String(error));
  await writeReport(false).catch(() => {});
  console.error('[auth-canary] fatal:', error);
  process.exit(1);
});
