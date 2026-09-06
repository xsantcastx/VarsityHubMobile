import { z } from 'zod';

export const passwordRequirement = z
  .string()
  .min(8)
  .refine(val => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
    message: 'Password must contain at least one letter and one number',
  });

// Current Terms of Service version. Stamped onto User.terms_version at
// registration; bump when the ToS (app/settings/terms-of-service.tsx) changes
// materially so we can tell which users accepted which version.
export const CURRENT_TERMS_VERSION = 1;

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: passwordRequirement,
  display_name: z.string().optional(),
  // Rookie is a coach plan, not a role.
  role: z.enum(['fan', 'coach']).optional(),
  dob: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(32),
});

export const deleteAccountSchema = z.object({
  password: z.string().optional(),
  delete_confirmation: z.string().optional(),
});

export const googleAuthSchema = z.object({
  id_token: z.string().min(10),
});

export const appleAuthSchema = z.object({
  identity_token: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: passwordRequirement,
});

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordRequirement,
});

export const upgradeToCoachSchema = z.object({
  plan: z.enum(['rookie', 'veteran', 'legend']),
});
