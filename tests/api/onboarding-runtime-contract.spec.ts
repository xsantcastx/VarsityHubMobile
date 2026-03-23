import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

const CLIENT_AFFILIATIONS = [
  'none',
  'university',
  'high_school',
  'club',
  'youth',
  'professional',
] as const;

type RegisteredUser = {
  email: string;
  password: string;
  accessToken: string;
  devVerificationCode?: string;
};

function generateTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@varsityhub-test.app`;
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function registerUser(request: APIRequestContext, role: 'fan' | 'coach' = 'fan'): Promise<RegisteredUser> {
  const email = generateTestEmail('onboarding-runtime');
  const password = 'TestPassword123!';
  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      role,
      display_name: 'Onboarding Runtime User',
    },
  });

  expect(registerResponse.ok()).toBeTruthy();
  const registerBody = await registerResponse.json();

  return {
    email,
    password,
    accessToken: registerBody.access_token,
    devVerificationCode: registerBody.dev_verification_code,
  };
}

test.describe('Onboarding Runtime Contract', () => {
  test('PATCH /me/preferences accepts every client affiliation value', async ({ request }) => {
    const user = await registerUser(request, 'fan');

    for (const affiliation of CLIENT_AFFILIATIONS) {
      const response = await request.patch(`${API_BASE_URL}/me/preferences`, {
        headers: authHeaders(user.accessToken),
        data: {
          affiliation,
          dob: '1994-01-10',
          zip_code: '30301',
        },
      });

      expect(response.status(), `expected affiliation "${affiliation}" to be accepted`).toBe(200);
      const body = await response.json();
      expect(body.preferences?.affiliation).toBe(affiliation);
    }
  });

  test('PATCH /me/preferences rejects unknown affiliation values with validation details', async ({ request }) => {
    const user = await registerUser(request, 'fan');
    const invalidAffiliation = 'college-prep';

    const response = await request.patch(`${API_BASE_URL}/me/preferences`, {
      headers: authHeaders(user.accessToken),
      data: {
        affiliation: invalidAffiliation,
        dob: '1994-01-10',
        zip_code: '30301',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid payload');
    expect(Array.isArray(body.issues)).toBeTruthy();
    expect(
      body.issues.some((issue: { path?: unknown[]; message?: string }) => {
        const path = Array.isArray(issue.path) ? issue.path.map(String) : [];
        return path.includes('affiliation');
      })
    ).toBeTruthy();
  });

  test('register -> verify -> onboarding step-2 save -> complete onboarding uses real client payload', async ({ request }) => {
    const user = await registerUser(request, 'fan');

    test.skip(
      !user.devVerificationCode,
      'Server does not expose dev verification codes; run this against a development server with ENABLE_DEV_CODES=1',
    );

    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: authHeaders(user.accessToken),
      data: { code: user.devVerificationCode },
    });
    expect(verifyResponse.status()).toBe(200);

    const step2SaveResponse = await request.patch(`${API_BASE_URL}/me/preferences`, {
      headers: authHeaders(user.accessToken),
      data: {
        affiliation: 'university',
        dob: '1994-01-10',
        zip_code: '30301',
      },
    });

    expect(step2SaveResponse.status()).toBe(200);
    const step2Body = await step2SaveResponse.json();
    expect(step2Body.preferences?.affiliation).toBe('university');

    const completeResponse = await request.post(`${API_BASE_URL}/me/complete-onboarding`, {
      headers: authHeaders(user.accessToken),
      data: {
        role: 'fan',
        username: `runtime_${Date.now()}`,
        affiliation: 'university',
        dob: '1994-01-10',
        zip_code: '30301',
      },
    });

    expect(completeResponse.status()).toBe(200);
    const completeBody = await completeResponse.json();
    expect(completeBody?.user?.preferences?.role).toBe('fan');
  });
});
