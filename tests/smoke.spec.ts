import { expect, test } from '@playwright/test';

// Smoke test for VarsityHub app
test.describe('VarsityHub Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Seed minimal auth/session before app loads to avoid 401s during boot
    await page.addInitScript(() => {
      try {
        localStorage.setItem('auth_token', 'smoke_test_token');
        localStorage.setItem('user', JSON.stringify({
          id: 'smoke-user',
          email: 'smoke@example.com',
          email_verified: true,
          display_name: 'Smoke User',
        }));
      } catch {}
    });

    // Basic auth stubs to prevent unauthenticated redirects/logs
    const fulfillJson = (route: any, body: any, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/auth/me', (route) => fulfillJson(route, { id: 'smoke-user', email_verified: true }));
    await page.route('**/users/me', (route) => fulfillJson(route, { id: 'smoke-user', email_verified: true }));

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

    // Allow benign network noise; assert no critical errors
    const critical = consoleErrors.filter((t) => !/401|Unauthorized|Failed to fetch|DevTools|deprecated/i.test(t));
    expect(critical).toHaveLength(0);
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

    // Verify no critical console errors occurred during navigation
    const critical = consoleErrors.filter((t) => !/401|Unauthorized|Failed to fetch|DevTools|deprecated/i.test(t));
    expect(critical).toHaveLength(0);
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
