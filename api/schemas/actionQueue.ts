import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const actionItemSchema = z
  .object({
    kind: z.enum(['event', 'game', 'request']),
    id: z.string(),
    title: z.string(),
    subtitle: z.string(),
    team_id: z.string().nullable().optional(),
    org_id: z.string().nullable().optional(),
    created_at: z.string(),
    route: z.string(),
  })
  .passthrough();

const actionQueueSchema = z
  .object({
    total: z.number(),
    counts: z.object({ events: z.number(), games: z.number(), requests: z.number() }).passthrough(),
    items: z.array(actionItemSchema),
  })
  .passthrough();

export type ActionQueueResponse = z.infer<typeof actionQueueSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;

export function validateActionQueue(endpoint: string, payload: unknown): ActionQueueResponse {
  const result = actionQueueSchema.safeParse(payload);
  if (result.success) return result.data;
  captureException(new Error(`Action queue schema drift at ${endpoint}`), {
    tags: { context: 'response_shape_drift', entity: 'action_queue', endpoint },
  });
  return payload as ActionQueueResponse;
}
