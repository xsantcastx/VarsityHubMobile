import { expect, test } from '@playwright/test';

const API_BASE_URL =
  process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4100';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@varsityhub-test.app`;
}

async function createVerifiedUser(request: any) {
  const email = uniqueEmail('auth-flow');
  const password = 'TestPassword123!';

  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: 'Auth Flow User',
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

test.describe('Authentication Flow', () => {
  test('sign-up screen creates an account and redirects to verification', async ({ page }) => {
    const email = uniqueEmail('sign-up-ui');
    const password = 'TestPassword123!';

    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    await page.getByText('Sign up with Email').click();
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByText('Sign Up', { exact: true }).last().click();

    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByText('Check Your Email')).toBeVisible();
    await expect(page.getByPlaceholder('123456')).toBeVisible();
  });

  test('verified users can sign in and leave the auth screen', async ({ page, request }) => {
    const user = await createVerifiedUser(request);

    await page.goto('/sign-in');
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByPlaceholder('name@school.edu').fill(user.email);
    await page.getByPlaceholder('Enter your password').fill(user.password);
    await page.getByText('Sign In', { exact: true }).last().click();

    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15000 });
    expect(page.url()).not.toContain('/sign-in');
  });
});
