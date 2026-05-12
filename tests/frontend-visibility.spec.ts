import { expect, test, type Locator, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:8081';

async function gotoAndWait(page: Page, path: string) {
  await page.goto(`${APP_URL}${path}`);
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

async function enableEmailSignUp(
  termsCheckbox: Locator,
  ageCheckbox: Locator,
  emailSignupButton: Locator,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await emailSignupButton.isEnabled()) {
      return;
    }

    await termsCheckbox.click({ position: { x: 12, y: 12 } });
    if (await emailSignupButton.isEnabled()) {
      return;
    }

    await ageCheckbox.click({ position: { x: 12, y: 12 } });
    if (await emailSignupButton.isEnabled()) {
      return;
    }
  }

  await expect(emailSignupButton).toBeEnabled();
}

test.describe('Front-End Visibility Tests', () => {
  test('Sign-in screen renders the current auth controls', async ({ page }) => {
    await gotoAndWait(page, '/sign-in');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to keep your community in sync.')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByTestId('sign-in-email')).toBeVisible();
    await expect(page.getByTestId('sign-in-password')).toBeVisible();
    await expect(page.getByLabel('Sign In', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Need an account? Create one')).toBeVisible();
  });

  test('Sign-in screen keeps readable text and input sizing', async ({ page }) => {
    await gotoAndWait(page, '/sign-in');

    const title = page.getByText('Welcome back');
    const emailInput = page.getByTestId('sign-in-email');
    const submitButton = page.getByLabel('Sign In', { exact: true });

    const titleFontSize = await title.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    const inputFontSize = await emailInput.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    const buttonFontSize = await submitButton.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    expect(titleFontSize).toBeGreaterThanOrEqual(14);
    expect(inputFontSize).toBeGreaterThanOrEqual(14);
    expect(buttonFontSize).toBeGreaterThanOrEqual(14);
  });

  test('Root route resolves to a visible auth surface without fatal console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await gotoAndWait(page, '');

    await expect(
      page.getByText('Welcome back').or(page.getByRole('heading', { name: 'Create Account' })).first()
    ).toBeVisible();

    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('sourcemap') &&
        !error.includes('extension') &&
        !error.includes('Download the React DevTools')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Create-account route exposes the gated email sign-up controls', async ({ page }) => {
    await gotoAndWait(page, '/sign-up');

    const termsCheckbox = page.getByRole('checkbox', {
      name: /I agree to the Terms of (Use|Service) and Privacy Policy/,
    });
    const ageCheckbox = page.getByRole('checkbox', {
      name: 'I confirm I am at least 13 years old',
    });
    const emailSignupButton = page.getByLabel('Sign up with Email');

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(termsCheckbox).toBeVisible();
    await expect(ageCheckbox).toBeVisible();
    await expect(emailSignupButton).toBeDisabled();

    await enableEmailSignUp(termsCheckbox, ageCheckbox, emailSignupButton);
    await expect(emailSignupButton).toBeEnabled();
  });

  test('Create-account route reveals the email/password form after prerequisites are checked', async ({ page }) => {
    await gotoAndWait(page, '/sign-up');

    const termsCheckbox = page.getByRole('checkbox', {
      name: /I agree to the Terms of (Use|Service) and Privacy Policy/,
    });
    const ageCheckbox = page.getByRole('checkbox', {
      name: 'I confirm I am at least 13 years old',
    });
    const emailSignupButton = page.getByLabel('Sign up with Email');

    await enableEmailSignUp(termsCheckbox, ageCheckbox, emailSignupButton);
    await emailSignupButton.click();

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByLabel('Create account')).toBeVisible();
  });
});
