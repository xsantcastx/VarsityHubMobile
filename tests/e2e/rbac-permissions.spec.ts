import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, createAuthRequest, registerTestUser } from './helpers/apiTestUtils';

/**
 * RBAC / Gatekeeping E2E Tests
 *
 * These tests follow the current server contract:
 * - verification and onboarding gates run before most coach tooling
 * - verification remains the first gate on these onboarding mutation routes
 * - that means fan and coach accounts can still be stopped before role/onboarding checks
 * - non-admin users cannot access admin-only routes
 */

async function createTestUser(request: APIRequestContext, role: 'fan' | 'coach' = 'fan') {
  const user = await registerTestUser({
    request,
    prefix: 'rbac',
    password: 'TestPassword123!',
    displayNamePrefix: 'RBAC',
    role,
  });
  return { token: user.token };
}

test.describe('RBAC Permissions', () => {
  test('Onboarding bypass does not let fan accounts create teams', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const response = await createAuthRequest(request, fan.token).post(`${API_BASE_URL}/teams/create`, {
      data: {
        name: `Fan Team ${Date.now()}`,
        organization_name: `Fan Org ${Date.now()}`,
        onboarding: true,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(
      /email verification required|coach_role_required|only coach accounts|complete onboarding/i
    );
  });

  test('Onboarding bypass does not let fan accounts create organizations', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const response = await createAuthRequest(request, fan.token).post(`${API_BASE_URL}/organizations`, {
      data: {
        name: `Fan Organization ${Date.now()}`,
        supporting_document_url: 'https://example.com/supporting-document.pdf',
        zip_code: '12345',
        onboarding: true,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(
      /email verification required|only coach accounts|coach|complete onboarding/i
    );
  });

  test('Coach onboarding organization creation still respects the verification-first contract', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const response = await createAuthRequest(request, coach.token).post(`${API_BASE_URL}/organizations`, {
      data: {
        name: `Coach Onboarding Org ${Date.now()}`,
        supporting_document_url: 'https://example.com/supporting-document.pdf',
        zip_code: '12345',
        onboarding: true,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(/email verification required/i);
  });

  test('Coach game creation is still blocked before onboarding is complete', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const response = await createAuthRequest(request, coach.token).post(`${API_BASE_URL}/games`, {
      data: {
        title: 'Blocked Coach Game',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        location: '123 Main St, Test City, 12345',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(/verification|onboarding|approval|required/i);
  });

  test('Unverified coach team creation returns verification required on the regular route', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const response = await createAuthRequest(request, coach.token).post(`${API_BASE_URL}/teams/create`, {
      data: {
        name: `Blocked Team ${Date.now()}`,
        organization_name: `Blocked Org ${Date.now()}`,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''}`).toMatch(/email verification required/i);
  });

  test('Non-admin users cannot access admin-only routes', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const response = await createAuthRequest(request, coach.token).get(`${API_BASE_URL}/admin/dashboard`);

    expect([403, 404]).toContain(response.status());
  });
});
