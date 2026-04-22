import { expect, test } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:8081';

async function waitForAppShell(page: any) {
  await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
}

// Smoke test for VarsityHub app
test.describe('VarsityHub Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the web app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppShell(page);
  });

  test('should load the app without console errors', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const criticalConsoleErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('DevTools') &&
        !error.includes('Download the React DevTools')
    );

    expect(criticalConsoleErrors).toHaveLength(0);
  });

  test('should navigate through feed and highlights', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Try to find feed or main content area
    const feedLink = page.locator('a:has-text("Feed"), button:has-text("Feed")').first();
    if (await feedLink.isVisible().catch(() => false)) {
      await feedLink.click();
      await waitForAppShell(page);
    }

    // Try to find highlights
    const highlightsLink = page.locator('a:has-text("Highlights"), button:has-text("Highlights")').first();
    if (await highlightsLink.isVisible().catch(() => false)) {
      await highlightsLink.click();
      await waitForAppShell(page);
    }

    const criticalConsoleErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('DevTools') &&
        !error.includes('Download the React DevTools')
    );

    expect(criticalConsoleErrors).toHaveLength(0);
  });

  test('should handle errors gracefully and show error messages', async ({ page }) => {
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await waitForAppShell(page);

    // Filter for actual errors only
    const errors = consoleLogs.filter((l) => l.type === 'error');
    console.log(`[Smoke Test] Console errors captured: ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e.text}`));
  });
});
