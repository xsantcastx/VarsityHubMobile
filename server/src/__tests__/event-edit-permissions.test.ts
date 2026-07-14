/**
 * Regression: PATCH /events/:id must use the same permission rule as
 * PATCH /events/:id/cancel — creator OR canManageAnyTeam (team staff
 * INCLUDING the org-admin fallback) OR admin. 2026-07-13 audit found the
 * edit handler still used the pre-fix inline teamMembership check that the
 * cancel handler's comment documents replacing.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const eventsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'events.ts'), 'utf8');

// Slice to the PATCH /:id handler. Anchor on 'Cannot edit cancelled event'
// (unique to the edit handler) to find its start, and end at the cancel route.
const editMarkerPos = eventsSrc.indexOf("'Cannot edit cancelled event'");
const cancelRoutePos = eventsSrc.indexOf("'/:id/cancel'");
// Slice from a bit before the edit marker (to capture the full handler) to the cancel route
const editHandlerStart = eventsSrc.lastIndexOf('eventsRouter.patch', editMarkerPos);
const editHandler = eventsSrc.slice(editHandlerStart, cancelRoutePos);

describe('PATCH /events/:id permissions', () => {
  it('uses canManageAnyTeam (org-admin fallback included), not an inline membership query', () => {
    expect(editMarkerPos).toBeGreaterThan(-1);
    expect(cancelRoutePos).toBeGreaterThan(editMarkerPos);
    expect(editHandler).toMatch(/canManageAnyTeam\(/);
  });
  it('no longer hand-rolls the staff-role membership check', () => {
    expect(editHandler).not.toMatch(
      /role:\s*\{\s*in:\s*\['owner',\s*'manager',\s*'coach',\s*'assistant_coach'\]/
    );
  });
});
