import { describe, expect, it } from '@jest/globals';
import {
  loginSchema,
  passwordChangeSchema,
  refreshSchema,
  registerSchema,
  upgradeToCoachSchema,
} from '../validators/authSchemas.js';

describe('auth schemas', () => {
  it('requires passwords with at least one letter and one number', () => {
    expect(registerSchema.safeParse({ email: 'a@example.com', password: 'password' }).success).toBe(
      false
    );
    expect(
      registerSchema.safeParse({ email: 'a@example.com', password: 'password1' }).success
    ).toBe(true);
  });

  it('keeps login and refresh validation narrow', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
    expect(refreshSchema.safeParse({ refresh_token: 'short' }).success).toBe(false);
    expect(refreshSchema.safeParse({ refresh_token: 'x'.repeat(32) }).success).toBe(true);
  });

  it('accepts only supported coach upgrade plans', () => {
    expect(upgradeToCoachSchema.safeParse({ plan: 'rookie' }).success).toBe(true);
    expect(upgradeToCoachSchema.safeParse({ plan: 'enterprise' }).success).toBe(false);
  });

  it('applies the same password rule to password changes', () => {
    expect(
      passwordChangeSchema.safeParse({
        current_password: 'old-password',
        new_password: 'newpass',
      }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({
        current_password: 'old-password',
        new_password: 'newpass1',
      }).success
    ).toBe(true);
  });
});
