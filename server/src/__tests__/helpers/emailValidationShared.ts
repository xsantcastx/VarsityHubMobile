import { expect, it } from '@jest/globals';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function defineEmailValidationCases(validEmails: string[], invalidEmails: string[]) {
  validEmails.forEach(email => {
    it(`should accept valid email: ${email}`, () => {
      expect(email).toMatch(emailRegex);
    });
  });

  invalidEmails.forEach(email => {
    it(`should reject invalid email: ${email}`, () => {
      expect(email).not.toMatch(emailRegex);
    });
  });
}
