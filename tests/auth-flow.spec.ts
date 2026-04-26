import { expect, test, type Locator } from '@playwright/test';

const generateTestEmail = () => `e2e-auth-${Date.now()}@varsityhub-test.app`;

async function enableEmailSignUp(termsCheckbox: Locator, ageCheckbox: Locator, emailSignupButton: Locator) {
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

test.describe('Authentication Flow', () => {
  test('User can sign up, sign out, and sign back in through verification flow', async ({ page, baseURL }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';

    await page.goto(`${baseURL}/sign-up`);
    await expect(page.getByText('Create Account')).toBeVisible();

    const termsCheckbox = page.getByRole('checkbox', { name: 'I agree to the Terms of Service and Privacy Policy' });
    const ageCheckbox = page.getByRole('checkbox', { name: 'I confirm I am at least 13 years old' });
    const emailSignupButton = page.getByLabel('Sign up with Email');

    await enableEmailSignUp(termsCheckbox, ageCheckbox, emailSignupButton);
    await emailSignupButton.click();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Create account').click();

    await expect(page.getByText('Check Your Email')).toBeVisible();
    await expect(page.getByText(/we sent a 6-digit verification code/i)).toBeVisible();

    await page.getByLabel('Sign out and use a different account').click();
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByTestId('sign-in-email').fill(email);
    await page.getByTestId('sign-in-password').fill(password);
    await page.getByLabel('Sign In').click();

    await expect(page.getByText('Check Your Email')).toBeVisible();
  });
});
