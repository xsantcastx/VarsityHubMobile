import { expect, test } from '@playwright/test';

// Basic Playwright E2E test for auth flow

test.describe('Authentication Flow', () => {
  test('User can sign up, sign in, and sign out', async ({ page }) => {
    await page.goto('http://localhost:8081'); // Adjust port if needed
    await page.click('text=Sign Up');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('text=Create Account');
    await expect(page.locator('text=Welcome')).toBeVisible();

    await page.click('text=Sign Out');
    await expect(page.locator('text=Sign In')).toBeVisible();

    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('text=Sign In');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });
});
