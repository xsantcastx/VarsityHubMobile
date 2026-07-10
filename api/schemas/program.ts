import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const programOrganizationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();

const programSchema = z
  .object({
    id: z.string(),
    organization_id: z.string(),
    sport: z.string(),
    gender: z.enum(['boys', 'girls', 'coed']),
    name: z.string().nullable(),
    logo_url: z.string().nullable(),
    created_at: z.string(),
    followers_count: z.number(),
    is_following: z.boolean(),
    organization: programOrganizationSchema.nullable(),
  })
  .passthrough();

const programLevelSchema = z
  .object({
    level: z.string().nullable(),
    team: z.record(z.any()),
    games: z.array(z.record(z.any())),
  })
  .passthrough();

const programScreenSummarySchema = z
  .object({
    program: programSchema,
    levels: z.array(programLevelSchema),
    counts: z
      .object({
        levels: z.number(),
        teams: z.number(),
        games: z.number(),
      })
      .passthrough(),
  })
  .passthrough();

export type ProgramScreenSummaryResponse = z.infer<typeof programScreenSummarySchema>;
export type ProgramScreenSummary = ProgramScreenSummaryResponse;

function summarizeKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function reportShapeDrift(endpoint: string, result: z.SafeParseError<unknown>, payload: unknown) {
  captureException(new Error(`Program response schema drift at ${endpoint}`), {
    tags: {
      context: 'response_shape_drift',
      entity: 'program',
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

export function validateProgramScreenSummary(
  endpoint: string,
  payload: unknown
): ProgramScreenSummaryResponse {
  const result = programScreenSummarySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as ProgramScreenSummaryResponse;
}
