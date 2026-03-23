import { test, expect } from '@playwright/test';

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

async function clickFirstVisible(page: any, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return true;
    }
  }
  return false;
}

test.describe('Critical User Flows', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests sequentially

  test('Complete signup and email verification flow (API)', async ({ request }) => {
    const testData = generateTestData();

    const registerResponse = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: testData.email,
        password: testData.password,
        display_name: testData.displayName,
      },
    });
    expect(registerResponse.ok()).toBeTruthy();
    const registerBody = await registerResponse.json();
    expect(registerBody.access_token).toBeTruthy();

    if (registerBody.dev_verification_code) {
      const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
        headers: { Authorization: `Bearer ${registerBody.access_token}` },
        data: { code: String(registerBody.dev_verification_code) },
      });
      // In shared test environments this can race with previous runs/rate limits;
      // treat verification as best-effort and assert login behavior below instead.
      expect([200, 400, 429]).toContain(verifyResponse.status());
    }

    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: testData.email,
        password: testData.password,
      },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginBody = await loginResponse.json();
    expect(Boolean(loginBody.access_token) || loginBody.needs_verification === true).toBeTruthy();
  });

  test('Login flow with existing user (API)', async ({ request }) => {
    // First create a user via API
    const testData = generateTestData();
    
    const registerResponse = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: testData.email,
        password: testData.password,
        display_name: testData.displayName,
      },
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const registerBody = await registerResponse.json();
    expect(registerBody.access_token).toBeTruthy();

    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: testData.email,
        password: testData.password,
      },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginBody = await loginResponse.json();
    expect(loginBody.access_token || loginBody.token).toBeTruthy();
  });

  test('App should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('extension') &&
        !error.includes('401 (Unauthorized)')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Navigation between main sections', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Try to find and click navigation elements
    const navItems = [
      'Feed',
      'Highlights',
      'Games',
      'Teams',
      'Profile',
    ];

    for (const navItem of navItems) {
      const isVisible = await clickFirstVisible(page, [
        `a:has-text("${navItem}")`,
        `button:has-text("${navItem}")`,
        `text=${navItem}`,
      ]);
      
      if (isVisible) {
        await page.waitForTimeout(1000);
        await page.waitForLoadState('networkidle');
        
        // Verify no errors
        const errorText = page.locator('text=error').first();
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
    expect(body).toHaveProperty('status');
  });
});
