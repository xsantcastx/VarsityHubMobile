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
    team: z
      .object({
        gender: z.enum(['boys', 'girls', 'coed']).nullable().optional(),
      })
      .passthrough(),
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

function reportShapeDrift(endpoint: string, error: z.ZodError, payload: unknown) {
  captureException(new Error(`Program response schema drift at ${endpoint}`), {
    tags: {
      context: 'response_shape_drift',
      entity: 'program',
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

export function validateProgramScreenSummary(
  endpoint: string,
  payload: unknown
): ProgramScreenSummaryResponse {
  const result = programScreenSummarySchema.safeParse(payload);
  if (!result.success) {
    reportShapeDrift(endpoint, result.error, payload);
    return payload as ProgramScreenSummaryResponse;
  }
  return result.data;
}
