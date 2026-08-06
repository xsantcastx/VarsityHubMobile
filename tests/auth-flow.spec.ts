import { expect, test, type Locator, type Page } from '@playwright/test';

const generateTestEmail = () => `e2e-auth-${Date.now()}@varsityhub-test.app`;

async function enableEmailSignUp(
  termsCheckbox: Locator,
  ageCheckbox: Locator,
  emailSignupButton: Locator
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

async function recoverFromOfflineBanner(page: Page) {
  const offlineMessage = page
    .getByText(/API unreachable|Unable to connect to server|No internet connection/i)
    .first();

  if (!(await offlineMessage.isVisible().catch(() => false))) {
    return false;
  }

  const retryButton = page.getByText('Retry', { exact: true }).first();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await retryButton.click();
    await page.waitForTimeout(1000);

    if (!(await offlineMessage.isVisible().catch(() => false))) {
      return true;
    }
  }

  await expect(offlineMessage).toBeHidden({ timeout: 10000 });
  return true;
}

async function waitForVerificationScreen(page: Page) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForURL(/\/verify(?:-email)?(?:\?|$)/, { timeout: 7000 });
      await expect(page.getByText('Check Your Email')).toBeVisible({ timeout: 7000 });
      await expect(page.getByText(/we sent a 6-digit verification code/i)).toBeVisible({
        timeout: 7000,
      });
      return;
    } catch (error) {
      lastError = error;
      await recoverFromOfflineBanner(page);
    }
  }

  throw lastError;
}

async function submitSignInRequest(page: Page) {
  const signInButton = page.getByLabel('Sign In');
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const responsePromise = page.waitForResponse(
        response =>
          response.request().method() === 'POST' && response.url().includes('/auth/login'),
        { timeout: 5000 }
      );
      await signInButton.click();
      await responsePromise;
      return;
    } catch (error) {
      lastError = error;
      await recoverFromOfflineBanner(page);
    }
  }

  throw lastError;
}

async function submitSignUpRequest(page: Page) {
  const createAccountButton = page.getByLabel('Create account');
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const responsePromise = page.waitForResponse(
        response =>
          response.request().method() === 'POST' && response.url().includes('/auth/register'),
        { timeout: 7000 }
      );
      await createAccountButton.click();
      await responsePromise;
      return;
    } catch (error) {
      lastError = error;
      await recoverFromOfflineBanner(page);
    }
  }

  throw lastError;
}

async function completeSignInToVerification(page: Page) {
  const signInError = page
    .getByText(
      /Login failed|Unable to connect to server|Server is temporarily unavailable|Invalid email or password/i
    )
    .first();
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForVerificationScreen(page);
      return;
    } catch (error) {
      lastError = error;
      await recoverFromOfflineBanner(page);

      if (await signInError.isVisible().catch(() => false)) {
        await submitSignInRequest(page);
      }
    }
  }

  throw lastError;
}

test.describe('Authentication Flow', () => {
  test('User can sign up, sign out, and sign back in through verification flow', async ({
    page,
    baseURL,
  }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';

    await page.goto(`${baseURL}/sign-up`);
    await recoverFromOfflineBanner(page);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    const termsCheckbox = page.getByRole('checkbox', {
      name: /I agree to the Terms of (Use|Service) and Privacy Policy/,
    });
    const ageCheckbox = page.getByRole('checkbox', {
      name: 'I confirm I am at least 13 years old',
    });
    const emailSignupButton = page.getByLabel('Sign up with Email');

    await enableEmailSignUp(termsCheckbox, ageCheckbox, emailSignupButton);
    await emailSignupButton.click();

    await page.getByLabel('Email').fill(email);
    // Use the stable testID: getByLabel('Password') substring-matches the
    // show/hide toggle's "Show password" label and resolves to 2 elements.
    await page.getByTestId('sign-up-password').fill(password);
    await submitSignUpRequest(page);

    await waitForVerificationScreen(page);

    await page.getByRole('button', { name: /wrong account\? sign out/i }).click();
    await recoverFromOfflineBanner(page);
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByTestId('sign-in-email').fill(email);
    await page.getByTestId('sign-in-password').fill(password);
    await recoverFromOfflineBanner(page);
    await submitSignInRequest(page);

    await completeSignInToVerification(page);
  });
});
