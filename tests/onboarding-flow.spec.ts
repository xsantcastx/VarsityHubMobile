import { expect, test } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('User can complete onboarding state transitions (API)', async ({ request }) => {
    const ts = Date.now();
    const email = `onboarding-flow-${ts}@example.com`;
    const password = 'TestPassword123!';

    const registerRes = await request.post('http://localhost:4000/auth/register', {
      data: {
        email,
        password,
        display_name: 'Onboarding User',
      },
    });
    expect(registerRes.ok()).toBeTruthy();
    const registerBody = await registerRes.json();
    expect(registerBody.access_token).toBeTruthy();

    // In development tests, verify if a dev code is available.
    if (registerBody.dev_verification_code) {
      const verifyRes = await request.post('http://localhost:4000/auth/verify/confirm', {
        headers: { Authorization: `Bearer ${registerBody.access_token}` },
        data: { code: String(registerBody.dev_verification_code) },
      });
      expect([200, 400, 429]).toContain(verifyRes.status());
    }

    const prefsRes = await request.patch('http://localhost:4000/me/preferences', {
      headers: { Authorization: `Bearer ${registerBody.access_token}` },
      data: {
        role: 'fan',
        onboarding_completed: true,
        step_2_visited: true,
      },
    });
    expect([200, 204]).toContain(prefsRes.status());

    const meRes = await request.get('http://localhost:4000/auth/me', {
      headers: { Authorization: `Bearer ${registerBody.access_token}` },
    });
    expect(meRes.ok()).toBeTruthy();
    const meBody = await meRes.json();
    expect(meBody.preferences?.role).toBe('fan');
    expect(meBody.preferences?.onboarding_completed).toBe(true);
  });
});
