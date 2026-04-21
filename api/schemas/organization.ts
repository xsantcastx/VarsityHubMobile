import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const organizationCountSchema = z
  .object({
    teams: z.number().optional(),
    memberships: z.number().optional(),
    followers: z.number().optional(),
  })
  .passthrough();

const organizationTeamSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    sport: z.string().nullable(),
    season_start: z.string().nullable(),
    season_end: z.string().nullable(),
    status: z.string().nullable(),
    logo_url: z.string().nullable(),
    avatar_url: z.string().nullable(),
    created_at: z.string().nullable(),
    _count: z
      .object({
        memberships: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const organizationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    logo_url: z.string().nullable(),
    profile_picture_url: z.string().nullable(),
    avatar_url: z.string().nullable(),
    background_url: z.string().nullable(),
    sport: z.string().nullable(),
    org_type: z.string().nullable(),
    location: z.string().nullable(),
    formatted_address: z.string().nullable(),
    zip_code: z.string().nullable(),
    season_start: z.string().nullable(),
    season_end: z.string().nullable(),
    status: z.string().nullable(),
    created_at: z.string().nullable(),
    admin_approved: z.boolean(),
    contact_info: z.string().nullable(),
    teams_count: z.number().optional(),
    members_count: z.number().optional(),
    followers_count: z.number().optional(),
    is_following: z.boolean().nullable().optional(),
    _count: organizationCountSchema.optional(),
    teams: z.array(organizationTeamSchema).nullable().optional(),
  })
  .passthrough();

const organizationArraySchema = z.array(organizationSchema);
export type OrganizationResponse = z.infer<typeof organizationSchema>;
export type OrganizationArrayResponse = z.infer<typeof organizationArraySchema>;

function summarizeKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function reportShapeDrift(endpoint: string, result: z.SafeParseError<unknown>, payload: unknown) {
  captureException(new Error(`Organization response schema drift at ${endpoint}`), {
    tags: {
      context: 'response_shape_drift',
      entity: 'organization',
      endpoint,
    },
    issue_count: result.error.issues.length,
    issues: result.error.issues.slice(0, 8).map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
    sample_keys: Array.isArray(payload) ? summarizeKeys(payload[0]) : summarizeKeys(payload),
  });
}

export function validateOrganization(endpoint: string, payload: unknown): OrganizationResponse {
  const result = organizationSchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as OrganizationResponse;
}

export function validateOrganizationArray(
  endpoint: string,
  payload: unknown
): OrganizationArrayResponse {
  const result = organizationArraySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as OrganizationArrayResponse;
}
