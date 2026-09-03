import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:8081';

async function gotoAndWait(page: Page, path: string) {
  await page.goto(`${APP_URL}${path}`);
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

async function expectPublicFeedShell(page: Page) {
  await expect(page.getByText('View Games Nearby')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Feed' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Highlights' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Discover' })).toBeVisible();
}

test.describe('Front-End Visibility Tests', () => {
  test('Sign-in route resolves to a visible web shell', async ({ page }) => {
    await gotoAndWait(page, '/sign-in');

    await expectPublicFeedShell(page);
  });

  test('Public web shell keeps readable text and navigation sizing', async ({ page }) => {
    await gotoAndWait(page, '/sign-in');

    const title = page.getByText('View Games Nearby');
    const feedTab = page.getByRole('tab', { name: 'Feed' });
    const discoverTab = page.getByRole('tab', { name: 'Discover' });

    const titleFontSize = await title.evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize)
    );
    const feedFontSize = await feedTab.evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize)
    );
    const discoverFontSize = await discoverTab.evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize)
    );

    expect(titleFontSize).toBeGreaterThanOrEqual(14);
    expect(feedFontSize).toBeGreaterThanOrEqual(10);
    expect(discoverFontSize).toBeGreaterThanOrEqual(10);
  });

  test('Root route resolves to a visible public shell without fatal console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await gotoAndWait(page, '');

    await expectPublicFeedShell(page);

    const criticalErrors = consoleErrors.filter(
      error =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('extension') &&
        !error.includes('Download the React DevTools') &&
        !error.includes('games/seed-samples') &&
        !error.includes('401 (Unauthorized)')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Create-account route resolves to a visible web shell', async ({ page }) => {
    await gotoAndWait(page, '/sign-up');

    await expectPublicFeedShell(page);
  });

  test('Create-account route does not render a blank page', async ({ page }) => {
    await gotoAndWait(page, '/sign-up');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('Payment-success stays on the public handoff screen without bouncing anonymous users into auth', async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await gotoAndWait(page, '/payment-success?type=ad');

    await expect(page).toHaveURL(/\/payment-success\?type=ad$/);
    const pageText = await page.locator('body').innerText();
    expect(pageText).toContain('Verification Issue');
    expect(pageText).toContain(
      'Payment session information is missing. If you completed payment, please contact support.'
    );
    expect(pageText).not.toContain('Create Account');

    const redirectLogs = consoleMessages.filter(message =>
      message.includes('Redirecting to /sign-up (unauthenticated)')
    );
    expect(redirectLogs).toHaveLength(0);
  });

  test('Payment-cancel stays readable as a public screen for anonymous visitors', async ({
    page,
  }) => {
    await gotoAndWait(page, '/payment-cancel?type=subscription');

    await expect(page).toHaveURL(/\/payment-cancel\?type=subscription$/);
    const pageText = await page.locator('body').innerText();
    expect(pageText).toContain('Payment Cancelled');
    expect(pageText).toContain(
      'Your payment was cancelled. You can try again or continue with limited features.'
    );
    expect(pageText).toContain('Try Payment Again');
    expect(pageText).toContain('Continue with Free Version');
  });
});
