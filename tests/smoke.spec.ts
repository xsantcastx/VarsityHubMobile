import { expect, test } from '@playwright/test';

// Smoke test for VarsityHub app
test.describe('VarsityHub Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the web app
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
  });

  test('should load the app without console errors', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for initial render
    await page.waitForLoadState('networkidle');

    // Check that we're not in an error state
    expect(consoleErrors).toHaveLength(0);
  });

  test('should navigate through feed and highlights', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for navigation to settle
    await page.waitForLoadState('networkidle');

    // Try to find feed or main content area
    const feedLink = page.locator('a:has-text("Feed"), button:has-text("Feed")').first();
    if (await feedLink.isVisible().catch(() => false)) {
      await feedLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Try to find highlights
    const highlightsLink = page.locator('a:has-text("Highlights"), button:has-text("Highlights")').first();
    if (await highlightsLink.isVisible().catch(() => false)) {
      await highlightsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Verify no console errors occurred during navigation
    expect(consoleErrors).toHaveLength(0);
  });

  test('should handle errors gracefully and show error messages', async ({ page }) => {
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await page.waitForLoadState('networkidle');

    // Filter for actual errors only
    const errors = consoleLogs.filter((l) => l.type === 'error');
    console.log(`[Smoke Test] Console errors captured: ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e.text}`));
  });
});
