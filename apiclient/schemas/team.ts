import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const teamOrganizationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    sport: z.string().nullable(),
  })
  .passthrough();

export const teamSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    sport: z.string().nullable(),
    club_type: z
      .string()
      .nullable()
      .optional()
      .transform(value => value ?? null),
    extracurricular_category: z.string().nullable(),
    season: z.string().nullable(),
    season_start: z.string().nullable(),
    season_end: z.string().nullable(),
    logo_url: z.string().nullable(),
    avatar_url: z.string().nullable(),
    primary_color: z.string().nullable(),
    is_private: z.boolean(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    league: z.string().nullable(),
    venue_place_id: z.string().nullable(),
    venue_lat: z.number().nullable(),
    venue_lng: z.number().nullable(),
    venue_address: z.string().nullable(),
    organization_id: z.string().nullable(),
    created_at: z.string().nullable(),
    members: z.number().optional(),
    followers_count: z.number().optional(),
    organization: teamOrganizationSchema.nullable().optional(),
    viewer_role: z.string().nullable().optional(),
    my_role: z.string().nullable().optional(),
    is_following: z.boolean().nullable().optional(),
    can_manage_team: z.boolean().optional(),
    is_org_admin: z.boolean().optional(),
    level: z.string().nullable().optional(),
    program_id: z.string().nullable().optional(),
  })
  .passthrough();

const teamArraySchema = z.array(teamSchema);
export type TeamResponse = z.infer<typeof teamSchema>;
export type TeamArrayResponse = z.infer<typeof teamArraySchema>;

const followedTeamSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    venue_address: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
  })
  .passthrough();

const followedTeamArraySchema = z.array(followedTeamSchema);
export type FollowedTeamResponse = z.infer<typeof followedTeamSchema>;
export type FollowedTeamArrayResponse = z.infer<typeof followedTeamArraySchema>;

const teamPermissionsSchema = z
  .object({
    can_manage: z.boolean(),
    membership_role: z.string().nullable().optional(),
    via_org_admin: z.boolean().optional(),
    is_platform_admin: z.boolean().optional(),
  })
  .passthrough();

const teamAdminSummarySchema = z
  .object({
    team: teamSchema,
    permissions: teamPermissionsSchema,
    counts: z
      .object({
        members: z.number(),
        staff: z.number(),
        pending_invites: z.number().optional(),
        upcoming_games: z.number(),
      })
      .passthrough(),
    members: z.array(z.record(z.any())),
    pending_invites: z.array(z.record(z.any())).optional(),
    upcoming_games: z.array(z.record(z.any())),
  })
  .passthrough();

export type TeamAdminSummaryResponse = z.infer<typeof teamAdminSummarySchema>;

const teamScreenSummarySchema = z
  .object({
    team: teamSchema,
    permissions: teamPermissionsSchema,
    counts: z
      .object({
        members: z.number(),
        // The /screen-summary endpoint returns only { members, games }. The UI
        // reads the follower count from team.followers_count, not from here, so
        // `followers` is optional — requiring it caused recurring schema-drift
        // events with zero user-facing impact.
        followers: z.number().optional(),
        games: z.number(),
      })
      .passthrough(),
    members: z.array(z.record(z.any())),
    games: z.array(z.record(z.any())),
  })
  .passthrough();

export type TeamScreenSummaryResponse = z.infer<typeof teamScreenSummarySchema>;

function summarizeKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function reportShapeDrift(endpoint: string, result: z.SafeParseError<unknown>, payload: unknown) {
  captureException(new Error(`Team response schema drift at ${endpoint}`), {
    tags: {
      context: 'response_shape_drift',
      entity: 'team',
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

export function validateTeam(endpoint: string, payload: unknown): TeamResponse {
  const result = teamSchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as TeamResponse;
}

export function validateTeamArray(endpoint: string, payload: unknown): TeamArrayResponse {
  const result = teamArraySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as TeamArrayResponse;
}

export function validateFollowedTeamArray(
  endpoint: string,
  payload: unknown
): FollowedTeamArrayResponse {
  const result = followedTeamArraySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as FollowedTeamArrayResponse;
}

export function validateTeamAdminSummary(
  endpoint: string,
  payload: unknown
): TeamAdminSummaryResponse {
  const result = teamAdminSummarySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as TeamAdminSummaryResponse;
}

export function validateTeamScreenSummary(
  endpoint: string,
  payload: unknown
): TeamScreenSummaryResponse {
  const result = teamScreenSummarySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as TeamScreenSummaryResponse;
}
