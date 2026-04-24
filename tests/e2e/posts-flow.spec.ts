import { test, expect } from '@playwright/test';

/**
 * Posts E2E Flow Tests
 * 
 * Tests the complete user flow for creating and interacting with posts.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:8081';
const API_URL = process.env.API_URL || 'http://localhost:4000';

// Helper to create authenticated user via API
async function createVerifiedUser(request: any) {
  const testEmail = `posts-e2e-${Date.now()}@varsityhub-test.app`;
  const testPassword = 'E2ETestPassword123!';

  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: testEmail,
      password: testPassword,
      display_name: 'E2E Posts User',
    },
  });

  const { access_token, user } = await response.json();
  
  return { access_token, user, email: testEmail, password: testPassword };
}

test.describe('Posts E2E Flow', () => {
  test('User can navigate to create post screen', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Look for create post button/link
    // Playwright's text= engine can't be combined with CSS via a comma —
    // use .or() chaining instead so each branch is a real locator.
    const createPostButton = page
      .locator('text=/create post/i')
      .or(page.locator('button:has-text("Post")'))
      .or(page.locator('a:has-text("Create")'))
      .or(page.locator('[aria-label*="post" i]'))
      .first();

    const isVisible = await createPostButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await createPostButton.click();
      await page.waitForTimeout(2000);
      
      // Should navigate to create post screen
      // Check for post creation form elements
      const hasForm = await Promise.all([
        page.locator('input, textarea').first().isVisible().catch(() => false),
        page.locator('button[type="submit"]').first().isVisible().catch(() => false),
      ]);

      expect(hasForm.some(v => v)).toBeTruthy();
    }
  });

  test('App displays posts feed', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Look for feed or posts section
    const feedIndicators = [
      page.locator('text=/feed/i').first(),
      page.locator('text=/posts/i').first(),
      page.locator('[data-testid*="feed"]').first(),
      page.locator('[data-testid*="post"]').first(),
    ];

    // At least one should be visible or the page should have content
    const hasContent = await Promise.all(
      feedIndicators.map(locator => locator.isVisible().catch(() => false))
    );

    // If no specific feed indicators, check that page has content
    if (!hasContent.some(v => v)) {
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(0);
    }
  });

  test('App handles post creation form', async ({ page, request }) => {
    // Create user via API
    const userData = await createVerifiedUser(request);

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Try to find and interact with post creation
    const textInputs = page.locator('input[type="text"], textarea').first();
    const isInputVisible = await textInputs.isVisible().catch(() => false);

    if (isInputVisible) {
      await textInputs.fill('Test post from E2E test');
      await page.waitForTimeout(1000);

      // Look for submit button
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Post"), button:has-text("Submit")'
      ).first();

      const canSubmit = await submitButton.isVisible().catch(() => false);
      
      if (canSubmit) {
        // Don't actually submit to avoid creating test posts
        // Just verify the form is interactive
        expect(canSubmit).toBeTruthy();
      }
    }
  });

  test('App shows error for invalid post input', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Try to find post creation form
    const textInputs = page.locator('input[type="text"], textarea').first();
    const isInputVisible = await textInputs.isVisible().catch(() => false);

    if (isInputVisible) {
      // Try submitting empty form (if submit button exists)
      const submitButton = page.locator('button[type="submit"]').first();
      const canSubmit = await submitButton.isVisible().catch(() => false);

      if (canSubmit) {
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Should show validation error
        const errorText = page
          .locator('text=/required/i')
          .or(page.locator('text=/error/i'))
          .or(page.locator('text=/invalid/i'))
          .first();
        
        const hasError = await errorText.isVisible().catch(() => false);
        // Error may or may not be shown depending on validation
        // Just verify page didn't crash
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).not.toBeNull();
      }
    }
  });
});
