import { z } from 'zod';
import { captureException } from '@/utils/sentry';

/**
 * Event response schema — the client's contract for what the server's
 * `serializeEvent` function produces (see server/src/routes/events.ts).
 *
 * Shape drift between this schema and the server serializer is reported
 * to Sentry with `tag:response_shape_drift, entity:event`, but the
 * payload is always returned unchanged so we never break a release on a
 * mismatch. This mirrors the Team and Organization patterns.
 */

const eventGameSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    cover_image_url: z.string().nullable(),
    date: z.string().nullable(),
    location: z.string().nullable(),
    home_score: z.number().nullable().optional(),
    away_score: z.number().nullable().optional(),
    winner: z.string().nullable().optional(),
  })
  .passthrough();

const eventCreatorSchema = z
  .object({
    id: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  })
  .passthrough();

export const eventSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    date: z.string().nullable(),
    location: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    banner_url: z.string().nullable(),
    cover_image_url: z.string().nullable().optional(),
    game_id: z.string().nullable(),
    capacity: z.number().nullable(),
    status: z.string().nullable(),
    created_at: z.string().nullable(),
    creator_id: z.string().nullable(),
    creator_role: z.string().nullable(),
    approval_status: z.string().nullable(),
    event_type: z.string().nullable(),
    description: z.string().nullable(),
    linked_league: z.string().nullable(),
    max_attendees: z.number().nullable(),
    contact_info: z.string().nullable(),
    approved_at: z.string().nullable(),
    rejected_reason: z.string().nullable(),
    attendees_count: z.number().optional(),
    rsvp_count: z.number().optional(),
    game: eventGameSchema.nullable().optional(),
    creator: eventCreatorSchema.nullable().optional(),
  })
  .passthrough();

const eventArraySchema = z.array(eventSchema);

const eventSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    date: z.string().nullable(),
    location: z.string().nullable(),
    event_type: z.string().nullable(),
    approval_status: z.string().nullable(),
    status: z.string().nullable(),
    rejected_reason: z.string().nullable(),
    created_at: z.string().nullable(),
    approved_at: z.string().nullable(),
    description: z.string().nullable(),
  })
  .passthrough();

const eventSummaryArraySchema = z.array(eventSummarySchema);

export const eventRsvpRowSchema = z
  .object({
    id: z.string(),
    created_at: z.string().nullable(),
    event: eventSchema.nullable(),
  })
  .passthrough();

const eventRsvpArraySchema = z.array(eventRsvpRowSchema);

export type EventResponse = z.infer<typeof eventSchema>;
export type EventArrayResponse = z.infer<typeof eventArraySchema>;
export type EventSummaryResponse = z.infer<typeof eventSummarySchema>;
export type EventSummaryArrayResponse = z.infer<typeof eventSummaryArraySchema>;
export type EventRsvpRowResponse = z.infer<typeof eventRsvpRowSchema>;
export type EventRsvpArrayResponse = z.infer<typeof eventRsvpArraySchema>;

function summarizeKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function reportShapeDrift(endpoint: string, result: z.SafeParseError<unknown>, payload: unknown) {
  captureException(new Error(`Event response schema drift at ${endpoint}`), {
    tags: {
      context: 'response_shape_drift',
      entity: 'event',
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

export function validateEvent(endpoint: string, payload: unknown): EventResponse {
  const result = eventSchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as EventResponse;
}

export function validateEventArray(endpoint: string, payload: unknown): EventArrayResponse {
  const result = eventArraySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as EventArrayResponse;
}

export function validateEventSummaryArray(
  endpoint: string,
  payload: unknown
): EventSummaryArrayResponse {
  const result = eventSummaryArraySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as EventSummaryArrayResponse;
}

export function validateEventRsvpArray(
  endpoint: string,
  payload: unknown
): EventRsvpArrayResponse {
  const result = eventRsvpArraySchema.safeParse(payload);
  if (result.success) return result.data;
  reportShapeDrift(endpoint, result, payload);
  return payload as EventRsvpArrayResponse;
}
