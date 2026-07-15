/**
 * PUT /games/:id guards (Phase 1b). The 2026-07-14 audit found two holes:
 *  - team reassignment: changing away_team_id/home_team_id on an existing game
 *    was authorized against the game's OLD teams and never recomputed opponent
 *    approval → a coach could pin a victim team as opponent, bypassing consent.
 *  - approved-game rewrite: no field allowlist, so a fan creator could rewrite
 *    an approved game's identity fields after moderation.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

// Isolate the PUT /:id handler body (from the second put() to the next route).
const putStart = gamesSrc.indexOf("gamesRouter.put(\n  '/:id'");
const putEnd = gamesSrc.indexOf('gamesRouter.', putStart + 20);
const putSrc =
  putStart >= 0 ? gamesSrc.slice(putStart, putEnd > putStart ? putEnd : undefined) : '';

describe('PUT /games/:id edit guards', () => {
  it('selects approval_status so it can enforce the approved-edit allowlist', () => {
    expect(putSrc).toMatch(/approval_status:\s*true/);
  });

  it('restricts non-admin edits of an approved game to an allowlist', () => {
    expect(putSrc).toMatch(/GAME_COACH_EDITABLE_FIELDS/);
  });

  it('re-derives approval/opponent-consent when teams change', () => {
    expect(putSrc).toMatch(/deriveGameApproval\(/);
    expect(putSrc).toMatch(/opponent_approval_status/);
  });
});
