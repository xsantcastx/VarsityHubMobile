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
      role: 'fan',
      ...(role === 'coach' ? { dob: '1990-01-15' } : {}),
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  const token = body.access_token as string;

  if ((verifyIfPossible || role === 'coach') && body.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { code: String(body.dev_verification_code) },
    });
    expect([200, 204]).toContain(verifyResponse.status());
  } else if (role === 'coach') {
    throw new Error('Coach E2E fixtures require a dev verification code before upgrade-to-coach');
  }

  if (role === 'coach') {
    const upgradeResponse = await request.post(`${API_BASE_URL}/auth/upgrade-to-coach`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { plan: 'rookie', dob: '1990-01-15' },
    });
    expect(upgradeResponse.status()).toBe(200);
  }

  return { token, userId: body.user?.id as string | undefined, body };
}
