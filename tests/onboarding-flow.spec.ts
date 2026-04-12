import { expect, test } from '@playwright/test';

const API_BASE_URL =
  process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4100';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@varsityhub-test.app`;
}

async function createVerifiedUser(request: any) {
  const email = uniqueEmail('onboarding-flow');
  const password = 'TestPassword123!';

  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: 'Onboarding Flow User',
    },
  });

  expect(registerResponse.status()).toBe(201);
  const registerBody = await registerResponse.json();

  if (registerBody.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: {
        Authorization: `Bearer ${registerBody.access_token}`,
      },
      data: {
        code: String(registerBody.dev_verification_code),
      },
    });

    expect(verifyResponse.ok()).toBeTruthy();
  }

  return { email, password };
}

test.describe('Onboarding Flow', () => {
  test('verified new users enter onboarding and can advance from role selection', async ({
    page,
    request,
  }) => {
    const user = await createVerifiedUser(request);

    // React Native Web TextInputs re-render on hydration; filling them before
    // the form has finished mounting races that re-render and the first
    // `fill()` silently no-ops. Gate on the page header being visible first,
    // matching the pattern in `tests/auth-flow.spec.ts`.
    await page.goto('/sign-in');
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByPlaceholder('name@school.edu').fill(user.email);
    await page.getByPlaceholder('Enter your password').fill(user.password);
    await page.getByText('Sign In', { exact: true }).last().click();

    await page.waitForURL(/\/onboarding\/step-1-role/, { timeout: 15000 });
    await expect(page.getByText('Fan', { exact: true })).toBeVisible();
    await expect(page.getByText('Coach / Organizer', { exact: true })).toBeVisible();

    await page.getByLabel('Select Fan role').click();
    await page.getByLabel('Continue').click();

    await page.waitForURL(/\/onboarding\/step-2-basic/, { timeout: 15000 });
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByPlaceholder('username')).toBeVisible();
  });
});
