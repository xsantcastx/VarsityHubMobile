import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const linkedProvidersSchema = z
  .object({
    password: z.boolean().optional(),
    google: z.boolean().optional(),
    apple: z.boolean().optional(),
  })
  .passthrough();

const coachApplicationSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    organization_name: z.string().optional(),
    org_type: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    zip_code: z.string().nullable().optional(),
    supporting_document_url: z.string().nullable().optional(),
    background_url: z.string().nullable().optional(),
  })
  .passthrough();

const authPreferencesSchema = z
  .object({
    onboarding_completed: z.boolean().optional(),
    role: z.string().optional(),
    plan: z.string().optional(),
    pending_plan: z.string().nullable().optional(),
    payment_pending: z.boolean().optional(),
    payment_approved: z.boolean().optional(),
    join_request_pending: z.boolean().optional(),
    proceeding_as_fan: z.boolean().optional(),
    coach_agreement_accepted_at: z.string().nullable().optional(),
    coach_agreement_version: z.number().nullable().optional(),
    organization_id: z.string().nullable().optional(),
    organization_name: z.string().nullable().optional(),
    zip_code: z.string().nullable().optional(),
  })
  .passthrough();

const authCountSchema = z
  .object({
    teams: z.number().optional(),
  })
  .passthrough();

export const authenticatedUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    email_verified: z.boolean().optional(),
    display_name: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    account_state: z.string().nullable().optional(),
    next_step: z.string().nullable().optional(),
    onboarding_completed: z.boolean().optional(),
    is_admin: z.boolean().optional(),
    approval_status: z.string().nullable().optional(),
    dob: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),
    zip_code: z.string().nullable().optional(),
    organization_id: z.string().nullable().optional(),
    paid_by_owner: z.boolean().optional(),
    banned: z.boolean().optional(),
    verified: z.boolean().optional(),
    is_verified: z.boolean().optional(),
    google_id: z.string().nullable().optional(),
    apple_id: z.string().nullable().optional(),
    has_password: z.boolean().optional(),
    linked_providers: linkedProvidersSchema.nullable().optional(),
    required_coach_agreement_version: z.number().optional(),
    coach_application: coachApplicationSchema.nullable().optional(),
    preferences: authPreferencesSchema.nullable().optional(),
    _count: authCountSchema.optional(),
  })
  .passthrough();

const onboardingCompletionSchema = z
  .object({
    message: z.string(),
    user: authenticatedUserSchema,
  })
  .passthrough();

export type AuthenticatedUserResponse = z.infer<typeof authenticatedUserSchema>;
export type OnboardingCompletionResponse = z.infer<typeof onboardingCompletionSchema>;

function summarizeKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function buildValidationError(endpoint: string, payload: unknown, result: z.SafeParseError<unknown>) {
  const error = new Error(`Auth response schema drift at ${endpoint}`);
  captureException(error, {
    tags: {
      context: 'response_shape_drift',
      entity: 'auth',
      endpoint,
    },
    issue_count: result.error.issues.length,
    issues: result.error.issues.slice(0, 8).map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
    sample_keys: summarizeKeys(payload),
  });
  return Object.assign(error, { code: 'AUTH_RESPONSE_INVALID', endpoint });
}

export function validateAuthenticatedUser(
  endpoint: string,
  payload: unknown
): AuthenticatedUserResponse {
  const result = authenticatedUserSchema.safeParse(payload);
  if (result.success) return result.data;
  throw buildValidationError(endpoint, payload, result);
}

export function validateOnboardingCompletion(
  endpoint: string,
  payload: unknown
): OnboardingCompletionResponse {
  const result = onboardingCompletionSchema.safeParse(payload);
  if (result.success) return result.data;
  throw buildValidationError(endpoint, payload, result);
}
