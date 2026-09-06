import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PRO_SCHEDULE_LEAGUES } from '../lib/proSchedule/types.js';

describe('pro schedule league list parity', () => {
  it('keeps operational entry points wired to the canonical league list', () => {
    expect(PRO_SCHEDULE_LEAGUES).toEqual([
      'nfl',
      'nba',
      'wnba',
      'mlb',
      'wwe',
      'ufc',
      'atp',
      'wta',
      'ncaaf',
      'ncaamb',
      'ncaawb',
      'ncaabaseball',
      'ncaamhockey',
    ]);

    const proTeamsRoute = readFileSync(path.join(process.cwd(), 'src/routes/pro-teams.ts'), 'utf8');
    const ingestScript = readFileSync(
      path.join(process.cwd(), 'scripts/ingest-pro-schedule.ts'),
      'utf8'
    );

    expect(proTeamsRoute).toMatch(/z\.enum\(PRO_SCHEDULE_LEAGUES\)/);
    expect(ingestScript).toMatch(
      /const ALL_LEAGUES:\s*ProLeague\[\]\s*=\s*\[\.\.\.PRO_SCHEDULE_LEAGUES\]/
    );
  });
});
