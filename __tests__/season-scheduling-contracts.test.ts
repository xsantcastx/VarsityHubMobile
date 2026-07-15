/**
 * Phase 5 + 6e contracts (client, manage-season.tsx):
 *  - all game-create encode paths use true-instant local Dates, never Date.UTC
 *    (the Date.UTC form stored wall-clock as UTC → wrong time for non-UTC users)
 *  - bulk-season payloads attach the managed team's id, so the server's
 *    /games/bulk endpoint (which requires a team id) no longer 400s every row.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app', 'manage-season.tsx'), 'utf8');

describe('timezone encoding', () => {
  it('no game-time encoding uses Date.UTC (true-instant local Dates only)', () => {
    // Date.UTC on picker parts stores wall-clock as UTC — banned here.
    expect(src).not.toMatch(/new Date\(\s*Date\.UTC\(/);
  });
});

describe('bulk-season payload', () => {
  it('attaches the managed team id to bulk game rows', () => {
    const idx = src.indexOf('const payloads = bulkGames.map');
    const region = src.slice(idx, idx + 2200);
    expect(region).toMatch(/home_team_id: currentTeamId|away_team_id: currentTeamId/);
  });
});
