import { test, expect, type Page } from '@playwright/test';

/**
 * Critical User Flow E2E Tests
 *
 * These tests cover the most important user journeys that must work
 * for the app to be functional. These are longer-running tests that
 * simulate real user behavior.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:8081';
const API_URL = process.env.API_URL || 'http://localhost:4000';

// Helper to generate unique test data
const generateTestData = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `e2e-${timestamp}-${random}@varsityhub-test.app`,
    password: 'E2ETestPassword123!',
    displayName: `E2E Test User ${timestamp}`,
  };
};

async function enableEmailSignUp(page: Page) {
  const termsCheckbox = page.getByRole('checkbox', {
    name: /I agree to the Terms of (Use|Service) and Privacy Policy/,
  });
  const ageCheckbox = page.getByRole('checkbox', { name: 'I confirm I am at least 13 years old' });
  const emailSignupButton = page.getByLabel('Sign up with Email');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await emailSignupButton.isEnabled()) {
      return emailSignupButton;
    }

    await termsCheckbox.click({ position: { x: 12, y: 12 } });
    if (await emailSignupButton.isEnabled()) {
      return emailSignupButton;
    }

    await ageCheckbox.click({ position: { x: 12, y: 12 } });
    if (await emailSignupButton.isEnabled()) {
      return emailSignupButton;
    }
  }

  await expect(emailSignupButton).toBeEnabled();
  return emailSignupButton;
}

test.describe('Critical User Flows', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests sequentially

  test('Complete signup and email verification flow', async ({ page }) => {
    const testData = generateTestData();

    await page.goto(`${APP_URL}/sign-up`);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    const emailSignupButton = await enableEmailSignUp(page);
    await emailSignupButton.click();

    await page.getByLabel('Email').fill(testData.email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(testData.password);
    await page.getByLabel('Create account').click();

    await expect(page.getByText('Check Your Email')).toBeVisible();
    await expect(page.getByText(/we sent a 6-digit verification code/i)).toBeVisible();
  });

  test('Sign-in screen exposes the current auth entry points', async ({ page }) => {
    await page.goto(`${APP_URL}/sign-in`);

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByTestId('sign-in-email')).toBeVisible();
    await expect(page.getByTestId('sign-in-password')).toBeVisible();
    await expect(page.getByLabel('Sign In', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Need an account? Create one')).toBeVisible();
  });

  test('App should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(
      error =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('extension') &&
        !error.includes('games/seed-samples') &&
        !error.includes('401 (Unauthorized)')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Navigation between main sections', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Try to find and click the visible tab bar items.
    const navItems = ['Feed', 'Highlights', 'Create', 'Discover', 'Profile'];

    for (const navItem of navItems) {
      const navLink = page.getByRole('tab', { name: navItem }).first();
      const isVisible = await navLink.isVisible().catch(() => false);

      if (isVisible) {
        await navLink.click();
        await page.waitForTimeout(1000);
        await page.waitForLoadState('networkidle');

        // Verify no errors
        const errorText = page.locator('text=/error/i').first();
        const hasError = await errorText.isVisible().catch(() => false);
        expect(hasError).toBeFalsy();
      }
    }
  });

  test('Health check endpoint accessible', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
