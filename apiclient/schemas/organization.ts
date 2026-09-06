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
    viewer_role: z.string().nullable().optional(),
    is_member: z.boolean().optional(),
    is_owner: z.boolean().optional(),
    can_edit: z.boolean().optional(),
    can_manage: z.boolean().optional(),
    can_review_coaches: z.boolean().optional(),
    _count: organizationCountSchema.optional(),
    teams: z.array(organizationTeamSchema).nullable().optional(),
  })
  .passthrough();

const organizationArraySchema = z.array(organizationSchema);
export type OrganizationResponse = z.infer<typeof organizationSchema>;
export type OrganizationArrayResponse = z.infer<typeof organizationArraySchema>;

const organizationReviewSummarySchema = z
  .object({
    organization: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .passthrough(),
    permissions: z
      .object({
        can_manage: z.boolean(),
        can_review_coach_requests: z.boolean(),
        membership_role: z.string().nullable().optional(),
      })
      .passthrough(),
    counts: z
      .object({
        pending_coach_requests: z.number(),
        pending_game_reviews: z.number(),
        pending_event_reviews: z.number(),
      })
      .passthrough(),
  })
  .passthrough();

const organizationReviewSummaryArraySchema = z.array(organizationReviewSummarySchema);
export type OrganizationReviewSummaryResponse = z.infer<typeof organizationReviewSummarySchema>;
export type OrganizationReviewSummaryArrayResponse = z.infer<
  typeof organizationReviewSummaryArraySchema
>;

const organizationAdminSummarySchema = z
  .object({
    organization: organizationSchema,
    permissions: z
      .object({
        can_manage: z.boolean(),
        can_review_coach_requests: z.boolean(),
        membership_role: z.string().nullable().optional(),
        is_platform_admin: z.boolean().optional(),
      })
      .passthrough(),
    counts: z
      .object({
        teams: z.number(),
        members: z.number(),
        followers: z.number(),
        pending_authorized_invites: z.number().optional(),
        pending_coach_requests: z.number(),
        pending_game_reviews: z.number(),
        pending_event_reviews: z.number(),
        upcoming_games: z.number(),
        upcoming_events: z.number(),
      })
      .passthrough(),
    teams: z.array(z.record(z.any())),
    members: z.array(z.record(z.any())),
    requests: z
      .object({
        authorized_invites: z.array(z.record(z.any())).optional(),
        coach_requests: z.array(z.record(z.any())),
        pending_games: z.array(z.record(z.any())),
        pending_events: z.array(z.record(z.any())),
      })
      .passthrough(),
    upcoming: z
      .object({
        games: z.array(z.record(z.any())),
        events: z.array(z.record(z.any())),
      })
      .passthrough(),
  })
  .passthrough();

export type OrganizationAdminSummaryResponse = z.infer<typeof organizationAdminSummarySchema>;

function summarizeKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function reportShapeDrift(endpoint: string, error: z.ZodError, payload: unknown) {
  captureException(new Error(`Organization response schema drift at ${endpoint}`), {
    tags: {
      context: 'response_shape_drift',
      entity: 'organization',
      endpoint,
    },
    issue_count: error.issues.length,
    issues: error.issues.slice(0, 8).map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
    sample_keys: Array.isArray(payload) ? summarizeKeys(payload[0]) : summarizeKeys(payload),
  });
}

export function validateOrganization(endpoint: string, payload: unknown): OrganizationResponse {
  const result = organizationSchema.safeParse(payload);
  if (!result.success) {
    reportShapeDrift(endpoint, result.error, payload);
    return payload as OrganizationResponse;
  }
  return result.data;
}

export function validateOrganizationArray(
  endpoint: string,
  payload: unknown
): OrganizationArrayResponse {
  const result = organizationArraySchema.safeParse(payload);
  if (!result.success) {
    reportShapeDrift(endpoint, result.error, payload);
    return payload as OrganizationArrayResponse;
  }
  return result.data;
}

export function validateOrganizationAdminSummary(
  endpoint: string,
  payload: unknown
): OrganizationAdminSummaryResponse {
  const result = organizationAdminSummarySchema.safeParse(payload);
  if (!result.success) {
    reportShapeDrift(endpoint, result.error, payload);
    return payload as OrganizationAdminSummaryResponse;
  }
  return result.data;
}

export function validateOrganizationReviewSummaryArray(
  endpoint: string,
  payload: unknown
): OrganizationReviewSummaryArrayResponse {
  const result = organizationReviewSummaryArraySchema.safeParse(payload);
  if (!result.success) {
    reportShapeDrift(endpoint, result.error, payload);
    return payload as OrganizationReviewSummaryArrayResponse;
  }
  return result.data;
}
