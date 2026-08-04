import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Pins the pro-sports convergence decision (2026-08-01): there is exactly ONE
 * pro-sports pipeline — the ProTeam ingest (pro_external_ref + sport). The old
 * parallel MLB/WNBA ESPN-sync system (workflows + scripts that created untagged,
 * dup-prone games) was retired. This test fails loudly if any of it is
 * re-introduced, so the duplication cannot silently come back.
 */

// server/src/__tests__ → up 3 = repo root
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const RETIRED_PARALLEL_SYNC = [
  '.github/workflows/mlb-wnba-sync.yml',
  '.github/workflows/weekly-sports-refresh.yml',
  'server/scripts/wnba/sync-wnba-schedule.ts',
  'server/scripts/mlb/sync-mlb-schedule.ts',
  'server/scripts/weekly/cleanup-stale-games.ts',
];

describe('pro sports: single system (no parallel MLB/WNBA sync)', () => {
  it.each(RETIRED_PARALLEL_SYNC)('retired file stays retired: %s', (rel) => {
    expect(existsSync(path.join(repoRoot, rel))).toBe(false);
  });
});
