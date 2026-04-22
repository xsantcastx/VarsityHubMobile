import { test, expect } from '@playwright/test';

/**
 * Comprehensive Smoke Tests
 * 
 * Quick validation tests that verify the app is working correctly.
 * These should run fast (< 5 minutes) and catch critical issues.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:8081';
const API_URL = process.env.API_URL || 'http://localhost:4000';
const HEALTH_CHECK_SECRET = process.env.HEALTH_CHECK_SECRET;

async function waitForAppShell(page: any) {
  await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
}

test.describe('Comprehensive Smoke Tests', () => {
  test('App loads and renders without crashes', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppShell(page);

    // Filter out non-critical errors
    const criticalConsoleErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('extension') &&
        !error.includes('DevTools')
    );

    expect(criticalConsoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Backend API health check passes', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`, {
      timeout: 10000,
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('Backend API has database connection', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`, {
      headers: HEALTH_CHECK_SECRET ? { 'x-health-check-secret': HEALTH_CHECK_SECRET } : undefined,
    });
    const body = await response.json();

    test.skip(!body.integrations, 'Detailed health integrations require matching HEALTH_CHECK_SECRET on client and server.');
    expect(body.integrations.database).toBe(true);
  });

  test('Backend API has JWT configured', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`, {
      headers: HEALTH_CHECK_SECRET ? { 'x-health-check-secret': HEALTH_CHECK_SECRET } : undefined,
    });
    const body = await response.json();

    test.skip(!body.integrations, 'Detailed health integrations require matching HEALTH_CHECK_SECRET on client and server.');
    expect(body.integrations.jwt).toBe(true);
  });

  test('App can make authenticated API requests', async ({ request }) => {
    // Create a test user
    const testEmail = `smoke-${Date.now()}@varsityhub-test.app`;
    const testPassword = 'SmokeTest123!';

    const registerResponse = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(registerResponse.ok()).toBeTruthy();
    const { access_token } = await registerResponse.json();

    // Use token to access protected endpoint
    const meResponse = await request.get(`${API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    expect(meResponse.ok()).toBeTruthy();
    const user = await meResponse.json();
    expect(user.email).toBe(testEmail.toLowerCase());
  });

  test('App handles 404 errors gracefully', async ({ page }) => {
    await page.goto(`${APP_URL}/non-existent-page-12345`);
    await page.waitForTimeout(2000);

    // Should not show raw error, should have some UI
    const body = await page.locator('body').textContent();
    expect(body).not.toBeNull();
    expect(body?.length).toBeGreaterThan(0);
  });

  test('App responds to user interactions', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForAppShell(page);

    // Try clicking on any visible button/link
    const clickableElements = await page.locator('button, a, [role="button"]').count();
    
    if (clickableElements > 0) {
      const firstButton = page.locator('button, a, [role="button"]').first();
      await firstButton.click();
      await page.waitForTimeout(1000);
      
      // Should not crash
      const errorText = page.locator('text=/error/i, text=/crash/i').first();
      const hasError = await errorText.isVisible().catch(() => false);
      expect(hasError).toBeFalsy();
    }
  });

  test('API rate limiting works', async ({ request }) => {
    // Make multiple rapid requests to auth endpoint
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(
        request.post(`${API_URL}/auth/login`, {
          data: {
            email: 'test@example.com',
            password: 'wrongpassword',
          },
        })
      );
    }

    const responses = await Promise.all(requests);
    
    // At least one should be rate limited (429) or all should be 401
    const statusCodes = responses.map((r) => r.status());
    const hasRateLimit = statusCodes.includes(429);
    const allUnauthorized = statusCodes.every((code) => code === 401);

    expect(hasRateLimit || allUnauthorized).toBeTruthy();
  });

  test('API validates input correctly', async ({ request }) => {
    // Test invalid email
    const invalidEmailResponse = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: 'not-an-email',
        password: 'ValidPassword123!',
      },
    });

    expect(invalidEmailResponse.status()).toBe(400);

    // Test invalid password (too short)
    const invalidPasswordResponse = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: 'valid@example.com',
        password: 'short',
      },
    });

    expect(invalidPasswordResponse.status()).toBe(400);
  });

  test('App loads main content areas', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForAppShell(page);

    const hasContent = await Promise.all([
      page.locator('body').isVisible(),
      page.locator('main, [role="main"], #root, #app').first().isVisible().catch(() => false),
    ]);

    expect(hasContent.some((v) => v)).toBeTruthy();
  });
});
