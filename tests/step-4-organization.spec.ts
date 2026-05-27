import { expect, test } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:8081';

async function expectAuthShell(page: any) {
  await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  // On web, unauthenticated users land on /sign-up ("Create Account")
  await expect(page.locator('body')).toContainText('Create Account', { timeout: 20000 });
  await expect(page.locator('body')).toContainText("Choose how you'd like to sign up", {
    timeout: 20000,
  });
  await expect(page.locator('body')).toContainText('Already have an account? Sign in', { timeout: 20000 });
}

test.describe('Step 4: Organization Creation', () => {
  test('legacy organization onboarding route now resolves to the not-found screen', async ({ page }) => {
    await page.goto(`${APP_URL}/onboarding/step-4-organization`, { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
    await expect(page.locator('body')).toContainText('This screen does not exist.', {
      timeout: 20000,
    });
    await expect(page.locator('body')).toContainText('Go to home screen!', { timeout: 20000 });
  });

  test('current organization onboarding route redirects unauthenticated users to sign-up', async ({ page }) => {
    await page.goto(`${APP_URL}/onboarding/step-3-league`, { waitUntil: 'domcontentloaded' });
    await expectAuthShell(page);
  });

  test('redirected auth shell still exposes the sign-in link', async ({ page }) => {
    await page.goto(`${APP_URL}/onboarding/step-3-league`, { waitUntil: 'domcontentloaded' });
    await expectAuthShell(page);

    await page.getByText('Already have an account? Sign in').click();
    await expect(page.locator('body')).toContainText('Welcome back', { timeout: 20000 });
  });
});
