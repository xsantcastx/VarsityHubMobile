import { expect, test } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:8081';

async function expectPublicFeedShell(page: any) {
  await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  await expect(page.locator('body')).toContainText('View Events Map', { timeout: 20000 });
  await expect(page.locator('body')).toContainText('Feed', { timeout: 20000 });
}

test.describe('Step 4: Organization Creation', () => {
  test('legacy organization onboarding route now resolves to the not-found screen', async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/onboarding/step-4-organization`, { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
    await expect(page.locator('body')).toContainText('This screen does not exist.', {
      timeout: 20000,
    });
    await expect(page.locator('body')).toContainText('Go to home screen!', { timeout: 20000 });
  });

  test('current organization onboarding route lands anonymous web users on the public feed', async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/onboarding/step-3-league`, { waitUntil: 'domcontentloaded' });
    await expectPublicFeedShell(page);
  });

  test('current organization onboarding route does not expose retired sign-up shell copy', async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/onboarding/step-3-league`, { waitUntil: 'domcontentloaded' });
    await expectPublicFeedShell(page);

    await expect(page.locator('body')).not.toContainText('Create Account');
    await expect(page.locator('body')).not.toContainText('Already have an account? Sign in');
  });
});
