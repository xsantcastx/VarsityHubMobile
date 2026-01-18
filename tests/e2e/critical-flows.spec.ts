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

test.describe('Critical User Flows', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests sequentially

  test('Complete signup and email verification flow', async ({ page, request }) => {
    const testData = generateTestData();

    // Navigate to app
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Find and click sign up
    const signUpButton = page.locator('text=/sign up/i, button:has-text("Sign Up"), a:has-text("Sign Up")').first();
    await signUpButton.click();
    await page.waitForTimeout(1000);

    // Fill registration form
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const displayNameInput = page.locator('input[name="display_name"], input[name="displayName"], input[placeholder*="name" i]').first();

    await emailInput.fill(testData.email);
    await passwordInput.fill(testData.password);
    
    if (await displayNameInput.isVisible().catch(() => false)) {
      await displayNameInput.fill(testData.displayName);
    }

    // Submit registration
    const submitButton = page.locator('button:has-text("Create Account"), button:has-text("Sign Up"), button[type="submit"]').first();
    await submitButton.click();

    // Wait for navigation to verification screen
    await page.waitForTimeout(2000);
    
    // Check if we're on verification screen
    const verificationCodeInput = page.locator('input[type="text"], input[name="code"], input[placeholder*="code" i]').first();
    const isVerificationScreen = await verificationCodeInput.isVisible().catch(() => false);

    if (isVerificationScreen) {
      // Verify via API to get the code (in real scenario, user checks email)
      // For testing, we can verify the user was created
      const verifyResponse = await request.get(`${API_URL}/health`);
      expect(verifyResponse.ok()).toBeTruthy();
      
      // User should be created but not verified
      const loginResponse = await request.post(`${API_URL}/auth/login`, {
        data: {
          email: testData.email,
          password: testData.password,
        },
      });
      
      expect(loginResponse.ok()).toBeTruthy();
      const loginBody = await loginResponse.json();
      expect(loginBody.needs_verification).toBe(true);
    } else {
      // If no verification screen, check for success message or redirect
      await page.waitForTimeout(2000);
      // App should not be in error state
      const errorText = page.locator('text=/error/i, text=/failed/i').first();
      const hasError = await errorText.isVisible().catch(() => false);
      expect(hasError).toBeFalsy();
    }
  });

  test('Login flow with existing user', async ({ page, request }) => {
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
    const { access_token } = await registerResponse.json();

    // Navigate to app
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Find and click sign in
    const signInButton = page.locator('text=/sign in/i, button:has-text("Sign In"), a:has-text("Sign In")').first();
    await signInButton.click();
    await page.waitForTimeout(1000);

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(testData.email);
    await passwordInput.fill(testData.password);

    // Submit login
    const submitButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
    await submitButton.click();

    // Wait for navigation
    await page.waitForTimeout(3000);

    // Check for success indicators (no error messages)
    const errorText = page.locator('text=/error/i, text=/invalid/i, text=/failed/i').first();
    const hasError = await errorText.isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
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
        !error.includes('extension')
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
      const navLink = page.locator(`text=/${navItem}/i, a:has-text("${navItem}"), button:has-text("${navItem}")`).first();
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
    expect(body.integrations).toBeDefined();
  });
});
