import { expect, test, type Locator } from '@playwright/test';

const generateTestEmail = () => `onboarding-flow-${Date.now()}@varsityhub-test.app`;

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

test.describe('Onboarding Flow', () => {
  test('User can enter onboarding through the current account creation flow', async ({ page, baseURL }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';

    await page.goto(`${baseURL}/sign-in`);
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByLabel('Need an account? Create one').click();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    const termsCheckbox = page.getByRole('checkbox', {
      name: 'I agree to the Terms of Service and Privacy Policy',
    });
    const ageCheckbox = page.getByRole('checkbox', {
      name: 'I confirm I am at least 13 years old',
    });
    const emailSignupButton = page.getByLabel('Sign up with Email');

    await enableEmailSignUp(termsCheckbox, ageCheckbox, emailSignupButton);
    await emailSignupButton.click();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Create account').click();

    await expect(page.getByText('Check Your Email')).toBeVisible();
    await expect(page.getByText(/we sent a 6-digit verification code/i)).toBeVisible();
  });
});
