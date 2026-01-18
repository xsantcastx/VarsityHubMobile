import { expect, test } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('User can complete onboarding steps', async ({ page }) => {
    await page.goto('http://localhost:8081'); // Adjust port if needed
    await page.click('text=Sign Up');
    await page.fill('input[name="email"]', 'onboarduser@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('text=Create Account');
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Step 1: Role selection
    await page.click('text=Athlete');
    await page.click('text=Next');
    // Step 2: Basic info
    await page.fill('input[name="firstName"]', 'Onboard');
    await page.fill('input[name="lastName"]', 'User');
    await page.click('text=Next');
    // Step 3: Plan selection
    await page.click('text=Free Plan');
    await page.click('text=Next');
    // ...continue for other steps as needed...
    await expect(page.locator('text=Onboarding Complete')).toBeVisible();
  });
});
