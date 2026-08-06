import { expect, type APIRequestContext } from '@playwright/test';

export const API_BASE_URL = (
  process.env.API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://127.0.0.1:4000'
).replace('://localhost', '://127.0.0.1');

export function createAuthRequest(request: APIRequestContext, token: string) {
  const withAuth = (options: Record<string, any> = {}) => ({
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    get: (url: string, options?: Record<string, any>) => request.get(url, withAuth(options)),
    post: (url: string, options?: Record<string, any>) => request.post(url, withAuth(options)),
  };
}

type RegisterTestUserArgs = {
  request: APIRequestContext;
  prefix: string;
  password: string;
  displayNamePrefix: string;
  role?: 'fan' | 'coach';
  verifyIfPossible?: boolean;
};

export async function registerTestUser({
  request,
  prefix,
  password,
  displayNamePrefix,
  role = 'fan',
  verifyIfPossible = false,
}: RegisterTestUserArgs) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email: `${prefix}-${role}-${nonce}@varsityhub-test.app`,
      password,
      display_name: `${displayNamePrefix} ${role} ${nonce}`,
      role: role === 'coach' ? 'fan' : role,
      ...(role === 'coach' ? { dob: '1990-01-15' } : {}),
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  const token = body.access_token as string;

  if (verifyIfPossible && body.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { code: String(body.dev_verification_code) },
    });
    expect([200, 204, 429]).toContain(verifyResponse.status());
  }

  if (role === 'coach' && verifyIfPossible) {
    const upgradeResponse = await request.post(`${API_BASE_URL}/auth/upgrade-to-coach`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { plan: 'rookie' },
    });
    expect(upgradeResponse.status()).toBe(200);
  }

  return { token, userId: body.user?.id as string | undefined, body };
}

export type ApprovedCoach = {
  access_token: string;
  user: any;
  email: string;
  password: string;
  username: string;
};

/**
 * Canonical fixture: a fully APPROVED, onboarded coach ready to create
 * teams / posts / events immediately.
 *
 * Why this exists (root-cause fix, 2026-08-06): direct coach registration is
 * disabled server-side (`POST /auth/register` rejects `role:'coach'` since
 * 2026-07-09 — see `server/src/routes/auth.ts`). The supported path is
 * register-as-fan → verify → `upgrade-to-coach`, but that leaves the account
 * PENDING + not onboarded. Specs that need a coach who can act right away
 * force-approve via Prisma. That force-approve logic used to be copy-pasted
 * into every API spec, so when the registration contract changed, each copy
 * broke independently. This is now the ONE place it lives — a future contract
 * change touches this function only.
 *
 * The spec passes its own PrismaClient instance (the import path differs per
 * spec, so it is injected rather than imported here).
 */
export async function createApprovedCoach(opts: {
  request: APIRequestContext;
  prisma: any;
  displayName?: string;
  plan?: 'rookie' | 'veteran' | 'legend';
  apiBaseUrl?: string;
}): Promise<ApprovedCoach> {
  const { request, prisma } = opts;
  const apiBaseUrl = opts.apiBaseUrl ?? API_BASE_URL;
  const plan = opts.plan ?? 'rookie';
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `coach-${nonce}@varsityhub-test.app`;
  const password = 'TestPassword123!';
  const username = `c${nonce.replace(/[^a-z0-9]/gi, '')}`.slice(0, 20);

  const response = await request.post(`${apiBaseUrl}/auth/register`, {
    data: {
      email,
      password,
      display_name: opts.displayName ?? `Approved Coach ${nonce}`,
      role: 'fan', // direct coach registration is disabled server-side
      dob: '1990-01-15', // 18+ so the coach age-gate passes on approval
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const { access_token, user, dev_verification_code } = body;

  if (!dev_verification_code) {
    throw new Error(
      'ENABLE_DEV_CODES not set on API: register did not return dev_verification_code, so createApprovedCoach cannot verify its user.'
    );
  }
  const verify = await request.post(`${apiBaseUrl}/auth/verify/confirm`, {
    headers: { Authorization: `Bearer ${access_token}` },
    data: { code: String(dev_verification_code) },
  });
  expect([200, 204, 429]).toContain(verify.status());

  const now = new Date();
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { preferences: true },
  });
  const nextPreferences =
    current?.preferences && typeof current.preferences === 'object'
      ? { ...(current.preferences as Record<string, unknown>) }
      : {};
  nextPreferences.role = 'coach';
  nextPreferences.onboarding_completed = true;
  nextPreferences.coach_agreement_accepted_at = now.toISOString();
  nextPreferences.plan = plan;
  delete nextPreferences.pending_plan;
  delete nextPreferences.payment_pending;
  delete nextPreferences.payment_approved;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email_verified: true,
      username,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      coach_agreement_accepted_at: now,
      coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
      plan,
      pending_plan: null,
      payment_pending: false,
      payment_approved: false,
      subscription_tier: 'free',
      preferences: nextPreferences,
    },
  });

  return { access_token, user, email, password, username };
}
